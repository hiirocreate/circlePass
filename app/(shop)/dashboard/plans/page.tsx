"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { useCurrentAdmin } from "@/lib/useCurrentAdmin";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const DAY_OPTIONS = [
  { key: "mon", label: "月" },
  { key: "tue", label: "火" },
  { key: "wed", label: "水" },
  { key: "thu", label: "木" },
  { key: "fri", label: "金" },
  { key: "sat", label: "土" },
  { key: "sun", label: "日" },
];

export default function ShopPlansPage() {
  const { admin } = useCurrentAdmin();
  const [plans, setPlans] = useState<any[]>([]);
  const [form, setForm] = useState({
    planName: "",
    price: 2980,
    description: "",
    usageLimit: "",
    availableDays: [] as string[],
    availableTimeStart: "",
    availableTimeEnd: "",
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!admin?.shop_id) return;
    const supabase = createBrowserSupabase();
    const { data } = await supabase.from("subscription_plans").select("*").eq("shop_id", admin.shop_id);
    setPlans(data ?? []);
  }, [admin?.shop_id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDay = (key: string) => {
    setForm((f) => ({
      ...f,
      availableDays: f.availableDays.includes(key)
        ? f.availableDays.filter((d) => d !== key)
        : [...f.availableDays, key],
    }));
  };

  const createPlan = async () => {
    setLoading(true);
    const res = await fetch("/api/shop/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planName: form.planName,
        price: Number(form.price),
        description: form.description,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        availableDays: form.availableDays.length > 0 ? form.availableDays : null,
        availableTimeStart: form.availableTimeStart || null,
        availableTimeEnd: form.availableTimeEnd || null,
      }),
    });
    const d = await res.json();
    if (d.error) alert(d.error);
    setForm({
      planName: "",
      price: 2980,
      description: "",
      usageLimit: "",
      availableDays: [],
      availableTimeStart: "",
      availableTimeEnd: "",
    });
    await load();
    setLoading(false);
  };

  const toggleActive = async (planId: string, isActive: boolean) => {
    const supabase = createBrowserSupabase();
    await supabase.from("subscription_plans").update({ is_active: !isActive }).eq("id", planId);
    await load();
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-bold">サブスクプラン管理</h1>

      <Card className="space-y-2">
        <p className="text-sm font-semibold">新規プラン作成</p>
        <input
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="プラン名(例: スタンダード)"
          value={form.planName}
          onChange={(e) => setForm({ ...form, planName: e.target.value })}
        />
        <input
          type="number"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="月額料金(円)"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
        />
        <input
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="特典内容(例: ドリンク1杯無料)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          type="number"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="月間利用回数上限(空欄で無制限)"
          value={form.usageLimit}
          onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
        />
        <div>
          <p className="mb-1 text-xs text-black/50">利用可能曜日(未選択なら制限なし)</p>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleDay(d.key)}
                className={`h-8 w-8 rounded-full text-xs font-semibold ${
                  form.availableDays.includes(d.key) ? "bg-black text-white" : "bg-black/5 text-black/60"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs text-black/50">利用可能時間帯(未入力なら制限なし)</p>
          <div className="flex items-center gap-2">
            <input
              type="time"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
              value={form.availableTimeStart}
              onChange={(e) => setForm({ ...form, availableTimeStart: e.target.value })}
            />
            <span className="text-black/40">〜</span>
            <input
              type="time"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
              value={form.availableTimeEnd}
              onChange={(e) => setForm({ ...form, availableTimeEnd: e.target.value })}
            />
          </div>
        </div>
        <Button onClick={createPlan} disabled={loading || !form.planName}>
          作成する
        </Button>
      </Card>

      <div className="space-y-2">
        {plans.map((plan) => (
          <Card key={plan.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{plan.plan_name}</p>
              <p className="text-sm text-black/60">月額 {plan.price.toLocaleString()}円</p>
              {(plan.available_days || (plan.available_time_start && plan.available_time_end)) && (
                <p className="text-xs text-black/40">
                  {plan.available_days && `利用可能曜日: ${plan.available_days.join("・")}`}
                  {plan.available_time_start && plan.available_time_end &&
                    ` ${plan.available_time_start.slice(0, 5)}〜${plan.available_time_end.slice(0, 5)}`}
                </p>
              )}
            </div>
            <Button
              className="w-auto px-3 py-2 text-xs"
              variant={plan.is_active ? "outline" : "primary"}
              onClick={() => toggleActive(plan.id, plan.is_active)}
            >
              {plan.is_active ? "公開中" : "非公開"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
