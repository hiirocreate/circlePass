"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "current_shop_id";

/**
 * 1つのミニアプリを複数店舗で共有するため、店舗の識別はLIFF起動URLの
 * クエリパラメータ(?shop=店舗ID)で行う。各店舗のLINE公式アカウントの
 * リッチメニュー等に ?shop=xxx 付きのLIFF URLを設定してもらう想定。
 */
export function useShopId(): string | null {
  const searchParams = useSearchParams();
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get("shop");
    if (fromUrl) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      setShopId(fromUrl);
    } else {
      setShopId(localStorage.getItem(STORAGE_KEY));
    }
  }, [searchParams]);

  return shopId;
}
