"use client";

import { SalesView } from "@/components/SalesView";

export default function ShopSalesPage() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-bold">売上・決済履歴</h1>
      <SalesView />
    </div>
  );
}
