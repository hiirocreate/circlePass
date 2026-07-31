"use client";

import { useEffect, useState, Suspense } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useShopId } from "@/lib/useShopId";
import { createBrowserSupabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";

function CardPageContent() {
  const shopId = useShopId();
  const [shop, setShop] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!shopId) return;
    const supabase = createBrowserSupabase();

    const { data: shopData } = await supabase.from("shops").select("*").eq("id", shopId).single();
    setShop(shopData);

    const { data: planData } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("shop_id", shopId)
      .eq("is_active", true);
    setPlans(planData ?? []);

    const res = await fetch("/api/subscriptions");
    const d = await res.json();
    const active = (d.subscriptions ?? []).find((s: any) => s.shop_id === shopId && s.status === "active");
    setSubscription(active ?? null);
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const subscribe = async (planId: string) => {
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(false);
  };

  const cancel = async () => {
    if (!subscription) return;
    if (!confirm("本当に解約しますか?")) return;
    setLoading(true);
    await fetch("/api/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: subscription.id }),
    });
    await load();
    setLoading(false);
  };

  const openBillingPortal = async () => {
    if (!subscription) return;
    setLoading(true);
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: "member_subscription", subscriptionId: subscription.id }),
    });
    const d = await res.json();
    if (d.error) {
      alert(d.error);
      setLoading(false);
      return;
    }
    window.location.href = d.url;
  };

  if (!shopId) return null;

  if (shop && !shop.feature_subscription_enabled) {
    return (
      <div className="p-4">
        <p className="text-sm text-black/50">この店舗ではサブスク会員証機能はご利用いただけません。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <BackLink href="/home" />
      <h1 className="text-lg font-bold">会員証</h1>

      {subscription ? (
        <Card className="bg-black text-white">
          <p className="text-xs text-white/60">{shop?.name}</p>
          <p className="mt-1 text-xl font-bold">{subscription.subscription_plans?.plan_name}</p>
          <p className="text-xs text-white/60">
            有効期限: {subscription.current_period_end?.slice(0, 10) ?? "-"}
          </p>
          <div className="mt-4 flex justify-center rounded-xl bg-white p-4">
            <QRCodeSVG value={JSON.stringify({ subscriptionId: subscription.id })} size={160} />
          </div>
          <p className="mt-3 text-center text-xs text-white/60">
            店舗スタッフにこのQRコードを読み取ってもらってください
          </p>
          <Button className="mt-4" onClick={openBillingPortal} disabled={loading}>
            お支払い方法・請求書を確認する
          </Button>
          <Button variant="outline" className="mt-2 bg-transparent text-white border-white/30" onClick={cancel} disabled={loading}>
            解約する
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-black/60">現在ご加入中のプランはありません。</p>
          {plans.map((plan) => (
            <Card key={plan.id}>
              <p className="font-semibold">{plan.plan_name}</p>
              <p className="text-sm text-black/60">月額 {plan.price.toLocaleString()}円</p>
              <p className="mt-1 text-sm">{plan.description}</p>
              {(plan.available_days || (plan.available_time_start && plan.available_time_end)) && (
                <p className="mt-1 text-xs text-black/40">
                  {plan.available_days && `利用可能曜日: ${plan.available_days.join("・")}`}
                  {plan.available_time_start && plan.available_time_end &&
                    ` ${plan.available_time_start.slice(0, 5)}〜${plan.available_time_end.slice(0, 5)}`}
                </p>
              )}
              <Button className="mt-3" onClick={() => subscribe(plan.id)} disabled={loading}>
                このプランに申し込む
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CardPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-black/60">読み込み中です…</p>}>
      <CardPageContent />
    </Suspense>
  );
}
