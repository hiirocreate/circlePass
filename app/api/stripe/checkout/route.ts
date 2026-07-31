import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";

/**
 * POST /api/stripe/checkout
 * body: { planId: string }
 *
 * ログイン中のLINEユーザーが指定プランのサブスク決済ページURLを取得する。
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { planId } = await req.json();
  const supabase = createServiceSupabase();

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("*, shops(name, feature_subscription_enabled)")
    .eq("id", planId)
    .single();

  if (!plan || !plan.stripe_price_id) {
    return NextResponse.json({ error: "プランが見つかりません" }, { status: 404 });
  }

  if (!(plan as any).shops?.feature_subscription_enabled) {
    return NextResponse.json({ error: "この店舗ではサブスク会員証は利用できません" }, { status: 403 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", session.userId)
    .single();

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/card?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/home?canceled=1`,
    customer_email: undefined,
    metadata: {
      user_id: session.userId,
      plan_id: plan.id,
      shop_id: plan.shop_id,
      line_id: session.lineId,
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
