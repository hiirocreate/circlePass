"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";

export default function ShopLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("ログインに失敗しました。メールアドレスとパスワードをご確認ください。");
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <div className="flex min-h-screen flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold">店舗管理画面ログイン</h1>
      <input
        className="rounded-lg border border-black/10 px-3 py-2 text-sm"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="rounded-lg border border-black/10 px-3 py-2 text-sm"
        placeholder="パスワード"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={login} disabled={loading}>
        ログイン
      </Button>
    </div>
  );
}
