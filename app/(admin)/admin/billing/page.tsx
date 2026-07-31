"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { useCurrentAdmin } from "@/lib/useCurrentAdmin";
import { BillingView } from "@/components/BillingView";
import { BackLink } from "@/components/ui/BackLink";

export default function OperatorBillingPage() {
  const { admin, loading } = useCurrentAdmin();
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>("");

  useEffect(() => {
    if (admin?.role !== "operator") return;
    const supabase = createBrowserSupabase();
    supabase
      .from("shops")
      .select("id, name")
      .order("name")
      .then(({ data }) => setShops(data ?? []));
  }, [admin]);

  if (loading) return <p className="p-6 text-sm text-black/50">読み込み中…</p>;
  if (admin?.role !== "operator") return <p className="p-6 text-sm text-red-600">権限がありません。</p>;

  return (
    <div className="space-y-4 p-4">
      <BackLink href="/admin" />
      <h1 className="text-lg font-bold">SaaS利用料 代理管理</h1>
      <p className="text-sm text-black/50">
        通常は店舗管理画面から契約してもらいますが、サポート対応などで運営が代理操作できます。
      </p>

      <select
        className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
        value={selectedShopId}
        onChange={(e) => setSelectedShopId(e.target.value)}
      >
        <option value="">店舗を選択してください</option>
        {shops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {selectedShopId && <BillingView shopId={selectedShopId} />}
    </div>
  );
}
