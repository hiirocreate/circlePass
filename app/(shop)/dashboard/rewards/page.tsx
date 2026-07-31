"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { useCurrentAdmin } from "@/lib/useCurrentAdmin";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ShopRewardsPage() {
  const { admin } = useCurrentAdmin();
  const [rewards, setRewards] = useState<any[]>([]);
  const [form, setForm] = useState({ requiredPoints: 10, rewardDescription: "" });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!admin?.shop_id) return;
    const supabase = createBrowserSupabase();
    const { data } = await supabase
      .from("point_rewards")
      .select("*")
      .eq("shop_id", admin.shop_id)
      .order("required_points", { ascending: true });
    setRewards(data ?? []);
  }, [admin?.shop_id]);

  useEffect(() => {
    load();
  }, [load]);

  const createReward = async () => {
    if (!admin?.shop_id || !form.rewardDescription) return;
    setLoading(true);
    const supabase = createBrowserSupabase();
    await supabase.from("point_rewards").insert({
      shop_id: admin.shop_id,
      required_points: Number(form.requiredPoints),
      reward_description: form.rewardDescription,
    });
    setForm({ requiredPoints: 10, rewardDescription: "" });
    await load();
    setLoading(false);
  };

  const toggleActive = async (rewardId: string, isActive: boolean) => {
    const supabase = createBrowserSupabase();
    await supabase.from("point_rewards").update({ is_active: !isActive }).eq("id", rewardId);
    await load();
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-bold">特典交換ルール管理</h1>
      <p className="text-sm text-black/50">来店ポイントと交換できる特典を設定します。</p>

      <Card className="space-y-2">
        <p className="text-sm font-semibold">新規特典追加</p>
        <input
          type="number"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="必要ポイント"
          value={form.requiredPoints}
          onChange={(e) => setForm({ ...form, requiredPoints: Number(e.target.value) })}
        />
        <input
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="特典内容(例: ドリンク1杯無料)"
          value={form.rewardDescription}
          onChange={(e) => setForm({ ...form, rewardDescription: e.target.value })}
        />
        <Button onClick={createReward} disabled={loading || !form.rewardDescription}>
          追加する
        </Button>
      </Card>

      <div className="space-y-2">
        {rewards.map((r) => (
          <Card key={r.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{r.reward_description}</p>
              <p className="text-sm text-black/60">必要ポイント: {r.required_points}pt</p>
            </div>
            <Button
              className="w-auto px-3 py-2 text-xs"
              variant={r.is_active ? "outline" : "primary"}
              onClick={() => toggleActive(r.id, r.is_active)}
            >
              {r.is_active ? "公開中" : "非公開"}
            </Button>
          </Card>
        ))}
        {rewards.length === 0 && <p className="text-sm text-black/40">まだ特典が登録されていません</p>}
      </div>
    </div>
  );
}
