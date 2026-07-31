import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceSupabase } from "@/lib/supabase";
import { sendLineMessage, getShopLineToken } from "@/lib/line";
import Stripe from "stripe";

// Next.js App RouterではWebhook署名検証のため生のbodyが必要
export const runtime = "nodejs";

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
      const { user_id, plan_id, shop_id, line_id } = cs.metadata ?? {};
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

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("stripe_subscription_id", stripeSubId)
        .maybeSingle();

      if (sub) {
        await supabase
          .from("subscriptions")
          .update({ status: "active" })
          .eq("id", sub.id);

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

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubId = invoice.subscription as string;

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*, users(line_id)")
        .eq("stripe_subscription_id", stripeSubId)
        .maybeSingle();

      if (sub) {
        await supabase.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
        await supabase.from("payment_histories").insert({
          subscription_id: sub.id,
          stripe_invoice_id: invoice.id,
          amount: invoice.amount_due,
          status: "failed",
        });

        const lineId = (sub as any).users?.line_id;
        if (lineId) {
          const token = await getShopLineToken(supabase, sub.shop_id);
          await sendLineMessage(lineId, "決済に失敗しました。カード情報をご確認ください。", token);
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as Stripe.Subscription;
      await supabase
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("stripe_subscription_id", stripeSub.id);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
