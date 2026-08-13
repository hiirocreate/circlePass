"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Props = {
  /** 未指定の場合、店舗管理者は自店舗が対象になる。運営が代理操作する場合に指定する */
  shopId?: string;
};

const PRESET_COLORS = [
  { label: "オレンジ(標準)", value: "#EA580C" },
  { label: "ゴールド", value: "#C9A227" },
  { label: "グリーン", value: "#16A34A" },
  { label: "ブルー", value: "#2563EB" },
  { label: "ピンク", value: "#DB2777" },
];

export function ThemeColorView({ shopId }: Props) {
  const [current, setCurrent] = useState<string | null>(null);
  const [draft, setDraft] = useState("#EA580C");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    const res = await fetch(`/api/shop/settings?shopId=${shopId}`);
    const d = await res.json();
    setCurrent(d.accentColor);
    setDraft(d.accentColor);
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (color: string) => {
    setLoading(true);
    const res = await fetch("/api/shop/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId, accentColor: color }),
    });
    const d = await res.json();
    if (d.error) {
      alert(d.error);
    } else {
      await load();
    }
    setLoading(false);
  };

  if (current === null) return <p className="text-sm text-black/50">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <p className="text-xs text-black/50">現在のテーマカラー</p>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border border-black/10" style={{ backgroundColor: current }} />
          <p className="text-sm font-semibold">{current}</p>
        </div>
        <p className="text-xs text-black/40">
          利用者アプリ(会員証・順番待ち・来店ポイント画面)の見出しや金額表示などに使われます。
        </p>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-semibold">プリセットから選ぶ</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => save(p.value)}
              disabled={loading}
              className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs"
            >
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: p.value }} />
              {p.label}
            </button>
          ))}
        </div>

        <p className="pt-2 text-sm font-semibold">カスタムカラー</p>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-10 w-14 rounded border border-black/10"
          />
          <input
            className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="#EA580C"
          />
          <Button className="w-auto px-4 py-2 text-xs" onClick={() => save(draft)} disabled={loading}>
            保存
          </Button>
        </div>
      </Card>
    </div>
  );
}
