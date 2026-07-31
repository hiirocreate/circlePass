import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { createAdminServerClient } from "@/lib/supabase-admin-server";

/**
 * GET /api/rewards/redeem/[id]
 * 店舗側がQRコードを読み取った直後に、交換内容(特典名・必要ポイント・利用者名)を
 * 確認表示するために呼ぶ。
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const adminClient = createAdminServerClient();
  const { data: authUser } = await adminClient.auth.getUser();
  if (!authUser?.user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  const { data: redemption } = await supabase
    .from("reward_redemptions")
    .select("*, point_rewards(reward_description, required_points), users(name)")
    .eq("id", params.id)
    .single();

  if (!redemption) {
    return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ redemption });
}
