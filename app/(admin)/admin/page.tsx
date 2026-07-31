"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { useCurrentAdmin } from "@/lib/useCurrentAdmin";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const SAAS_PLAN_LABEL: Record<string, string> = {
  light: "ライトプラン(3,980円/月)",
  standard: "スタンダード(5,980円/月)",
  premium: "プレミアム(9,800円/月)",
};

export default function OperatorAdminPage() {
  const { admin, loading } = useCurrentAdmin();
  const [shops, setShops] = useState<any[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [shopForm, setShopForm] = useState({
    name: "",
    phone: "",
    businessHours: "",
    regularHoliday: "",
    saasPlan: "light",
    adminEmail: "",
    adminPassword: "",
    lineChannelAccessToken: "",
    featureSubscriptionEnabled: true,
    featureWaitingEnabled: true,
  });
  const [creatingShop, setCreatingShop] = useState(false);

  const load = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.from("shops").select("*").order("created_at", { ascending: false });
    setShops(data ?? []);
  }, []);

  useEffect(() => {
    if (admin?.role === "operator") load();
  }, [admin, load]);

  const toggleStop = async (shopId: string, isActive: boolean) => {
    const supabase = createBrowserSupabase();
    await supabase.from("shops").update({ is_active: !isActive }).eq("id", shopId);
    await load();
  };

  const toggleFeature = async (
    shopId: string,
    field: "feature_subscription_enabled" | "feature_waiting_enabled",
    current: boolean
  ) => {
    const supabase = createBrowserSupabase();
    await supabase.from("shops").update({ [field]: !current }).eq("id", shopId);
    await load();
  };

  const createShop = async () => {
    if (!shopForm.name || !shopForm.adminEmail || !shopForm.adminPassword) {
      alert("店舗名・管理者メール・パスワードは必須です");
      return;
    }
    setCreatingShop(true);
    const res = await fetch("/api/admin/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shopForm),
    });
    const d = await res.json();
    if (d.error) {
      alert(d.error);
    } else {
      setShopForm({
        name: "",
        phone: "",
        businessHours: "",
        regularHoliday: "",
        saasPlan: "light",
        adminEmail: "",
        adminPassword: "",
        lineChannelAccessToken: "",
        featureSubscriptionEnabled: true,
        featureWaitingEnabled: true,
      });
      await load();
    }
    setCreatingShop(false);
  };

  const sendAnnouncement = async () => {
    if (!announcement) return;
    const supabase = createBrowserSupabase();
    await supabase.from("announcements").insert({ title: "お知らせ", body: announcement, target: "shops" });
    setAnnouncement("");
    alert("配信しました");
  };

  if (loading) return <p className="p-6 text-sm text-black/50">読み込み中…</p>;
  if (admin?.role !== "operator") return <p className="p-6 text-sm text-red-600">権限がありません。</p>;

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-bold">運営管理画面</h1>

      <Link href="/admin/sales">
        <Card className="hover:bg-black/5">
          <p className="font-semibold">売上・決済履歴</p>
          <p className="text-sm text-black/50">全店舗合算 / 店舗別の売上と決済履歴を確認</p>
        </Card>
      </Link>

      <Link href="/admin/plans">
        <Card className="hover:bg-black/5">
          <p className="font-semibold">サブスクプラン管理(代理作成)</p>
          <p className="text-sm text-black/50">店舗を選んで、代わりにプランを作成・編集</p>
        </Card>
      </Link>

      <Card className="space-y-2">
        <p className="text-sm font-semibold">店舗新規登録</p>
        <input
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="店舗名"
          value={shopForm.name}
          onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
        />
        <input
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="電話番号"
          value={shopForm.phone}
          onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
        />
        <input
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="営業時間(例: 11:00-23:00)"
          value={shopForm.businessHours}
          onChange={(e) => setShopForm({ ...shopForm, businessHours: e.target.value })}
        />
        <input
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="定休日(例: 毎週月曜)"
          value={shopForm.regularHoliday}
          onChange={(e) => setShopForm({ ...shopForm, regularHoliday: e.target.value })}
        />
        <select
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          value={shopForm.saasPlan}
          onChange={(e) => setShopForm({ ...shopForm, saasPlan: e.target.value })}
        >
          {Object.entries(SAAS_PLAN_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="pt-1 text-xs text-black/40">利用できるシステムの範囲</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={shopForm.featureSubscriptionEnabled}
            onChange={(e) => setShopForm({ ...shopForm, featureSubscriptionEnabled: e.target.checked })}
          />
          サブスク会員証・来店ポイント機能を利用する
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={shopForm.featureWaitingEnabled}
            onChange={(e) => setShopForm({ ...shopForm, featureWaitingEnabled: e.target.checked })}
          />
          順番待ちシステムを利用する
        </label>
        <p className="pt-1 text-xs text-black/40">店舗管理者アカウント</p>
        <input
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="管理者メールアドレス"
          value={shopForm.adminEmail}
          onChange={(e) => setShopForm({ ...shopForm, adminEmail: e.target.value })}
        />
        <input
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="初期パスワード"
          type="password"
          value={shopForm.adminPassword}
          onChange={(e) => setShopForm({ ...shopForm, adminPassword: e.target.value })}
        />
        <p className="pt-1 text-xs text-black/40">LINE公式アカウント連携(任意・後から設定も可)</p>
        <input
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="Messaging APIチャネルアクセストークン"
          value={shopForm.lineChannelAccessToken}
          onChange={(e) => setShopForm({ ...shopForm, lineChannelAccessToken: e.target.value })}
        />
        <Button onClick={createShop} disabled={creatingShop}>
          店舗を登録する
        </Button>
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-semibold">お知らせ配信</p>
        <textarea
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          rows={3}
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          placeholder="全店舗宛のお知らせを入力"
        />
        <Button onClick={sendAnnouncement}>配信する</Button>
      </Card>

      <p className="text-sm font-semibold">店舗一覧 ({shops.length}件)</p>
      {shops.map((shop) => (
        <Card key={shop.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{shop.name}</p>
              <p className="text-xs text-black/50">
                契約プラン: {shop.saas_plan} / {shop.is_active ? "稼働中" : "停止中"}
              </p>
            </div>
            <Button
              className="w-auto px-3 py-2 text-xs"
              variant={shop.is_active ? "danger" : "primary"}
              onClick={() => toggleStop(shop.id, shop.is_active)}
            >
              {shop.is_active ? "強制停止" : "停止解除"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-black/5 pt-2">
            <button
              onClick={() =>
                toggleFeature(shop.id, "feature_subscription_enabled", shop.feature_subscription_enabled)
              }
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                shop.feature_subscription_enabled ? "bg-black text-white" : "bg-black/5 text-black/40"
              }`}
            >
              サブスク会員証 {shop.feature_subscription_enabled ? "有効" : "無効"}
            </button>
            <button
              onClick={() => toggleFeature(shop.id, "feature_waiting_enabled", shop.feature_waiting_enabled)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                shop.feature_waiting_enabled ? "bg-black text-white" : "bg-black/5 text-black/40"
              }`}
            >
              順番待ち {shop.feature_waiting_enabled ? "有効" : "無効"}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
