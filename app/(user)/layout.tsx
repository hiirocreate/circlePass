"use client";

import { useEffect, useState } from "react";
import { loginWithLiff } from "@/lib/liff";

/**
 * (user)グループ配下(/home, /card, /waiting, /points)は、
 * リッチメニューや直接リンクから個別ページへ直接アクセスされることがある。
 * ログイン処理(LIFF初期化 + セッションCookie発行)を、トップページ(/)だけでなく
 * ここでも必ず行うことで、どのページから入ってもログイン済みの状態を保証する。
 */
export default function UserLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    (async () => {
      try {
        await loginWithLiff();
        setStatus("ready");
      } catch (e) {
        console.error(e);
        setStatus("error");
      }
    })();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black" />
        <p className="text-sm text-black/60">LINEでログイン中です…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-red-600">
          ログインに失敗しました。時間をおいて再度お試しください。
        </p>
      </div>
    );
  }

  return <>{children}</>;
}