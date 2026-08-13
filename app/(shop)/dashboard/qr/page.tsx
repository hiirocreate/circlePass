"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentAdmin } from "@/lib/useCurrentAdmin";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";

type ScannedSubscription = { subscriptionId: string };

const ACTION_LABEL: Record<string, string> = {
  visit_point: "来店ポイント付与(+1pt)",
  drink_free: "ドリンク無料",
  all_you_can_drink: "飲み放題利用",
  other: "その他特典",
};

export default function QrScanPage() {
  const { admin } = useCurrentAdmin();
  const scannerRef = useRef<any>(null);
  const [scannedSub, setScannedSub] = useState<ScannedSubscription | null>(null);
  const [redemptionDetail, setRedemptionDetail] = useState<any | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{ type: string; id: string; label: string } | null>(null);

  useEffect(() => {
    let html5QrCode: any;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          async (decodedText: string) => {
            try {
              const parsed = JSON.parse(decodedText);
              html5QrCode.pause();

              if (parsed.redemptionId) {
                // 特典交換QR: 内容を確認表示するため詳細を取得
                setLastAction(null);
                const res = await fetch(`/api/rewards/redeem/${parsed.redemptionId}`);
                const d = await res.json();
                if (d.error) {
                  setMessage(d.error);
                  scannerRef.current?.resume();
                } else {
                  setRedemptionDetail(d.redemption);
                }
              } else if (parsed.subscriptionId) {
                setLastAction(null);
                setScannedSub(parsed);
              }
            } catch {
              // QRコード内容が不正な場合は無視
            }
          },
          undefined
        );
      } catch (e) {
        console.error("カメラ起動に失敗しました", e);
      }
    })();

    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  const useSubscriptionBenefit = async (usedType: string) => {
    if (!scannedSub || !admin?.shop_id) return;
    const label = ACTION_LABEL[usedType] ?? usedType;
    if (!confirm(`「${label}」を実行します。よろしいですか?`)) return;

    const res = await fetch("/api/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptionId: scannedSub.subscriptionId,
        shopId: admin.shop_id,
        usedType,
      }),
    });
    const d = await res.json();
    if (d.error) {
      setMessage(d.error);
      setLastAction(null);
    } else {
      setMessage(`「${label}」の処理が完了しました`);
      setLastAction(d.undo ? { ...d.undo, label } : null);
    }
    setScannedSub(null);
    scannerRef.current?.resume();
  };

  const undoLastAction = async () => {
    if (!lastAction) return;
    if (!confirm(`「${lastAction.label}」を取り消します。よろしいですか?`)) return;
    const res = await fetch("/api/points", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: lastAction.type, id: lastAction.id }),
    });
    const d = await res.json();
    setMessage(d.error ?? "取り消しました");
    setLastAction(null);
  };

  const completeRedemption = async () => {
    if (!redemptionDetail || !admin?.shop_id) return;
    const res = await fetch("/api/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId: admin.shop_id,
        usedType: "reward_complete",
        redemptionId: redemptionDetail.id,
      }),
    });
    const d = await res.json();
    setMessage(d.error ?? "特典交換が完了しました");
    setRedemptionDetail(null);
    scannerRef.current?.resume();
  };

  const cancelScan = () => {
    setScannedSub(null);
    setRedemptionDetail(null);
    scannerRef.current?.resume();
  };

  return (
    <div className="space-y-4 p-4">
      <BackLink href="/dashboard" />
      <h1 className="text-lg font-bold">QRコード読み取り</h1>
      <div id="qr-reader" className="overflow-hidden rounded-2xl" />

      {scannedSub && (
        <Card className="space-y-2">
          <p className="text-sm font-semibold">利用内容を選択してください</p>
          <Button onClick={() => useSubscriptionBenefit("visit_point")}>来店ポイント付与(+1pt)</Button>
          <Button onClick={() => useSubscriptionBenefit("drink_free")}>ドリンク無料</Button>
          <Button onClick={() => useSubscriptionBenefit("all_you_can_drink")}>飲み放題利用</Button>
          <Button onClick={() => useSubscriptionBenefit("other")} variant="outline">
            その他特典
          </Button>
          <Button variant="outline" onClick={cancelScan}>
            キャンセル
          </Button>
        </Card>
      )}

      {redemptionDetail && (
        <Card className="space-y-2">
          <p className="text-sm font-semibold">特典交換の確認</p>
          <p className="text-sm text-black/70">
            {redemptionDetail.users?.name} 様 / {redemptionDetail.point_rewards?.reward_description}
          </p>
          <p className="text-xs text-black/50">使用ポイント: {redemptionDetail.points_used}pt</p>
          <Button onClick={completeRedemption}>交換を確定する</Button>
          <Button variant="outline" onClick={cancelScan}>
            キャンセル
          </Button>
        </Card>
      )}

      {message && (
        <Card className="space-y-2">
          <p className="text-sm text-black/70">{message}</p>
          {lastAction && (
            <Button variant="outline" onClick={undoLastAction}>
              取り消す
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
