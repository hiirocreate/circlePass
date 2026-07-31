"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useShopId } from "@/lib/useShopId";
import { createBrowserSupabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import type { Shop, Subscription } from "@/types";

export default function HomePage() {
  const shopId = useShopId();
  const [shop, setShop] = useState<Shop | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [waiting, setWaiting] = useState<any>(null);

  useEffect(() => {
    if (!shopId) return;
    const supabase = createBrowserSupabase();

    supabase
      .from("shops")
      .select("*")
      .eq("id", shopId)
      .single()
      .then(({ data }) => {
        setShop(data);

        if (data?.feature_subscription_enabled) {
          fetch("/api/subscriptions")
            .then((r) => r.json())
            .then((d) => {
              const active = (d.subscriptions ?? []).find(
                (s: any) => s.shop_id === shopId && s.status === "active"
              );
              setSubscription(active ?? null);
            });
        }

        if (data?.feature_waiting_enabled) {
          fetch(`/api/waiting-list?shopId=${shopId}`)
            .then((r) => r.json())
            .then((d) => setWaiting(d.waiting));
        }
      });
  }, [shopId]);

  if (!shopId) {
    return <p className="p-6 text-sm text-black/60">店舗情報を読み込み中です…</p>;
  }

  return (
    <div className="space-y-4 p-4" style={{ ["--shop-accent-color" as any]: shop?.accent_color }}>
      <header className="flex items-center gap-3 py-2">
        {shop?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
        )}
        <h1 className="text-lg font-bold">{shop?.name ?? "店舗"}</h1>
      </header>

      {shop?.feature_subscription_enabled && (
        <Card>
          <p className="text-xs text-black/50">会員ランク</p>
          <p className="text-lg font-semibold text-accent">
            {subscription ? subscription.subscription_plans?.plan_name : "未加入"}
          </p>
          <Link href="/card" className="mt-3 block text-center text-sm font-semibold text-accent underline">
            会員証を見る
          </Link>
        </Card>
      )}

      {shop?.feature_waiting_enabled && (
        <Card>
          <p className="text-xs text-black/50">順番待ち状況</p>
          {waiting ? (
            <>
              <p className="text-lg font-semibold">
                受付番号 {waiting.waiting_number}番 ({waiting.status === "calling" ? "呼び出し中" : "待機中"})
              </p>
              <p className="text-sm text-black/60">目安待ち時間: 約{waiting.estimated_wait_minutes}分</p>
            </>
          ) : (
            <p className="text-sm text-black/60">現在、順番待ち登録はありません</p>
          )}
          <Link href="/waiting" className="mt-3 block text-center text-sm font-semibold text-accent underline">
            {waiting ? "詳細を見る" : "順番待ちに登録する"}
          </Link>
        </Card>
      )}

      {shop?.feature_subscription_enabled && (
        <Card>
          <p className="text-xs text-black/50">来店ポイント</p>
          <Link href="/points" className="mt-1 block text-center text-sm font-semibold text-accent underline">
            ポイント・特典交換を見る
          </Link>
        </Card>
      )}
    </div>
  );
}
