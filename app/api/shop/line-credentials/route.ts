import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { createAdminServerClient } from "@/lib/supabase-admin-server";

async function resolveShopId(req: NextRequest, supabase: ReturnType<typeof createServiceSupabase>) {
  const adminClient = createAdminServerClient();
  const { data: authUser } = await adminClient.auth.getUser();
  if (!authUser?.user) return { error: "権限がありません", status: 403 } as const;

  const { data: callerAdmin } = await supabase.from("admins").select("*").eq("id", authUser.user.id).single();
  if (!callerAdmin) return { error: "管理者情報が見つかりません", status: 403 } as const;

  return { callerAdmin } as const;
}

/**
 * GET /api/shop/line-credentials?shopId=xxx(運営のみ指定可)
 * トークンの値そのものは返さず、登録済みかどうかだけ返す(漏洩防止)。
 */
export async function GET(req: NextRequest) {
  const supabase = createServiceSupabase();
  const resolved = await resolveShopId(req, supabase);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const { callerAdmin } = resolved;
  const shopId = callerAdmin.role === "operator" ? req.nextUrl.searchParams.get("shopId") : callerAdmin.shop_id;
  if (!shopId) return NextResponse.json({ error: "shopIdが必要です" }, { status: 400 });

  const { data } = await supabase
    .from("shop_line_credentials")
    .select("shop_id")
    .eq("shop_id", shopId)
    .maybeSingle();

  return NextResponse.json({ hasToken: !!data });
}

/**
 * POST /api/shop/line-credentials
 * body: { shopId(運営のみ), token }
 * 登録済みなら上書き、未登録なら新規作成する。
 */
export async function POST(req: NextRequest) {
  const supabase = createServiceSupabase();
  const resolved = await resolveShopId(req, supabase);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const { callerAdmin } = resolved;
  const body = await req.json();
  const shopId = callerAdmin.role === "operator" ? body.shopId : callerAdmin.shop_id;
  if (!shopId) return NextResponse.json({ error: "shopIdが必要です" }, { status: 400 });

  const token = (body.token as string)?.trim();
  if (!token) return NextResponse.json({ error: "トークンを入力してください" }, { status: 400 });

  const { error } = await supabase
    .from("shop_line_credentials")
    .upsert({ shop_id: shopId, channel_access_token: token }, { onConflict: "shop_id" });

  if (error) return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });

  return NextResponse.json({ ok: true });
}