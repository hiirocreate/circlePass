"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithLiff } from "@/lib/liff";

export default function EntryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await loginWithLiff();
        const search = typeof window !== "undefined" ? window.location.search : "";
        router.replace(`/home${search}`);
      } catch (e) {
        console.error(e);
        setError("ログインに失敗しました。時間をおいて再度お試しください。");
      }
    })();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black" />
          <p className="text-sm text-black/60">LINEでログイン中です…</p>
        </>
      )}
    </div>
  );
}
