import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { createAdminServerClient } from "@/lib/supabase-admin-server";

/**
 * POST /api/admin/shops
 * 運営(operator)が新規店舗を登録する。
 * 併せて店舗管理者アカウント(Supabase Auth)を作成し、admins テーブルに紐付ける。
 *
 * body: {
 *   name, phone, businessHours, regularHoliday, saasPlan,
 *   adminEmail, adminPassword
 * }
 */
export async function POST(req: NextRequest) {
  const adminClient = createAdminServerClient();
  const { data: authUser } = await adminClient.auth.getUser();
  if (!authUser?.user) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  const { data: callerAdmin } = await supabase.from("admins").select("*").eq("id", authUser.user.id).single();
  if (!callerAdmin || callerAdmin.role !== "operator") {
    return NextResponse.json({ error: "運営権限が必要です" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.name || !body.adminEmail || !body.adminPassword) {
    return NextResponse.json({ error: "店舗名・管理者メール・パスワードは必須です" }, { status: 400 });
  }

  // 1. 店舗を作成
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .insert({
      name: body.name,
      phone: body.phone ?? null,
      business_hours: body.businessHours ?? null,
      regular_holiday: body.regularHoliday ?? null,
      saas_plan: body.saasPlan ?? "light",
      feature_subscription_enabled: body.featureSubscriptionEnabled ?? true,
      feature_waiting_enabled: body.featureWaitingEnabled ?? true,
    })
    .select()
    .single();

  if (shopError || !shop) {
    return NextResponse.json({ error: "店舗の作成に失敗しました" }, { status: 500 });
  }

  // 2. 店舗管理者用のSupabase Authユーザーを作成(Service Role Keyを使うため確認メール不要で即時作成)
  const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
    email: body.adminEmail,
    password: body.adminPassword,
    email_confirm: true,
  });

  if (authError || !newAuthUser?.user) {
    // 店舗だけ作られて管理者が作れない状態を避けるためロールバック
    await supabase.from("shops").delete().eq("id", shop.id);
    return NextResponse.json({ error: "管理者アカウントの作成に失敗しました" }, { status: 500 });
  }

  // 3. admins テーブルに紐付け
  const { error: adminInsertError } = await supabase.from("admins").insert({
    id: newAuthUser.user.id,
    role: "shop_admin",
    shop_id: shop.id,
    name: body.name,
  });

  if (adminInsertError) {
    return NextResponse.json({ error: "管理者情報の登録に失敗しました" }, { status: 500 });
  }

  // 4. LINE公式アカウントのチャネルアクセストークンが渡されていれば保存
  //    (後からリッチメニュー作成・通知送信で使用する。未入力の場合は後で店舗管理画面から設定可能)
  if (body.lineChannelAccessToken) {
    await supabase.from("shop_line_credentials").insert({
      shop_id: shop.id,
      channel_access_token: body.lineChannelAccessToken,
    });
  }

  return NextResponse.json({ shop });
}
