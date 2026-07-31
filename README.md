# LINE Mini App SaaS(サブスク会員証 + 順番待ちシステム)

## 構成

```
app/
  page.tsx                    LIFFログイン エントリーポイント
  (user)/home                 利用者ホーム画面
  (user)/card                 会員証・サブスク申込画面
  (user)/waiting              順番待ち登録・状況画面
  (shop)/login                店舗管理者ログイン
  (shop)/dashboard            店舗管理画面(トップ/順番待ち/プラン/QR読取)
  (admin)/admin               運営管理画面(全店舗管理)
  api/
    auth/line/callback        LINE ID Token検証・ユーザー登録・セッション発行
    stripe/checkout           Stripe Checkout Session作成
    stripe/webhook            Stripe Webhook(決済結果反映・LINE通知)
    waiting-list               順番待ち登録/一覧
    waiting-list/[id]          順番待ちステータス更新(呼出/完了/キャンセル)
    subscriptions               契約一覧・解約
    points                      QR読取後の特典利用・来店ポイント付与
    shop/plans                  プラン作成(Stripe Product/Price自動作成)
lib/                         Supabase/Stripe/LINE/セッション等の共通処理
components/ui/               共通UIコンポーネント
supabase/schema.sql          テーブル定義・RLSポリシー
types/                       共通型定義
middleware.ts                管理画面アクセス制御
```

## セットアップ手順

1. 依存パッケージのインストール
   ```
   npm install
   ```

2. Supabaseプロジェクトを作成し、SQL Editorで `supabase/schema.sql` を実行する。
   - 既に一度実行済みの環境をアップデートする場合は `supabase/migrations/` 配下の
     マイグレーションファイルを追加で実行してください。

3. `.env.example` を `.env.local` にコピーし、各値を設定する。
   - Supabase: プロジェクトURL / anonキー / service roleキー
   - LINE: LINE Developersコンソールで「LINEログイン」チャネルとLIFFアプリを作成し、
     Channel ID / Channel Secret / LIFF ID / チャネルアクセストークンを設定
   - Stripe: APIキーとWebhookシークレット(`stripe listen --forward-to localhost:3000/api/stripe/webhook` で取得可能)

4. 運営・店舗管理者アカウントの作成
   - Supabase Authでユーザーを作成(メール/パスワード)
   - `admins` テーブルに `id`(Auth UID) / `role`(operator or shop_admin) / `shop_id` を登録

5. 店舗データの登録
   - `shops` テーブルへ店舗情報を登録(運営管理画面からも可能な設計に拡張できます)
   - LINE公式アカウントのリッチメニュー等に、LIFF URLへ `?shop=<shopsのid>` を付与したリンクを設定
     (例: `https://liff.line.me/xxxxxxx?shop=11111111-2222-3333-4444-555555555555`)

6. ローカル起動
   ```
   npm run dev
   ```

7. Vercelへデプロイ
   - 環境変数をVercelのプロジェクト設定に登録
   - Stripe Webhookのエンドポイントを `https://<your-domain>/api/stripe/webhook` に設定

8. LINEミニアプリのリッチメニュー・マニフェスト設定は `docs/line-miniapp-setup.md` を参照

## 未実装・拡張が必要な箇所(次のステップ)

- 店舗管理画面からのLINEチャネルアクセストークン変更UI(現状は運営の店舗登録時のみ設定可能。
  `shop_line_credentials` テーブルへUPDATEすれば変更自体は可能)

## 実装済み(追加分)

- 運営管理画面からの店舗新規登録UI + 店舗管理者アカウント自動作成(`/api/admin/shops`)
- 店舗側 順番待ち管理画面のSupabase Realtime対応(呼び出し・キャンセル等が即時反映される)
  - `supabase/schema.sql` 末尾の `alter publication supabase_realtime add table waiting_lists;`
    を実行しないとRealtimeが有効化されないので注意
  - 利用者側の待ち状況画面はLINEユーザーがSupabase Authを使わない仕様のためRealtimeのRLS対象にできず、
    10秒間隔のポーリングとしている
- サブスクの利用可能曜日・時間帯によるQR利用時のバリデーション(`lib/plan-availability.ts`)
  - 店舗側プラン作成フォームで曜日・時間帯を設定可能
  - 範囲外の場合、QR読み取り(`/api/points`)がエラーを返し利用不可にする
- LINEミニアプリのリッチメニュー連携(`scripts/create-rich-menu.ts`)・Webマニフェスト(`app/manifest.ts`)
  - 詳しい手順は `docs/line-miniapp-setup.md` を参照
  - 店舗ごとに異なるLINE公式アカウント(Messaging APIチャネル)を使う設計に対応するため、
    チャネルアクセストークンは `shops` テーブルとは別の `shop_line_credentials` テーブルに保存する
    (利用者アプリから店舗情報を読む際に秘匿情報が漏れないようにするため)
- 決済履歴・売上確認画面(`/dashboard/sales` 店舗側、`/admin/sales` 運営側)
  - `GET /api/shop/sales` が月別売上サマリー(直近6ヶ月)と決済履歴一覧を返す
  - 運営側は店舗を選択して個別確認、または「全店舗合算」で店舗別内訳付きの一覧を確認できる
- 来店ポイントの特典交換UI(`/points` 利用者側、`/dashboard/rewards` 店舗側)
  - 利用者が特典を選んで交換申請すると `reward_redemptions` に pending で登録され、QRコードを表示
  - 店舗側は `/dashboard/qr` で会員証QR(サブスク特典)と特典交換QRの両方を読み取れる
  - ポイント減算は申請時ではなく、店舗側がQRを確認して交換を確定した時点で行う
    (二重利用や誤操作を防ぐため)
- 店舗ごとの利用機能範囲の調整(運営が「サブスク会員証」「順番待ち」を個別にON/OFF可能)
  - `shops.feature_subscription_enabled` / `shops.feature_waiting_enabled` の2フラグで管理
    (既存環境は `supabase/migrations/001_add_shop_feature_flags.sql` を実行してください)
  - 運営管理画面(`/admin`)の店舗一覧から各店舗ごとにトグル可能。店舗新規登録時にも初期値を選択できる
  - 無効化した機能は、利用者アプリ(ホーム画面・各画面)と店舗管理画面のメニューから非表示になり、
    該当APIも403エラーを返す(URLを直接叩かれても機能しないようサーバー側でもチェック)
