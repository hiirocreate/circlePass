"use client";

import { useCurrentAdmin } from "@/lib/useCurrentAdmin";
import { BillingView } from "@/components/BillingView";
import { BackLink } from "@/components/ui/BackLink";

export default function ShopBillingPage() {
  const { admin, loading } = useCurrentAdmin();

  if (loading) return <p className="p-6 text-sm text-black/50">読み込み中…</p>;

  return (
    <div className="space-y-4 p-4">
      <BackLink href="/dashboard" />
      <h1 className="text-lg font-bold">お支払い設定(SaaS利用料)</h1>
      {admin?.shop_id ? (
        <BillingView shopId={admin.shop_id} />
      ) : (
        <p className="text-sm text-black/50">店舗情報を読み込み中です…</p>
      )}
    </div>
  );
}
