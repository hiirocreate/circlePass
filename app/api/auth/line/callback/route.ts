import { NextRequest, NextResponse } from "next/server";
import { verifyLineIdToken } from "@/lib/line";
import { createServiceSupabase } from "@/lib/supabase";
import { createSession } from "@/lib/session";

/**
 * POST /api/auth/line/callback
 * body: { idToken: string }
 *
 * LIFFでログイン後、フロントから id_token を送る。
 * 初回アクセスのユーザーは users テーブルへ自動登録する。
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: "idTokenが必要です" }, { status: 400 });
    }

    const profile = await verifyLineIdToken(idToken);
    const supabase = createServiceSupabase();

    // 既存ユーザー確認
    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("line_id", profile.sub)
      .maybeSingle();

    let userId: string;

    if (existing) {
      userId = existing.id;
    } else {
      // 初回のみ名前・アイコンを登録
      const { data: created, error } = await supabase
        .from("users")
        .insert({
          line_id: profile.sub,
          name: profile.name ?? "ゲスト",
          icon_url: profile.picture ?? null,
        })
        .select()
        .single();

      if (error || !created) {
        throw error ?? new Error("ユーザー登録に失敗しました");
      }
      userId = created.id;
    }

    await createSession({ userId, lineId: profile.sub });

    return NextResponse.json({ ok: true, userId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "ログインに失敗しました" }, { status: 500 });
  }
}
