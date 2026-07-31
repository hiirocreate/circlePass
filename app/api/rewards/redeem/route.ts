import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";

/**
 * POST /api/rewards/redeem
 * body: { shopId, rewardId }
 *
 * ポイントはこの時点では減算しない(申請のみ)。店舗側がQRを確認して
 * 完了させた時点(/api/points の action: reward_complete)で減算する。
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { shopId, rewardId } = await req.json();
  const supabase = createServiceSupabase();

  const { data: shop } = await supabase
    .from("shops")
    .select("feature_subscription_enabled")
    .eq("id", shopId)
    .single();

  if (!shop?.feature_subscription_enabled) {
    return NextResponse.json({ error: "この店舗では特典交換は利用できません" }, { status: 403 });
  }

  const { data: reward } = await supabase
    .from("point_rewards")
    .select("*")
    .eq("id", rewardId)
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .single();

  if (!reward) {
    return NextResponse.json({ error: "特典が見つかりません" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("user_shop_memberships")
    .select("points")
    .eq("user_id", session.userId)
    .eq("shop_id", shopId)
    .maybeSingle();

  const currentPoints = membership?.points ?? 0;
  if (currentPoints < reward.required_points) {
    return NextResponse.json({ error: "ポイントが不足しています" }, { status: 400 });
  }

  // 既に申請中(pending)のものがあれば重複申請させない
  const { data: existingPending } = await supabase
    .from("reward_redemptions")
    .select("id")
    .eq("user_id", session.userId)
    .eq("shop_id", shopId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending) {
    return NextResponse.json({ error: "申請中の特典交換があります。店舗スタッフにご提示ください。" }, { status: 400 });
  }

  const { data: redemption, error } = await supabase
    .from("reward_redemptions")
    .insert({
      user_id: session.userId,
      shop_id: shopId,
      reward_id: rewardId,
      points_used: reward.required_points,
      status: "pending",
    })
    .select()
    .single();

  if (error || !redemption) {
    return NextResponse.json({ error: "申請に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ redemption });
}

/**
 * DELETE /api/rewards/redeem
 * body: { redemptionId }
 * 申請中の特典交換を本人がキャンセルする。
 */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { redemptionId } = await req.json();
  const supabase = createServiceSupabase();

  const { data: redemption } = await supabase
    .from("reward_redemptions")
    .select("*")
    .eq("id", redemptionId)
    .eq("user_id", session.userId)
    .eq("status", "pending")
    .single();

  if (!redemption) {
    return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
  }

  await supabase.from("reward_redemptions").update({ status: "canceled" }).eq("id", redemptionId);

  return NextResponse.json({ ok: true });
}
