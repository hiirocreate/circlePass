"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";

const STATUS_LABEL: Record<string, string> = { paid: "成功", failed: "失敗" };

type Props = {
  /** 未指定(undefined)の場合、店舗管理者は自店舗、運営は全店舗合算を表示する */
  shopId?: string;
  /** 運営画面で店舗別の内訳を表示したい場合に true */
  showShopBreakdown?: boolean;
};

export function SalesView({ shopId, showShopBreakdown }: Props) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = shopId ? `?shopId=${shopId}` : "";
    const res = await fetch(`/api/shop/sales${params}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-black/50">読み込み中…</p>;
  if (!data || data.error) return <p className="text-sm text-red-600">{data?.error ?? "取得に失敗しました"}</p>;

  const shopRevenue = new Map<string, number>();
  if (showShopBreakdown) {
    for (const p of data.payments) {
      if (p.status !== "paid") continue;
      shopRevenue.set(p.shopName, (shopRevenue.get(p.shopName) ?? 0) + p.amount);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs text-black/50">今月の売上</p>
        <p className="text-2xl font-bold">{data.currentMonth.revenue.toLocaleString()}円</p>
        <p className="text-xs text-black/40">
          成功 {data.currentMonth.paidCount}件 / 失敗 {data.currentMonth.failedCount}件
        </p>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-semibold">月別売上推移(直近1年)</p>
        <div className="space-y-1">
          {data.monthly.map((m: any) => {
            const max = Math.max(...data.monthly.map((x: any) => x.revenue), 1);
            return (
              <div key={m.month} className="flex items-center gap-2 text-xs">
                <span className="w-14 text-black/50">{m.month}</span>
                <div className="h-3 flex-1 rounded bg-black/5">
                  <div
                    className="h-3 rounded bg-accent"
                    style={{ width: `${Math.max((m.revenue / max) * 100, m.revenue > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="w-20 text-right font-medium">{m.revenue.toLocaleString()}円</span>
              </div>
            );
          })}
          {data.monthly.length === 0 && <p className="text-xs text-black/40">データがありません</p>}
        </div>
      </Card>

      {showShopBreakdown && shopRevenue.size > 0 && (
        <Card>
          <p className="mb-2 text-sm font-semibold">今月の店舗別売上内訳</p>
          <div className="space-y-1">
            {Array.from(shopRevenue.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([name, revenue]) => (
                <div key={name} className="flex justify-between text-sm">
                  <span>{name}</span>
                  <span className="font-medium">{revenue.toLocaleString()}円</span>
                </div>
              ))}
          </div>
        </Card>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold">決済履歴</p>
        <div className="space-y-2">
          {data.payments.map((p: any) => (
            <Card key={p.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {p.planName} {showShopBreakdown && `/ ${p.shopName}`}
                </p>
                <p className="text-xs text-black/40">
                  {p.userName} ・ {(p.paidAt ?? p.createdAt)?.slice(0, 10)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{p.amount.toLocaleString()}円</p>
                <p className={`text-xs ${p.status === "paid" ? "text-black/40" : "text-red-600"}`}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </p>
              </div>
            </Card>
          ))}
          {data.payments.length === 0 && <p className="text-sm text-black/40">決済履歴はまだありません</p>}
        </div>
      </div>
    </div>
  );
}
