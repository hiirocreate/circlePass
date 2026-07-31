"use client";

import { useEffect, useState } from "react";
import { useShopId } from "@/lib/useShopId";
import { createBrowserSupabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function WaitingPage() {
  const shopId = useShopId();
  const [shop, setShop] = useState<any>(null);
  const [waiting, setWaiting] = useState<any>(null);
  const [peopleCount, setPeopleCount] = useState(2);
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!shopId) return;
    const res = await fetch(`/api/waiting-list?shopId=${shopId}`);
    const d = await res.json();
    setWaiting(d.waiting);
  };

  useEffect(() => {
    if (!shopId) return;
    const supabase = createBrowserSupabase();
    supabase
      .from("shops")
      .select("feature_waiting_enabled")
      .eq("id", shopId)
      .single()
      .then(({ data }) => setShop(data));
  }, [shopId]);

  useEffect(() => {
    load();
    // LINEユーザーはSupabase Authを使わないためRealtimeのRLS対象にできない。
    // 呼び出し等の変化に素早く気づけるよう短い間隔でポーリングする。
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, [shopId]);

  const register = async () => {
    if (!name) return alert("お名前を入力してください");
    setLoading(true);
    const res = await fetch("/api/waiting-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId, peopleCount, name, memo }),
    });
    const d = await res.json();
    if (d.error) {
      alert(d.error);
    } else {
      setWaiting(d.waiting);
    }
    setLoading(false);
  };

  const cancel = async () => {
    if (!waiting) return;
    if (!confirm("順番待ちをキャンセルしますか?")) return;
    setLoading(true);
    await fetch(`/api/waiting-list/${waiting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    setWaiting(null);
    setLoading(false);
  };

  if (!shopId) return null;

  if (shop && !shop.feature_waiting_enabled) {
    return (
      <div className="p-4">
        <p className="text-sm text-black/50">この店舗では順番待ちシステムはご利用いただけません。</p>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-lg font-bold">順番待ち状況</h1>
        <Card className="text-center">
          <p className="text-xs text-black/50">受付番号</p>
          <p className="text-4xl font-bold text-accent">{waiting.waiting_number}</p>
          <p className="mt-2 text-sm text-black/60">
            状態: {waiting.status === "calling" ? "呼び出し中です" : "待機中"}
          </p>
          <p className="text-sm text-black/60">目安待ち時間: 約{waiting.estimated_wait_minutes}分</p>
          <p className="mt-1 text-xs text-black/40">人数: {waiting.people_count}名</p>
        </Card>
        <Button variant="danger" onClick={cancel} disabled={loading}>
          キャンセルする
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-bold">順番待ち登録</h1>
      <Card className="space-y-3">
        <div>
          <label className="text-xs text-black/50">お名前</label>
          <input
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="山田 太郎"
          />
        </div>
        <div>
          <label className="text-xs text-black/50">人数</label>
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            value={peopleCount}
            onChange={(e) => setPeopleCount(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="text-xs text-black/50">備考(任意)</label>
          <input
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="ベビーカーあり、など"
          />
        </div>
      </Card>
      <Button onClick={register} disabled={loading}>
        登録する
      </Button>
    </div>
  );
}
