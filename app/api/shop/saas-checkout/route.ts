import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceSupabase } from "@/lib/supabase";
import { createAdminServerClient } from "@/lib/supabase-admin-server";

const PRICE_ID_BY_PLAN: Record<string, string | undefined> = {
  light: process.env.STRIPE_SAAS_PRICE_LIGHT,
  standard: process.env.STRIPE_SAAS_PRICE_STANDARD,
  premium: process.env.STRIPE_SAAS_PRICE_PREMIUM,
};

/**
 * POST /api/shop/saas-checkout
 * body: { plan: "light" | "standard" | "premium" }
 *
 * 店舗管理者が、運営へのSaaS利用料の支払いを開始する。
 * (運営はshopIdを指定して代理でも実行できる)
 */
export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const shopId = callerAdmin.role === "operator" ? body.shopId : callerAdmin.shop_id;
  if (!shopId) {
    return NextResponse.json({ error: "shopIdが必要です" }, { status: 400 });
  }

  const plan = body.plan as string;
  const priceId = PRICE_ID_BY_PLAN[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: "このプランのStripe価格が未設定です。運営に scripts/create-saas-plans.ts の実行を依頼してください。" },
      { status: 400 }
    );
  }

  const { data: shop } = await supabase.from("shops").select("*").eq("id", shopId).single();
  if (!shop) {
    return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    // 既にStripe顧客として登録済みなら使い回し、初回なら新規作成する
    customer: shop.saas_stripe_customer_id || undefined,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=1`,
    metadata: {
      type: "saas_subscription",
      shop_id: shopId,
      saas_plan: plan,
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
