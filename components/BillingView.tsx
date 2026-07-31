"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const PLAN_LABEL: Record<string, string> = {
  light: "ライトプラン(3,980円/月)",
  standard: "スタンダード(5,980円/月)",
  premium: "プレミアム(9,800円/月)",
};

const STATUS_LABEL: Record<string, string> = {
  unpaid: "未契約",
  active: "契約中",
  past_due: "支払い失敗中",
  canceled: "解約済み",
};

type Props = {
  /** 未指定の場合、店舗管理者は自店舗が対象になる。運営が代理操作する場合に指定する */
  shopId?: string;
};

export function BillingView({ shopId }: Props) {
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("light");

  const load = useCallback(async () => {
    if (!shopId) return;
    const supabase = createBrowserSupabase();
    const { data } = await supabase
      .from("shops")
      .select("id, name, saas_plan, saas_payment_status")
      .eq("id", shopId)
      .single();
    setShop(data);
    if (data?.saas_plan) setSelectedPlan(data.saas_plan);
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const subscribe = async () => {
    setLoading(true);
    const res = await fetch("/api/shop/saas-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: selectedPlan, shopId }),
    });
    const d = await res.json();
    if (d.error) {
      alert(d.error);
      setLoading(false);
      return;
    }
    window.location.href = d.url;
  };

  const openPortal = async () => {
    setLoading(true);
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: "shop_saas", shopId }),
    });
    const d = await res.json();
    if (d.error) {
      alert(d.error);
      setLoading(false);
      return;
    }
    window.location.href = d.url;
  };

  if (!shop) return <p className="text-sm text-black/50">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs text-black/50">現在の契約状況</p>
        <p className="text-lg font-semibold">{PLAN_LABEL[shop.saas_plan] ?? shop.saas_plan}</p>
        <p className="text-sm text-black/60">状態: {STATUS_LABEL[shop.saas_payment_status] ?? shop.saas_payment_status}</p>
      </Card>

      {shop.saas_payment_status === "unpaid" || shop.saas_payment_status === "canceled" ? (
        <Card className="space-y-2">
          <p className="text-sm font-semibold">プランに申し込む</p>
          <select
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
          >
            {Object.entries(PLAN_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button onClick={subscribe} disabled={loading}>
            このプランで契約する
          </Button>
        </Card>
      ) : (
        <Card className="space-y-2">
          <p className="text-sm text-black/60">
            お支払い方法の変更、請求書の確認、プラン変更、解約はすべてこちらから行えます。
          </p>
          <Button onClick={openPortal} disabled={loading}>
            お支払い管理ページを開く
          </Button>
        </Card>
      )}
    </div>
  );
}
