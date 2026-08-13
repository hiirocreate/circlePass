"use client";

import { useCurrentAdmin } from "@/lib/useCurrentAdmin";
import { ThemeColorView } from "@/components/ThemeColorView";
import { BackLink } from "@/components/ui/BackLink";

export default function ShopSettingsPage() {
  const { admin, loading } = useCurrentAdmin();

  if (loading) return <p className="p-6 text-sm text-black/50">読み込み中…</p>;

  return (
    <div className="space-y-4 p-4">
      <BackLink href="/dashboard" />
      <h1 className="text-lg font-bold">テーマカラー設定</h1>
      {admin?.shop_id ? (
        <ThemeColorView shopId={admin.shop_id} />
      ) : (
        <p className="text-sm text-black/50">店舗情報を読み込み中です…</p>
      )}
    </div>
  );
}
