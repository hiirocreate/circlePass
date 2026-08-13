import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { createAdminServerClient } from "@/lib/supabase-admin-server";

async function requireOperator() {
  const adminClient = createAdminServerClient();
  const { data: authUser } = await adminClient.auth.getUser();
  if (!authUser?.user) return { error: "権限がありません", status: 403 } as const;

  const supabase = createServiceSupabase();
  const { data: callerAdmin } = await supabase.from("admins").select("*").eq("id", authUser.user.id).single();
  if (!callerAdmin || callerAdmin.role !== "operator") {
    return { error: "運営権限が必要です", status: 403 } as const;
  }
  return { supabase } as const;
}

/**
 * GET /api/admin/shop-admins?shopId=xxx
 * 指定店舗に紐づく店舗管理者アカウント(メールアドレス等)の一覧を返す。
 */
export async function GET(req: NextRequest) {
  const resolved = await requireOperator();
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { supabase } = resolved;

  const shopId = req.nextUrl.searchParams.get("shopId");
  if (!shopId) return NextResponse.json({ error: "shopIdが必要です" }, { status: 400 });

  const { data: adminRows } = await supabase
    .from("admins")
    .select("id, name")
    .eq("shop_id", shopId)
    .eq("role", "shop_admin");

  if (!adminRows || adminRows.length === 0) {
    return NextResponse.json({ admins: [] });
  }

  // Supabase AuthのUserオブジェクト(メールアドレス)を1件ずつ取得して付加する
  const admins = [];
  for (const row of adminRows) {
    const { data: authUserData } = await supabase.auth.admin.getUserById(row.id);
    admins.push({ id: row.id, name: row.name, email: authUserData?.user?.email ?? "(不明)" });
  }

  return NextResponse.json({ admins });
}

/**
 * PATCH /api/admin/shop-admins
 * body: { adminId, email?, password? }
 * 店舗管理者のログイン情報(メールアドレス・パスワード)を運営が変更する。
 * どちらか一方だけの変更も可能。
 */
export async function PATCH(req: NextRequest) {
  const resolved = await requireOperator();
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { supabase } = resolved;

  const { adminId, email, password } = await req.json();
  if (!adminId) return NextResponse.json({ error: "adminIdが必要です" }, { status: 400 });
  if (!email && !password) {
    return NextResponse.json({ error: "メールアドレスかパスワードのいずれかを入力してください" }, { status: 400 });
  }

  const updatePayload: { email?: string; password?: string } = {};
  if (email) updatePayload.email = email;
  if (password) updatePayload.password = password;

  const { error } = await supabase.auth.admin.updateUserById(adminId, updatePayload);
  if (error) {
    return NextResponse.json({ error: `更新に失敗しました: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}