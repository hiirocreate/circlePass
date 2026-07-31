import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceSupabase } from "@/lib/supabase";
import { createAdminServerClient } from "@/lib/supabase-admin-server";

/**
 * POST /api/shop/plans
 * 店舗管理者がサブスクプランを新規作成する。
 * Stripe上にProduct/Priceを自動作成し、subscription_plansに保存する。
 */
export async function POST(req: NextRequest) {
  const adminClient = createAdminServerClient();
  const { data: authUser } = await adminClient.auth.getUser();
  if (!authUser?.user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  const { data: adminRow } = await supabase.from("admins").select("*").eq("id", authUser.user.id).single();
  if (!adminRow) {
    return NextResponse.json({ error: "管理者情報が見つかりません" }, { status: 403 });
  }

  const body = await req.json();
  const shopId = adminRow.role === "operator" ? body.shopId : adminRow.shop_id;
  if (!shopId) {
    return NextResponse.json({ error: "shopIdが必要です" }, { status: 400 });
  }

  const { data: shop } = await supabase.from("shops").select("name").eq("id", shopId).single();

  const product = await stripe.products.create({
    name: `${shop?.name ?? ""} ${body.planName}`,
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: body.price,
    currency: "jpy",
    recurring: { interval: "month" },
  });

  const { data: plan, error } = await supabase
    .from("subscription_plans")
    .insert({
      shop_id: shopId,
      plan_name: body.planName,
      price: body.price,
      description: body.description ?? null,
      usage_limit: body.usageLimit ?? null,
      available_days: body.availableDays ?? null,
      available_time_start: body.availableTimeStart ?? null,
      available_time_end: body.availableTimeEnd ?? null,
      auto_renew: body.autoRenew ?? true,
      stripe_price_id: price.id,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "プランの作成に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ plan });
}
