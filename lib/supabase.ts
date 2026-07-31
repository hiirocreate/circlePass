import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * ブラウザ(クライアントコンポーネント)用。
 * anon keyを使うため、RLSで許可された範囲のみアクセス可能。
 */
export function createBrowserSupabase(): SupabaseClient {
  return createClient(
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
