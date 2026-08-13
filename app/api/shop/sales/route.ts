import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { createAdminServerClient } from "@/lib/supabase-admin-server";

/**
 * GET /api/shop/sales?shopId=xxx(運営のみ指定可、店舗管理者は自店舗固定)
 *
 * 決済履歴一覧と、月別売上サマリーを返す。
 * 店舗管理者は自店舗分のみ、運営はshopIdを指定して任意の店舗分を取得できる
 * (shopId未指定の場合、運営には全店舗合算を返す)。
 */
export async function GET(req: NextRequest) {
  const adminClient = createAdminServerClient();
  const { data: authUser } = await adminClient.auth.getUser();
  if (!authUser?.user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  const { data: callerAdmin } = await supabase.from("admins").select("*").eq("id", authUser.user.id).single();
  if (!callerAdmin) {
    return NextResponse.json({ error: "管理者情報が見つかりません" }, { status: 403 });
  }

  const requestedShopId = req.nextUrl.searchParams.get("shopId");
  let shopId: string | null;

  if (callerAdmin.role === "operator") {
    shopId = requestedShopId; // null なら全店舗合算
  } else {
    shopId = callerAdmin.shop_id;
  }

  // 決済履歴(成功・失敗とも)は、全プラン共通で直近1年分を取得し、月次集計はJS側で行う
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  oneYearAgo.setDate(1);
  oneYearAgo.setHours(0, 0, 0, 0);

  let query = supabase
    .from("payment_histories")
    .select("*, subscriptions!inner(shop_id, subscription_plans(plan_name), users(name), shops(name))")
    .gte("created_at", oneYearAgo.toISOString())
    .order("created_at", { ascending: false });

  if (shopId) {
    query = query.eq("subscriptions.shop_id", shopId);
  }

  const { data: payments, error } = await query;

  if (error) {
    return NextResponse.json({ error: "決済履歴の取得に失敗しました" }, { status: 500 });
  }

  // 月別(YYYY-MM)集計
  const monthlyMap = new Map<string, { revenue: number; paidCount: number; failedCount: number }>();
  for (const p of payments ?? []) {
    const dateStr = (p.paid_at ?? p.created_at) as string;
    const monthKey = dateStr.slice(0, 7); // "2026-07"
    const entry = monthlyMap.get(monthKey) ?? { revenue: 0, paidCount: 0, failedCount: 0 };
    if (p.status === "paid") {
      entry.revenue += p.amount;
      entry.paidCount += 1;
    } else {
      entry.failedCount += 1;
    }
    monthlyMap.set(monthKey, entry);
  }

  const monthly = Array.from(monthlyMap.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonth = monthly.find((m) => m.month === currentMonthKey) ?? {
    month: currentMonthKey,
    revenue: 0,
    paidCount: 0,
    failedCount: 0,
  };

  return NextResponse.json({
    payments: (payments ?? []).map((p: any) => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      paidAt: p.paid_at,
      createdAt: p.created_at,
      planName: p.subscriptions?.subscription_plans?.plan_name ?? "-",
      shopName: p.subscriptions?.shops?.name ?? "-",
      userName: p.subscriptions?.users?.name ?? "-",
    })),
    monthly,
    currentMonth,
  });
}
