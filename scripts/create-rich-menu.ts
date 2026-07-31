/**
 * リッチメニュー作成スクリプト
 *
 * 店舗ごとのLINE公式アカウント(Messaging APIチャネル)にリッチメニューを登録する。
 * 1つのLIFFアプリを全店舗で共有する設計のため、各店舗のリッチメニューのタップ領域は
 * 該当店舗のLIFF URL(?shop=<shopId>)を指すようにする。
 *
 * 使い方:
 *   1. public/richmenu/menu.png に 2500x843px のメニュー画像を用意する
 *      (3分割デザインの場合: 各アクション幅 833px を目安にする)
 *   2. 環境変数を設定して実行する
 *
 *      LINE_CHANNEL_ACCESS_TOKEN=xxxx \
 *      NEXT_PUBLIC_LIFF_ID=xxxx \
 *      SHOP_ID=<shopsテーブルのid> \
 *      APP_URL=https://your-domain.vercel.app \
 *      npx ts-node scripts/create-rich-menu.ts
 *
 *   3. 店舗を追加するたびに SHOP_ID を変えて再実行する
 *      (店舗ごとに異なるMessaging APIチャネル/アクセストークンを使うこと)
 */

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;
const SHOP_ID = process.env.SHOP_ID;
const IMAGE_PATH = process.env.RICHMENU_IMAGE_PATH ?? "public/richmenu/menu.png";

if (!CHANNEL_ACCESS_TOKEN || !LIFF_ID || !SHOP_ID) {
  console.error(
    "LINE_CHANNEL_ACCESS_TOKEN / NEXT_PUBLIC_LIFF_ID / SHOP_ID の環境変数を設定してください"
  );
  process.exit(1);
}

const liffUrl = (page: string) => `https://liff.line.me/${LIFF_ID}${page}?shop=${SHOP_ID}`;

// 3分割: ホーム / 会員証 / 順番待ち
const richMenuBody = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: `menu-shop-${SHOP_ID}`,
  chatBarText: "メニュー",
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: "uri", uri: liffUrl("/home") },
    },
    {
      bounds: { x: 833, y: 0, width: 834, height: 843 },
      action: { type: "uri", uri: liffUrl("/card") },
    },
    {
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: { type: "uri", uri: liffUrl("/waiting") },
    },
  ],
};

async function main() {
  const fs = await import("fs");

  // 1. リッチメニューを作成
  const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(richMenuBody),
  });

  if (!createRes.ok) {
    throw new Error(`リッチメニュー作成に失敗しました: ${await createRes.text()}`);
  }
  const { richMenuId } = await createRes.json();
  console.log("リッチメニューを作成しました:", richMenuId);

  // 2. 画像をアップロード
  if (!fs.existsSync(IMAGE_PATH)) {
    throw new Error(`画像が見つかりません: ${IMAGE_PATH}(2500x843pxのPNG/JPEGを配置してください)`);
  }
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const contentType = IMAGE_PATH.endsWith(".png") ? "image/png" : "image/jpeg";

  const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`画像アップロードに失敗しました: ${await uploadRes.text()}`);
  }
  console.log("画像をアップロードしました");

  // 3. 全ユーザーのデフォルトリッチメニューとして設定
  const setDefaultRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
  });

  if (!setDefaultRes.ok) {
    throw new Error(`デフォルト設定に失敗しました: ${await setDefaultRes.text()}`);
  }
  console.log("デフォルトリッチメニューとして設定しました。完了です。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
