"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Props = {
  /** 未指定の場合、店舗管理者は自店舗が対象になる。運営が代理操作する場合に指定する */
  shopId?: string;
};

export function LineCredentialsView({ shopId }: Props) {
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    const res = await fetch(`/api/shop/line-credentials?shopId=${shopId}`);
    const d = await res.json();
    setHasToken(!!d.hasToken);
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!token.trim()) {
      alert("トークンを入力してください");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/shop/line-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId, token }),
    });
    const d = await res.json();
    if (d.error) {
      alert(d.error);
    } else {
      setToken("");
      await load();
      alert("保存しました");
    }
    setLoading(false);
  };

  if (hasToken === null) return <p className="text-sm text-black/50">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs text-black/50">登録状況</p>
        <p className="text-lg font-semibold">
          {hasToken ? "登録済み(通知を送信できます)" : "未登録(通知は送信されません)"}
        </p>
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-semibold">{hasToken ? "トークンを変更する" : "トークンを登録する"}</p>
        <p className="text-xs text-black/50">
          LINE Developers Console → 該当のMessaging APIチャネル →「Messaging API設定」タブ →
          「チャネルアクセストークン(長期)」の「発行」から取得できます。
        </p>
        <input
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="チャネルアクセストークンを貼り付け"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Button onClick={save} disabled={loading}>
          保存する
        </Button>
      </Card>
    </div>
  );
}