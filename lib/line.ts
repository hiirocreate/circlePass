/**
 * LINEミニアプリではLIFF SDKでログインし、フロントで取得したid_tokenを
 * サーバーに送ってLINEの公式verifyエンドポイントで検証する。
 * (LIFF利用時はOAuthのcode/callbackフローは不要)
 */
type LineVerifyResponse = {
  iss: string;
  sub: string; // LINE ID (userId)
  aud: string;
  name?: string;
  picture?: string;
};

export async function verifyLineIdToken(idToken: string): Promise<LineVerifyResponse> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: process.env.LINE_CHANNEL_ID!,
    }),
  });

  if (!res.ok) {
    throw new Error("LINE ID Tokenの検証に失敗しました");
  }

  return res.json();
}

/** LINE公式アカウントからのプッシュ通知送信。channelAccessTokenを省略した場合は環境変数(単一店舗運用向け)を使う */
export async function sendLineMessage(
  lineUserId: string,
  text: string,
  channelAccessToken?: string
) {
  const token = channelAccessToken ?? process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("LINE通知送信失敗:", body);
  }
}

/** 店舗ごとのチャネルアクセストークンを取得するヘルパー(未登録なら環境変数にフォールバック) */
export async function getShopLineToken(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  shopId: string
): Promise<string | undefined> {
  const { data } = await supabase
    .from("shop_line_credentials")
    .select("channel_access_token")
    .eq("shop_id", shopId)
    .maybeSingle();
  return data?.channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN;
}
