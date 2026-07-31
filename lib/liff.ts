import liff from "@line/liff";

let initialized = false;

/** LIFFを初期化し、未ログインならLINEログイン画面へ遷移する */
export async function initLiff(): Promise<void> {
  if (initialized) return;
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
  initialized = true;

  if (!liff.isLoggedIn()) {
    liff.login();
    return;
  }
}

/** LIFFのid_tokenをサーバーへ送り、アプリ側のセッションを発行する */
export async function loginWithLiff(): Promise<void> {
  await initLiff();
  const idToken = liff.getIDToken();
  if (!idToken) return;

  const res = await fetch("/api/auth/line/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    throw new Error("ログインに失敗しました");
  }
}

export { liff };
