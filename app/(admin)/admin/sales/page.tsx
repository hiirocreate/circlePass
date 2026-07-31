"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { useCurrentAdmin } from "@/lib/useCurrentAdmin";
import { SalesView } from "@/components/SalesView";
import { BackLink } from "@/components/ui/BackLink";

export default function OperatorSalesPage() {
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
      <h1 className="text-lg font-bold">売上・決済履歴(運営)</h1>

      <select
        className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
        value={selectedShopId}
        onChange={(e) => setSelectedShopId(e.target.value)}
      >
        <option value="">全店舗合算</option>
        {shops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <SalesView shopId={selectedShopId || undefined} showShopBreakdown={!selectedShopId} />
    </div>
  );
}
