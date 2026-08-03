import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceSupabase } from "@/lib/supabase";
import { sendLineMessage, getShopLineToken } from "@/lib/line";
import Stripe from "stripe";

// Next.js App RouterではWebhook署名検証のため生のbodyが必要
export const runtime = "nodejs";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * checkout.session.completed と invoice.paid はほぼ同時に届くことがあり、
 * まれに invoice.paid が先に処理されて subscriptions テーブルにまだ行が無い
 * ことがある(初回決済の売上記録が漏れる原因になる)。
 * 見つからない場合は少し待って1回だけ再試行する。
 */
async function findSubscriptionByStripeId(
  supabase: ReturnType<typeof createServiceSupabase>,
  stripeSubId: string,
  select = "*"
) {
  for (const delayMs of [0, 2000]) {
    if (delayMs > 0) await sleep(delayMs);
    const { data } = await supabase
      .from("subscriptions")
      .select(select)
      .eq("stripe_subscription_id", stripeSubId)
      .maybeSingle();
    if (data) return data as any;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook署名検証エラー", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object as Stripe.Checkout.Session;
      const metadata = cs.metadata ?? {};

      // 店舗→運営のSaaS利用料契約
      if (metadata.type === "saas_subscription") {
        const { shop_id, saas_plan } = metadata;
        if (!shop_id) break;

        await supabase
          .from("shops")
          .update({
            saas_stripe_customer_id: cs.customer as string,
            saas_stripe_subscription_id: cs.subscription as string,
            saas_plan: saas_plan ?? "light",
            saas_payment_status: "active",
          })
          .eq("id", shop_id);
        break;
      }

      // 店舗の顧客(LINEユーザー)による会員証サブスク申し込み
      const { user_id, plan_id, shop_id, line_id } = metadata;
      if (!user_id || !plan_id || !shop_id) break;

      const stripeSub = await stripe.subscriptions.retrieve(cs.subscription as string);

      await supabase.from("subscriptions").insert({
        user_id,
        plan_id,
        shop_id,
        stripe_customer_id: cs.customer as string,
        stripe_subscription_id: stripeSub.id,
        status: "active",
        current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
        next_payment_date: new Date(stripeSub.current_period_end * 1000).toISOString(),
      });

      // 会員登録(未登録なら作成)
      await supabase
        .from("user_shop_memberships")
        .upsert({ user_id, shop_id }, { onConflict: "user_id,shop_id" });

      if (line_id) {
        const token = await getShopLineToken(supabase, shop_id);
        await sendLineMessage(line_id, "ご登録ありがとうございます。サブスクの決済が完了しました。", token);
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubId = invoice.subscription as string;

      const sub = await findSubscriptionByStripeId(supabase, stripeSubId);

      if (sub) {
        await supabase
          .from("subscriptions")
          .update({ status: "active" })
          .eq("id", sub.id);

        // Stripeが同じイベントを再送してくることがあるため、同じ請求書IDの
        // 記録が既にあれば二重に売上計上しない
        const { data: existing } = await supabase
          .from("payment_histories")
          .select("id")
          .eq("stripe_invoice_id", invoice.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from("payment_histories").insert({
            subscription_id: sub.id,
            stripe_invoice_id: invoice.id,
            amount: invoice.amount_paid,
            status: "paid",
            paid_at: new Date().toISOString(),
          });
        }
        break;
      }

      // 店舗→運営のSaaS利用料の支払い
      await supabase
        .from("shops")
        .update({ saas_payment_status: "active" })
        .eq("saas_stripe_subscription_id", stripeSubId);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubId = invoice.subscription as string;

      const sub = await findSubscriptionByStripeId(supabase, stripeSubId, "*, users(line_id)");

      if (sub) {
        await supabase.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);

        const { data: existing } = await supabase
          .from("payment_histories")
          .select("id")
          .eq("stripe_invoice_id", invoice.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from("payment_histories").insert({
            subscription_id: sub.id,
            stripe_invoice_id: invoice.id,
            amount: invoice.amount_due,
            status: "failed",
          });
        }

        const lineId = (sub as any).users?.line_id;
        if (lineId) {
          const token = await getShopLineToken(supabase, sub.shop_id);
          await sendLineMessage(lineId, "決済に失敗しました。カード情報をご確認ください。", token);
        }
        break;
      }

      // 店舗→運営のSaaS利用料の支払い失敗(店舗の停止は行わず、状態のみ記録する。
      // 強制停止するかどうかは運営が管理画面から判断する運用)
      await supabase
        .from("shops")
        .update({ saas_payment_status: "past_due" })
        .eq("saas_stripe_subscription_id", stripeSubId);
      break;
    }

    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as Stripe.Subscription;

      const { data: updatedSub } = await supabase
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("stripe_subscription_id", stripeSub.id)
        .select()
        .maybeSingle();

      if (!updatedSub) {
        // 店舗→運営のSaaS利用料契約が完全に終了した場合は、自動的に店舗を停止する
        await supabase
          .from("shops")
          .update({ saas_payment_status: "canceled", is_active: false })
          .eq("saas_stripe_subscription_id", stripeSub.id);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}