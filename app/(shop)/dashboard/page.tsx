"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentAdmin } from "@/lib/useCurrentAdmin";
import { createBrowserSupabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";

const MENU: { href: string; label: string; desc: string; feature?: "subscription" | "waiting" }[] = [
  { href: "/dashboard/waiting", label: "順番待ち管理", desc: "現在の待ち状況を確認・操作", feature: "waiting" },
  { href: "/dashboard/plans", label: "サブスクプラン管理", desc: "プランの作成・公開設定", feature: "subscription" },
  {
    href: "/dashboard/rewards",
    label: "特典交換ルール管理",
    desc: "来店ポイントと交換できる特典の設定",
    feature: "subscription",
  },
  {
    href: "/dashboard/qr",
    label: "QRコード読み取り",
    desc: "会員証QRの読み取り・特典利用",
    feature: "subscription",
  },
  { href: "/dashboard/sales", label: "売上・決済履歴", desc: "月別売上と決済履歴の確認", feature: "subscription" },
];

export default function DashboardPage() {
  const { admin, loading } = useCurrentAdmin();
  const [shop, setShop] = useState<any>(null);

  useEffect(() => {
    if (!admin?.shop_id) return;
    const supabase = createBrowserSupabase();
    supabase
      .from("shops")
      .select("feature_subscription_enabled, feature_waiting_enabled")
      .eq("id", admin.shop_id)
      .single()
      .then(({ data }) => setShop(data));
  }, [admin?.shop_id]);

  if (loading) return <p className="p-6 text-sm text-black/50">読み込み中…</p>;
  if (!admin) return <p className="p-6 text-sm text-red-600">ログインしてください。</p>;

  // 運営(全店舗管理)は機能範囲の制限を受けないため常に全メニューを表示する
  const visibleMenu = MENU.filter((m) => {
    if (admin.role === "operator" || !m.feature || !shop) return true;
    if (m.feature === "subscription") return shop.feature_subscription_enabled;
    if (m.feature === "waiting") return shop.feature_waiting_enabled;
    return true;
  });

  return (
    <div className="space-y-3 p-4">
      <h1 className="text-lg font-bold">店舗管理画面</h1>
      <p className="text-sm text-black/50">{admin.role === "operator" ? "運営アカウント" : "店舗管理者アカウント"}</p>
      {visibleMenu.map((m) => (
        <Link key={m.href} href={m.href}>
          <Card className="hover:bg-black/5">
            <p className="font-semibold">{m.label}</p>
            <p className="text-sm text-black/50">{m.desc}</p>
          </Card>
        </Link>
      ))}
      {admin.role === "operator" && (
        <Link href="/admin">
          <Card className="hover:bg-black/5">
            <p className="font-semibold">運営管理画面へ</p>
            <p className="text-sm text-black/50">全店舗管理・売上確認</p>
          </Card>
        </Link>
      )}
    </div>
  );
}
