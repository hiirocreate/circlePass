import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";

/**
 * GET /api/rewards?shopId=xxx
 * ログイン中ユーザーの保有ポイントと、その店舗の特典交換ルール一覧を返す。
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const shopId = req.nextUrl.searchParams.get("shopId");
  if (!shopId) {
    return NextResponse.json({ error: "shopIdが必要です" }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  const { data: shop } = await supabase
    .from("shops")
    .select("feature_subscription_enabled")
    .eq("id", shopId)
    .single();

  if (!shop?.feature_subscription_enabled) {
    return NextResponse.json({ error: "この店舗では来店ポイント機能は利用できません" }, { status: 403 });
  }

  const { data: membership } = await supabase
    .from("user_shop_memberships")
    .select("points")
    .eq("user_id", session.userId)
    .eq("shop_id", shopId)
    .maybeSingle();

  const { data: rewards } = await supabase
    .from("point_rewards")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("required_points", { ascending: true });

  const { data: pendingRedemption } = await supabase
    .from("reward_redemptions")
    .select("*, point_rewards(reward_description, required_points)")
    .eq("user_id", session.userId)
    .eq("shop_id", shopId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    points: membership?.points ?? 0,
    rewards: rewards ?? [],
    pendingRedemption: pendingRedemption ?? null,
  });
}
