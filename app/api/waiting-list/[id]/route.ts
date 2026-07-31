import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { createAdminServerClient } from "@/lib/supabase-admin-server";
import { getSession } from "@/lib/session";
import { sendLineMessage, getShopLineToken } from "@/lib/line";

/**
 * PATCH /api/waiting-list/[id]
 * body: { action: "call" | "complete" | "cancel" | "next" }
 *
 * "call" | "complete" | "next" は店舗管理者(Supabase Auth)のみ実行可能。
 * "cancel" は本人(LINEセッション)または店舗管理者どちらからでも実行可能。
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { action } = await req.json();
  const supabase = createServiceSupabase();

  const { data: entry } = await supabase.from("waiting_lists").select("*, shops(*), users(line_id)").eq("id", params.id).single();
  if (!entry) {
    return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
  }

  const lineToken = await getShopLineToken(supabase, entry.shop_id);

  if (action === "cancel") {
    // 本人 or 店舗管理者のいずれか
    const userSession = await getSession();
    const isOwner = userSession?.userId === entry.user_id;

    if (!isOwner) {
      const adminClient = createAdminServerClient();
      const { data: authUser } = await adminClient.auth.getUser();
      if (!authUser?.user) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }
    }

    await supabase.from("waiting_lists").update({ status: "canceled" }).eq("id", params.id);

    const lineId = (entry as any).users?.line_id;
    if (lineId) {
      await sendLineMessage(lineId, `【${entry.shops.name}】順番待ちをキャンセルしました。`, lineToken);
    }
    return NextResponse.json({ ok: true });
  }

  // call / complete / next は店舗管理者のみ
  const adminClient = createAdminServerClient();
  const { data: authUser } = await adminClient.auth.getUser();
  if (!authUser?.user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const lineId = (entry as any).users?.line_id;

  if (action === "call") {
    await supabase.from("waiting_lists").update({ status: "calling", called_at: new Date().toISOString() }).eq("id", params.id);
    if (lineId) {
      await sendLineMessage(lineId, `【${entry.shops.name}】お呼び出しです。店舗スタッフの案内に従ってご入店ください。`, lineToken);
    }
  } else if (action === "complete") {
    await supabase.from("waiting_lists").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", params.id);
  } else if (action === "next") {
    // 次の順番へ進める = 現在の組を案内済みにする
    await supabase.from("waiting_lists").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", params.id);

    // 残り3組になったウェイティング客へ通知
    const { data: waitingGroups } = await supabase
      .from("waiting_lists")
      .select("*, users(line_id)")
      .eq("shop_id", entry.shop_id)
      .eq("status", "waiting")
      .order("waiting_number", { ascending: true })
      .limit(3);

    const third = waitingGroups?.[2];
    if (third && !third.notified_remaining_3) {
      const thirdLineId = (third as any).users?.line_id;
      if (thirdLineId) {
        await sendLineMessage(thirdLineId, `【${entry.shops.name}】残り3組です。ご準備をお願いします。`, lineToken);
      }
      await supabase.from("waiting_lists").update({ notified_remaining_3: true }).eq("id", third.id);
    }
  }

  return NextResponse.json({ ok: true });
}
