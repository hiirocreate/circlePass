import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceSupabase } from "@/lib/supabase";
import { createAdminServerClient } from "@/lib/supabase-admin-server";
import { getSession } from "@/lib/session";

/**
 * POST /api/stripe/portal
 * body: { context: "shop_saas" } または { context: "member_subscription", subscriptionId }
 *
 * Stripeのカスタマーポータル(カード変更・請求書確認・解約が1画面でできる
 * Stripeホスティングのページ)へのURLを発行する。
 *
 * - context: "shop_saas" … 店舗管理者が、運営へのSaaS利用料の支払い方法を管理する
 * - context: "member_subscription" … LINEユーザーが、自分の会員証サブスクを管理する
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = createServiceSupabase();

  if (body.context === "shop_saas") {
    const adminClient = createAdminServerClient();
    const { data: authUser } = await adminClient.auth.getUser();
    if (!authUser?.user) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { data: callerAdmin } = await supabase.from("admins").select("*").eq("id", authUser.user.id).single();
    if (!callerAdmin) {
      return NextResponse.json({ error: "管理者情報が見つかりません" }, { status: 403 });
    }

    const shopId = callerAdmin.role === "operator" ? body.shopId : callerAdmin.shop_id;
    const { data: shop } = await supabase.from("shops").select("saas_stripe_customer_id").eq("id", shopId).single();

    if (!shop?.saas_stripe_customer_id) {
      return NextResponse.json({ error: "まだ契約履歴がありません。先にプランへ申し込んでください。" }, { status: 400 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: shop.saas_stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  }

  if (body.context === "member_subscription") {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("id", body.subscriptionId)
      .eq("user_id", session.userId)
      .single();

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ error: "契約情報が見つかりません" }, { status: 404 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/card`,
    });

    return NextResponse.json({ url: portalSession.url });
  }

  return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
}
