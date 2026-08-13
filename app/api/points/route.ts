import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { createAdminServerClient } from "@/lib/supabase-admin-server";
import { checkPlanAvailability } from "@/lib/plan-availability";

/**
 * POST /api/points
 * 店舗側がQRコードを読み取った後に呼び出す。
 * body:
 *   { userId, shopId, usedType: "drink_free"|"all_you_can_drink"|"other", subscriptionId? }
 *   または
 *   { subscriptionId, shopId, usedType: "visit_point" } -- 来店ポイント付与(会員証QRから)
 *   または
 *   { shopId, usedType: "reward_complete", redemptionId } -- 特典交換の完了処理
 */
export async function POST(req: NextRequest) {
  const adminClient = createAdminServerClient();
  const { data: authUser } = await adminClient.auth.getUser();
  if (!authUser?.user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { userId, shopId, usedType, subscriptionId, redemptionId, memo } = await req.json();
  const supabase = createServiceSupabase();

  if (usedType === "visit_point") {
    // 会員証のQRには subscriptionId しか載っていないため、そこから利用者を特定する
    let targetUserId = userId;
    if (!targetUserId && subscriptionId) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("id", subscriptionId)
        .single();
      targetUserId = sub?.user_id;
    }
    if (!targetUserId) {
      return NextResponse.json({ error: "利用者を特定できませんでした" }, { status: 400 });
    }

    // 来店1回=1ポイント(店舗ごとに将来カスタマイズ可能な設計)
    const { data: pointHistory } = await supabase
      .from("point_histories")
      .insert({
        user_id: targetUserId,
        shop_id: shopId,
        point: 1,
        description: "来店ポイント",
      })
      .select()
      .single();

    const { data: membership } = await supabase
      .from("user_shop_memberships")
      .select("*")
      .eq("user_id", targetUserId)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (membership) {
      await supabase
        .from("user_shop_memberships")
        .update({ points: membership.points + 1 })
        .eq("id", membership.id);
    } else {
      await supabase.from("user_shop_memberships").insert({ user_id: targetUserId, shop_id: shopId, points: 1 });
    }

    return NextResponse.json({ ok: true, undo: pointHistory ? { type: "visit_point", id: pointHistory.id } : null });
  }

  if (usedType === "reward_complete") {
    // 特典交換の完了処理: 申請(pending)を確認し、ここで初めてポイントを減算する
    if (!redemptionId) {
      return NextResponse.json({ error: "redemptionIdが必要です" }, { status: 400 });
    }

    const { data: redemption } = await supabase
      .from("reward_redemptions")
      .select("*")
      .eq("id", redemptionId)
      .eq("shop_id", shopId)
      .eq("status", "pending")
      .single();

    if (!redemption) {
      return NextResponse.json({ error: "申請中の特典交換が見つかりません" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("user_shop_memberships")
      .select("*")
      .eq("user_id", redemption.user_id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (!membership || membership.points < redemption.points_used) {
      return NextResponse.json({ error: "ポイントが不足しています" }, { status: 400 });
    }

    await supabase
      .from("user_shop_memberships")
      .update({ points: membership.points - redemption.points_used })
      .eq("id", membership.id);

    await supabase.from("point_histories").insert({
      user_id: redemption.user_id,
      shop_id: shopId,
      point: -redemption.points_used,
      description: "特典交換",
    });

    await supabase
      .from("reward_redemptions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", redemptionId);

    return NextResponse.json({ ok: true });
  }

  // サブスク特典の利用(ドリンク無料など)
  if (!subscriptionId) {
    return NextResponse.json({ error: "subscriptionIdが必要です" }, { status: 400 });
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*, subscription_plans(*)")
    .eq("id", subscriptionId)
    .eq("status", "active")
    .single();

  if (!sub) {
    return NextResponse.json({ error: "有効な契約が見つかりません" }, { status: 404 });
  }

  const plan = (sub as any).subscription_plans;

  // 利用可能曜日・時間帯チェック(店舗側で設定した範囲外は利用不可)
  const availability = checkPlanAvailability(plan);
  if (!availability.ok) {
    return NextResponse.json({ error: availability.reason }, { status: 400 });
  }

  // 利用回数上限チェック
  if (plan.usage_limit) {
    const periodStart = new Date();
    periodStart.setDate(1);
    const { count } = await supabase
      .from("subscription_histories")
      .select("*", { count: "exact", head: true })
      .eq("subscription_id", subscriptionId)
      .gte("created_at", periodStart.toISOString());

    if ((count ?? 0) >= plan.usage_limit) {
      return NextResponse.json({ error: "今月の利用回数上限に達しています" }, { status: 400 });
    }
  }

  const { data: history } = await supabase
    .from("subscription_histories")
    .insert({
      subscription_id: subscriptionId,
      used_type: usedType,
      memo: memo ?? null,
    })
    .select()
    .single();

  return NextResponse.json({ ok: true, undo: history ? { type: "subscription_history", id: history.id } : null });
}

/**
 * DELETE /api/points
 * body: { type: "visit_point"|"subscription_history", id }
 *
 * 直前の操作を取り消す(誤操作の救済用)。取り消せる期間はあえて制限していないが、
 * QR画面では直後の1回分のみUIから取り消せるようにしている。
 */
export async function DELETE(req: NextRequest) {
  const adminClient = createAdminServerClient();
  const { data: authUser } = await adminClient.auth.getUser();
  if (!authUser?.user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { type, id } = await req.json();
  const supabase = createServiceSupabase();

  if (type === "visit_point") {
    const { data: history } = await supabase.from("point_histories").select("*").eq("id", id).single();
    if (!history) return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });

    const { data: membership } = await supabase
      .from("user_shop_memberships")
      .select("*")
      .eq("user_id", history.user_id)
      .eq("shop_id", history.shop_id)
      .maybeSingle();

    if (membership) {
      await supabase
        .from("user_shop_memberships")
        .update({ points: Math.max(0, membership.points - history.point) })
        .eq("id", membership.id);
    }
    await supabase.from("point_histories").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (type === "subscription_history") {
    await supabase.from("subscription_histories").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
}
