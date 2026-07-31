import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

/**
 * ブラウザ(クライアントコンポーネント)用。
 * anon keyを使うため、RLSで許可された範囲のみアクセス可能。
 *
 * 店舗管理者・運営のログインセッションは middleware.ts や
 * lib/supabase-admin-server.ts がCookie経由で読み取る仕組みのため、
 * ここは(localStorageに保存する通常のsupabase-jsクライアントではなく)
 * Cookieにセッションを保存する @supabase/ssr の createBrowserClient を使う。
 */
export function createBrowserSupabase(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * サーバー(API Route)用。Service Role Keyを使うためRLSを迂回できる。
 * LINEユーザーはSupabase Authを使わず独自セッション管理のため、
 * users/subscriptions等のuser向けテーブル操作はすべてこのクライアントで
 * サーバー側から行い、必ず自前で権限チェックを行うこと。
 */
export function createServiceSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
