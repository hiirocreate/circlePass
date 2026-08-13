"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { useCurrentAdmin } from "@/lib/useCurrentAdmin";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";

const PAGES = [
  { key: "home", label: "ホーム" },
  { key: "card", label: "会員証" },
  { key: "waiting", label: "順番待ち" },
];

export default function OperatorAccountsPage() {
  const { admin, loading } = useCurrentAdmin();
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [shopAdmins, setShopAdmins] = useState<any[]>([]);
  const [forms, setForms] = useState<Record<string, { email: string; password: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (admin?.role !== "operator") return;
    const supabase = createBrowserSupabase();
    supabase
      .from("shops")
      .select("id, name")
      .order("name")
      .then(({ data }) => setShops(data ?? []));
  }, [admin]);

  const loadShopAdmins = useCallback(async () => {
    if (!selectedShopId) {
      setShopAdmins([]);
      return;
    }
    const res = await fetch(`/api/admin/shop-admins?shopId=${selectedShopId}`);
    const d = await res.json();
    setShopAdmins(d.admins ?? []);
  }, [selectedShopId]);

  useEffect(() => {
    loadShopAdmins();
  }, [loadShopAdmins]);

  const updateAccount = async (adminId: string) => {
    const form = forms[adminId] ?? { email: "", password: "" };
    if (!form.email && !form.password) {
      alert("メールアドレスかパスワードのどちらかを入力してください");
      return;
    }
    setSaving(adminId);
    const res = await fetch("/api/admin/shop-admins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId, email: form.email || undefined, password: form.password || undefined }),
    });
    const d = await res.json();
    if (d.error) {
      alert(d.error);
    } else {
      setForms((f) => ({ ...f, [adminId]: { email: "", password: "" } }));
      await loadShopAdmins();
      alert("更新しました");
    }
    setSaving(null);
  };

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

  const copyUrl = async (pageKey: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(pageKey);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      alert(url); // クリップボードが使えない環境向けのフォールバック表示
    }
  };

  if (loading) return <p className="p-6 text-sm text-black/50">読み込み中…</p>;
  if (admin?.role !== "operator") return <p className="p-6 text-sm text-red-600">権限がありません。</p>;

  return (
    <div className="space-y-4 p-4">
      <BackLink href="/admin" />
      <h1 className="text-lg font-bold">店舗アカウント・ログインURL管理</h1>

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

      {selectedShopId && (
        <>
          <div>
            <p className="mb-2 text-sm font-semibold">店舗管理者アカウント</p>
            {shopAdmins.length === 0 && (
              <p className="text-sm text-black/40">この店舗に紐づく管理者アカウントが見つかりません</p>
            )}
            <div className="space-y-2">
              {shopAdmins.map((a) => (
                <Card key={a.id} className="space-y-2">
                  <p className="text-sm font-semibold">{a.name || "(名前未設定)"}</p>
                  <p className="text-xs text-black/50">現在のメールアドレス: {a.email}</p>
                  <input
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                    placeholder="新しいメールアドレス(変更する場合のみ)"
                    value={forms[a.id]?.email ?? ""}
                    onChange={(e) =>
                      setForms((f) => ({ ...f, [a.id]: { ...f[a.id], email: e.target.value, password: f[a.id]?.password ?? "" } }))
                    }
                  />
                  <input
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                    placeholder="新しいパスワード(変更する場合のみ)"
                    value={forms[a.id]?.password ?? ""}
                    onChange={(e) =>
                      setForms((f) => ({ ...f, [a.id]: { ...f[a.id], password: e.target.value, email: f[a.id]?.email ?? "" } }))
                    }
                  />
                  <Button
                    className="w-auto px-3 py-2 text-xs"
                    onClick={() => updateAccount(a.id)}
                    disabled={saving === a.id}
                  >
                    更新する
                  </Button>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">店舗のログイン用URL(LIFF)</p>
            {!liffId ? (
              <p className="text-sm text-red-600">
                NEXT_PUBLIC_LIFF_ID が設定されていないため、URLを生成できません。
              </p>
            ) : (
              <Card className="space-y-3">
                <p className="text-xs text-black/50">
                  お客様がLINEでこの店舗のミニアプリを開くためのURLです。店舗のLINE公式アカウントの
                  リッチメニューやトーク画面から案内してください。
                </p>
                {PAGES.map((p) => {
                  const url = `https://liff.line.me/${liffId}/${p.key}?shop=${selectedShopId}`;
                  return (
                    <div key={p.key} className="space-y-1">
                      <p className="text-xs font-semibold text-black/60">{p.label}画面</p>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          className="w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-xs"
                          value={url}
                          onFocus={(e) => e.target.select()}
                        />
                        <Button className="w-auto shrink-0 px-3 py-2 text-xs" onClick={() => copyUrl(p.key, url)}>
                          {copiedKey === p.key ? "コピー済み" : "コピー"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}