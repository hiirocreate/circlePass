"use client";

import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useShopId } from "@/lib/useShopId";
import { createBrowserSupabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function PointsPage() {
  const shopId = useShopId();
  const [shop, setShop] = useState<any>(null);
  const [points, setPoints] = useState(0);
  const [rewards, setRewards] = useState<any[]>([]);
  const [pending, setPending] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    const res = await fetch(`/api/rewards?shopId=${shopId}`);
    const d = await res.json();
    setPoints(d.points ?? 0);
    setRewards(d.rewards ?? []);
    setPending(d.pendingRedemption ?? null);
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    const supabase = createBrowserSupabase();
    supabase
      .from("shops")
      .select("feature_subscription_enabled")
      .eq("id", shopId)
      .single()
      .then(({ data }) => setShop(data));
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const redeem = async (rewardId: string) => {
    if (!shopId) return;
    setLoading(true);
    const res = await fetch("/api/rewards/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId, rewardId }),
    });
    const d = await res.json();
    if (d.error) {
      alert(d.error);
    } else {
      await load();
    }
    setLoading(false);
  };

  const cancelPending = async () => {
    if (!pending) return;
    setLoading(true);
    await fetch("/api/rewards/redeem", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redemptionId: pending.id }),
    });
    await load();
    setLoading(false);
  };

  if (!shopId) return null;

  if (shop && !shop.feature_subscription_enabled) {
    return (
      <div className="p-4">
        <p className="text-sm text-black/50">この店舗では来店ポイント機能はご利用いただけません。</p>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-lg font-bold">特典交換</h1>
        <Card className="bg-black text-white">
          <p className="text-xs text-white/60">交換内容</p>
          <p className="mt-1 text-xl font-bold">{pending.point_rewards?.reward_description}</p>
          <p className="text-xs text-white/60">使用ポイント: {pending.points_used}pt</p>
          <div className="mt-4 flex justify-center rounded-xl bg-white p-4">
            <QRCodeSVG value={JSON.stringify({ redemptionId: pending.id })} size={160} />
          </div>
          <p className="mt-3 text-center text-xs text-white/60">
            店舗スタッフにこのQRコードを読み取ってもらってください
          </p>
        </Card>
        <Button variant="outline" onClick={cancelPending} disabled={loading}>
          申請をキャンセルする
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-bold">来店ポイント</h1>
      <Card className="text-center">
        <p className="text-xs text-black/50">保有ポイント</p>
        <p className="text-3xl font-bold text-accent">{points}pt</p>
      </Card>

      <p className="text-sm font-semibold">交換できる特典</p>
      <div className="space-y-2">
        {rewards.map((r) => {
          const enough = points >= r.required_points;
          return (
            <Card key={r.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{r.reward_description}</p>
                <p className="text-sm text-black/60">必要ポイント: {r.required_points}pt</p>
              </div>
              <Button
                className="w-auto px-3 py-2 text-xs"
                onClick={() => redeem(r.id)}
                disabled={!enough || loading}
              >
                交換する
              </Button>
            </Card>
          );
        })}
        {rewards.length === 0 && <p className="text-sm text-black/40">現在交換できる特典はありません</p>}
      </div>
    </div>
  );
}
