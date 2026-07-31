import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 管理画面(運営 / 店舗管理者)のログインはSupabase Authのメール+パスワードを利用する。
 * このクライアントはCookie経由でAuthセッションを読み取り、RLSが適用された状態で
 * admins/shops等のテーブルにアクセスするために使う。
 */
export function createAdminServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}
