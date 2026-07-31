import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { stripe } from "@/lib/stripe";

/** GET: ログインユーザーの契約中サブスク一覧(会員証表示用) */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("subscriptions")
    .select("*, subscription_plans(*), shops(*)")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ subscriptions: data ?? [] });
}

/**
 * DELETE: サブスク解約
 * body: { subscriptionId }
 */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { subscriptionId } = await req.json();
  const supabase = createServiceSupabase();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .eq("user_id", session.userId)
    .single();

  if (!sub) {
    return NextResponse.json({ error: "契約が見つかりません" }, { status: 404 });
  }

  if (sub.stripe_subscription_id) {
    await stripe.subscriptions.cancel(sub.stripe_subscription_id);
  }

  await supabase
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  return NextResponse.json({ ok: true });
}
