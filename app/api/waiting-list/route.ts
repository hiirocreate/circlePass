import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { sendLineMessage, getShopLineToken } from "@/lib/line";

/**
 * POST /api/waiting-list
 * body: { shopId, peopleCount, name, memo }
 * ユーザーが順番待ちに登録する。
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { shopId, peopleCount, name, memo } = await req.json();
  const supabase = createServiceSupabase();

  const { data: shop } = await supabase.from("shops").select("*").eq("id", shopId).single();
  if (!shop) {
    return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
  }
  if (!shop.feature_waiting_enabled) {
    return NextResponse.json({ error: "この店舗では順番待ちシステムは利用できません" }, { status: 403 });
  }

  // 現在の待機組数を取得し、当日の受付番号と推定待ち時間を計算
  const { data: waitingGroups, count } = await supabase
    .from("waiting_lists")
    .select("*", { count: "exact" })
    .eq("shop_id", shopId)
    .in("status", ["waiting", "calling"]);

  if ((count ?? 0) >= shop.waiting_max_capacity) {
    return NextResponse.json({ error: "現在満員のため受付できません" }, { status: 400 });
  }

  const { data: lastEntry } = await supabase
    .from("waiting_lists")
    .select("waiting_number")
    .eq("shop_id", shopId)
    .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    .order("waiting_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNumber = (lastEntry?.waiting_number ?? 0) + 1;
  const estimatedMinutes = (count ?? 0) * shop.waiting_minutes_per_group;

  const { data: created, error } = await supabase
    .from("waiting_lists")
    .insert({
      user_id: session.userId,
      shop_id: shopId,
      people_count: peopleCount,
      name,
      memo: memo ?? null,
      waiting_number: nextNumber,
      estimated_wait_minutes: estimatedMinutes,
      status: "waiting",
    })
    .select()
    .single();

  if (error || !created) {
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }

  if (shop.waiting_line_notify) {
    const { data: user } = await supabase.from("users").select("line_id").eq("id", session.userId).single();
    if (user) {
      const token = await getShopLineToken(supabase, shopId);
      await sendLineMessage(
        user.line_id,
        `【${shop.name}】順番待ち受付が完了しました。受付番号: ${nextNumber}番 / 現在${count ?? 0}組待ち / 目安待ち時間: 約${estimatedMinutes}分`,
        token
      );
    }
  }

  return NextResponse.json({ waiting: created });
}

/**
 * GET /api/waiting-list?shopId=xxx
 * ログイン中ユーザーの、指定店舗における現在の順番待ち状況を取得
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const shopId = req.nextUrl.searchParams.get("shopId");
  const supabase = createServiceSupabase();

  const { data } = await supabase
    .from("waiting_lists")
    .select("*")
    .eq("user_id", session.userId)
    .eq("shop_id", shopId)
    .in("status", ["waiting", "calling"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ waiting: data ?? null });
}
