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
 * GET /api/shop/settings?shopId=xxx(運営のみ指定可)
 * 店舗の現在のテーマカラーを返す。
 */
export async function GET(req: NextRequest) {
  const supabase = createServiceSupabase();
  const resolved = await resolveShopId(req, supabase);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const { callerAdmin } = resolved;
  const shopId = callerAdmin.role === "operator" ? req.nextUrl.searchParams.get("shopId") : callerAdmin.shop_id;
  if (!shopId) return NextResponse.json({ error: "shopIdが必要です" }, { status: 400 });

  const { data } = await supabase.from("shops").select("accent_color").eq("id", shopId).single();
  return NextResponse.json({ accentColor: data?.accent_color ?? "#EA580C" });
}

/**
 * PATCH /api/shop/settings
 * body: { shopId(運営のみ), accentColor }
 * 店舗のテーマカラーを変更する。
 */
export async function PATCH(req: NextRequest) {
  const supabase = createServiceSupabase();
  const resolved = await resolveShopId(req, supabase);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const { callerAdmin } = resolved;
  const body = await req.json();
  const shopId = callerAdmin.role === "operator" ? body.shopId : callerAdmin.shop_id;
  if (!shopId) return NextResponse.json({ error: "shopIdが必要です" }, { status: 400 });

  const accentColor = (body.accentColor as string)?.trim();
  if (!accentColor || !/^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
    return NextResponse.json({ error: "色は #RRGGBB の形式で指定してください" }, { status: 400 });
  }

  const { error } = await supabase.from("shops").update({ accent_color: accentColor }).eq("id", shopId);
  if (error) return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
