"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { useCurrentAdmin } from "@/lib/useCurrentAdmin";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";

const STATUS_LABEL: Record<string, string> = {
  waiting: "待機中",
  calling: "呼び出し中",
  completed: "案内済み",
  canceled: "キャンセル",
};

export default function ShopWaitingPage() {
  const { admin } = useCurrentAdmin();
  const [list, setList] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!admin?.shop_id) return;
    const supabase = createBrowserSupabase();
    const { data } = await supabase
      .from("waiting_lists")
      .select("*")
      .eq("shop_id", admin.shop_id)
      .in("status", ["waiting", "calling"])
      .order("waiting_number", { ascending: true });
    setList(data ?? []);
  }, [admin?.shop_id]);

  useEffect(() => {
    load();
    if (!admin?.shop_id) return;

    // 順番待ちはリアルタイム性が重要なため、Supabase Realtimeで即時反映する
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`waiting_lists_shop_${admin.shop_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waiting_lists", filter: `shop_id=eq.${admin.shop_id}` },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [admin?.shop_id, load]);

  const act = async (id: string, action: string) => {
    await fetch(`/api/waiting-list/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
  };

  return (
    <div className="space-y-3 p-4">
      <BackLink href="/dashboard" />
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">順番待ち管理</h1>
        <Button className="w-auto px-4 py-2" variant="outline" onClick={load}>
          更新
        </Button>
      </div>

      {list.length === 0 && <p className="text-sm text-black/50">現在、待機中のお客様はいません。</p>}

      {list.map((entry) => (
        <Card key={entry.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold">{entry.waiting_number}番 {entry.name}様</p>
            <span className="rounded-full bg-black/5 px-2 py-1 text-xs">{STATUS_LABEL[entry.status]}</span>
          </div>
          <p className="text-sm text-black/60">
            {entry.people_count}名 {entry.memo && `/ ${entry.memo}`}
          </p>
          <div className="flex gap-2">
            {entry.status === "waiting" && (
              <Button className="w-auto flex-1 px-3 py-2 text-xs" onClick={() => act(entry.id, "call")}>
                呼び出す
              </Button>
            )}
            {entry.status === "calling" && (
              <Button className="w-auto flex-1 px-3 py-2 text-xs" onClick={() => act(entry.id, "next")}>
                案内完了(次へ)
              </Button>
            )}
            <Button
              className="w-auto flex-1 px-3 py-2 text-xs"
              variant="danger"
              onClick={() => act(entry.id, "cancel")}
            >
              キャンセル
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}