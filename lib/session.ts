import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "line_saas_session";
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!);

export type SessionPayload = {
  userId: string; // usersテーブルのid
  lineId: string;
};

/** LINEログイン成功後にセッションCookieを発行する */
export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax", // LINEアプリ内WebView対応
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** 現在のリクエストのログインユーザーを取得(未ログインならnull) */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function clearSession() {
  cookies().delete(SESSION_COOKIE);
}
