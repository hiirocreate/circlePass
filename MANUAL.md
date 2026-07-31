# 構築マニュアル(ゼロから本番稼働まで)

このマニュアルは、このリポジトリを実際に動かして本番公開するまでの手順を
上から順番に実施すれば完了するように書いています。所要時間の目安は、
初めての場合で半日〜1日程度です。

---

## 0. 事前に用意するもの

| 項目 | 用途 | 費用目安 |
|---|---|---|
| GitHubアカウント | ソースコード管理・Vercel連携 | 無料 |
| Vercelアカウント | アプリのデプロイ先 | 無料枠あり |
| Supabaseアカウント | データベース・認証基盤 | 無料枠あり |
| Stripeアカウント | サブスク決済 | 決済成功時に手数料 |
| LINE Developersアカウント(LINEアカウントでログイン可) | LINEログイン・LIFF・通知 | 無料 |
| 店舗のLINE公式アカウント(店舗の数だけ) | 通知送信・リッチメニュー | 無料プランあり |
| Node.js 18以上 | ローカル動作確認 | - |

---

## 1. リポジトリの準備

1. 受け取ったzipを展開し、GitHubに新規リポジトリを作って push する。
   ```bash
   cd line-saas
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/<あなたのアカウント>/<リポジトリ名>.git
   git push -u origin main
   ```
2. ローカルで依存パッケージをインストールしておく(後の動作確認用)。
   ```bash
   npm install
   ```

---

## 2. Supabaseのセットアップ

1. [Supabase](https://supabase.com/) にログインし、「New Project」でプロジェクトを作成する。
   - リージョンは日本(Tokyo, `ap-northeast-1`)を推奨。
   - データベースパスワードは控えておく。
2. プロジェクト作成後、左メニューの **SQL Editor** を開く。
3. `supabase/schema.sql` の中身を全てコピーし、SQL Editorに貼り付けて実行する。
   - エラーが出た場合は、途中まで実行された可能性があるため、
     `supabase/schema.sql` を確認しながら分割して実行してもよい。
4. 左メニューの **Project Settings → API** を開き、以下をメモする。
   - `Project URL` → `.env` の `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` キー → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` キー → `SUPABASE_SERVICE_ROLE_KEY`(**絶対に公開しないこと**)
5. **Database → Replication** を開き、`waiting_lists` テーブルの Realtime が
   ON になっていることを確認する(`schema.sql` 内の
   `alter publication supabase_realtime add table waiting_lists;` で
   自動的に有効化されているはずですが、念のため確認)。

---

## 3. Stripeのセットアップ

1. [Stripe](https://dashboard.stripe.com/register) でアカウントを作成する(日本語対応、日本の銀行口座で入金可能)。
2. 開発中は「テスト環境」のまま進めてOK。ダッシュボード右上でテスト/本番を切り替えられる。
3. **開発者 → APIキー** から以下を取得する。
   - シークレットキー(`sk_test_...`)→ `.env` の `STRIPE_SECRET_KEY`
   - 公開可能キー(`pk_test_...`)→ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
4. Webhookシークレットはローカル確認時とVercel本番で別の値になるため、後述の手順4・6で設定する。
5. 本番で使う場合は、Stripeの本人確認(KYC)・銀行口座登録を完了させ、
   「本番環境」に切り替えてから同様にAPIキーを取得し直す。

---

## 4. ローカルでの動作確認

1. `.env.example` を `.env.local` にコピーする。
2. ここまでで取得したSupabase・Stripeの値を埋める(LINE関連は次章で埋める)。
3. Stripe Webhookをローカルで受けるため、[Stripe CLI](https://stripe.com/docs/stripe-cli) を使う。
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   表示される `whsec_...` を `.env.local` の `STRIPE_WEBHOOK_SECRET` に設定する。
4. アプリを起動する。
   ```bash
   npm run dev
   ```
5. `http://localhost:3000` にアクセスし、エラーなく画面が表示されることを確認する
   (この時点ではLINEログインは未設定のため `/` はLIFF初期化でエラーになるのが正常。
   `/login` にアクセスして店舗管理者ログイン画面が表示されればOK)。

---

## 5. LINE Developersのセットアップ

1. [LINE Developers Console](https://developers.line.biz/console/) にログインする。
2. 「プロバイダー」を新規作成する(会社名やサービス名でOK)。
3. そのプロバイダーの下に **「LINEログイン」チャネル** を新規作成する。
   - チャネル名・説明・カテゴリを入力して作成。
4. 作成したチャネルの **「LIFF」タブ** で「追加」をクリックし、LIFFアプリを作る。
   - LIFF名: 任意(例: 会員証・順番待ち)
   - サイズ: `Full`
   - エンドポイントURL: 一旦 `https://example.com` など仮のURLでよい(手順7でVercelのURLに更新)
   - Scope: `profile`、`openid` にチェック
   - ボットリンク機能: `On (Aggressive)` を推奨
   - 作成後に発行される **LIFF ID** を控える → `.env` の `NEXT_PUBLIC_LIFF_ID`
5. チャネルの **「チャネル基本設定」タブ** で **Channel ID** を控える → `.env` の `LINE_CHANNEL_ID`
6. 店舗の数だけ、店舗用の **LINE公式アカウント(Messaging APIチャネル)** を用意する。
   - 既存のLINE公式アカウントがあれば、LINE Official Account Managerの
     「設定 → Messaging API」からMessaging APIを有効化する。
   - 新規の場合は LINE Developers Console から「Messaging API」チャネルを新規作成する。
   - 各チャネルの **「Messaging API設定」タブ** 下部で
     **チャネルアクセストークン(長期)** を発行して控えておく
     (店舗登録時に使用。手順9参照)。

> 補足: 1つのLINEログインチャネル・LIFFアプリを全店舗で共有し、
> `?shop=店舗ID` のクエリパラメータで店舗を判別する設計です。
> 一方、通知・リッチメニューは店舗ごとに異なるMessaging APIチャネルを使います。

---

## 6. Vercelへのデプロイ

1. [Vercel](https://vercel.com/) にログインし、「Add New → Project」でGitHubリポジトリを選択する。
2. フレームワークは自動的に Next.js と認識される。デプロイ前に **Environment Variables** に
   `.env.example` の全項目を設定する(値はこれまでの手順で取得したもの)。
   - `NEXT_PUBLIC_APP_URL` は後で分かる本番URL(例: `https://your-app.vercel.app`)を入れる。
     一度デプロイしてURLが確定してから再設定してもよい。
   - `LINE_CHANNEL_ACCESS_TOKEN` は単一店舗運用時のフォールバック用。複数店舗運用では
     店舗ごとに管理画面から登録するため、ここは空欄でも動作します(手順9参照)。
3. 「Deploy」を実行する。数分でデプロイが完了し、URLが発行される。
4. デプロイ完了後、以下を反映する。
   - LINE Developers ConsoleのLIFF設定の **エンドポイントURL** を、
     発行されたVercelのURLに更新する。
   - Vercelの環境変数 `NEXT_PUBLIC_APP_URL` を実際のURLに更新し、再デプロイする
     (Vercelダッシュボードの「Redeploy」ボタン)。

---

## 7. Stripe Webhookの本番設定

1. Stripeダッシュボードの **開発者 → Webhook** で「エンドポイントを追加」をクリック。
2. エンドポイントURL: `https://<VercelのURL>/api/stripe/webhook`
3. リッスンするイベントで以下を選択する。
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
4. 作成後に表示される **署名シークレット(`whsec_...`)** を、Vercelの環境変数
   `STRIPE_WEBHOOK_SECRET` に設定し、再デプロイする。

---

## 8. 運営アカウントの作成

1. Supabaseダッシュボードの **Authentication → Users** で「Add user」から
   運営者用のメールアドレス・パスワードでユーザーを作成する
   (Auto Confirm Userを有効にして確認メール不要で作成する)。
2. 作成されたユーザーの **UID** をコピーする。
3. **Table Editor → admins** テーブルで新規行を追加する。
   - `id`: 上記UID
   - `role`: `operator`
   - `shop_id`: 空欄(NULL)
   - `name`: 任意
4. `https://<VercelのURL>/login` にアクセスし、今作成したメール・パスワードでログインする。
   `/dashboard` → 「運営管理画面へ」から `/admin` にアクセスできれば成功。

---

## 9. 店舗の登録

運営管理画面(`/admin`)から行います(コード操作は不要)。

1. 「店舗新規登録」フォームに、店舗名・電話番号・営業時間・定休日を入力する。
2. **「利用できるシステムの範囲」** で、その店舗が使う機能を選ぶ。
   - サブスク会員証・来店ポイント機能のみ使いたい店舗 → 順番待ちのチェックを外す
   - 順番待ちシステムのみ使いたい店舗 → サブスク会員証のチェックを外す
   - 両方使う場合はそのまま両方チェック(デフォルト)
3. 店舗管理者アカウントのメールアドレス・初期パスワードを入力する
   (この情報を店舗側に伝えて、`/login` からログインしてもらう)。
4. 「LINE公式アカウント連携」に、手順5で発行した**その店舗の**チャネルアクセストークンを入力する
   (後から設定する場合は、SupabaseのTable Editorで `shop_line_credentials` テーブルに
   `shop_id` と `channel_access_token` を直接追加してもよい)。
5. 「店舗を登録する」をクリックすると、店舗データとStripe連携の土台、店舗管理者アカウントが
   一括で作成される。
6. 登録後、店舗一覧に表示される「サブスク会員証」「順番待ち」のトグルボタンから、
   後からでも利用範囲をいつでも変更できる。

---

## 10. 店舗側の設定(店舗管理者が実施)

店舗管理者は `/login` からログインし、`/dashboard` から以下を設定する
(手順9で「利用できるシステムの範囲」を絞った場合、該当しないメニューは表示されません)。

1. **サブスクプラン管理**(会員証機能を使う場合)
   - プラン名・月額料金・特典内容・月間利用回数上限・利用可能曜日/時間帯を設定して作成する。
   - 作成すると自動的にStripe側にも商品(Product)・価格(Price)が作られる。
2. **特典交換ルール管理**(来店ポイントを使う場合)
   - 必要ポイントと特典内容を設定する。
3. **順番待ち管理の設定**
   - 現状、1組あたりの目安時間・最大受付人数はSupabaseの `shops` テーブルの
     `waiting_minutes_per_group` / `waiting_max_capacity` を直接編集する運用になっています
     (専用の設定UIが必要な場合は追加開発してください)。

---

## 11. LINEリッチメニューの設定

店舗のLINE公式アカウントのトーク画面下部にメニューを表示する設定です(任意ですが推奨)。

1. `public/richmenu/README.md` を参照し、`public/richmenu/menu.png`
   (2500×843px)を用意する。
2. 以下のコマンドを実行する(店舗ごとに実行する)。
   ```bash
   LINE_CHANNEL_ACCESS_TOKEN=<その店舗のチャネルアクセストークン> \
   NEXT_PUBLIC_LIFF_ID=<手順5で取得したLIFF ID> \
   SHOP_ID=<Supabaseのshopsテーブルでのその店舗のid> \
   npm run richmenu:create
   ```
3. 実行後、その店舗のLINE公式アカウントの友だち全員にリッチメニューが表示される。

詳細は `docs/line-miniapp-setup.md` も参照してください。

---

## 12. 動作確認チェックリスト

### 利用者側
- [ ] 店舗のLINE公式アカウントのリッチメニュー(または `?shop=店舗ID` 付きのLIFF URL)から
      ミニアプリを開き、LINEログインが完了しホーム画面が表示される
- [ ] (会員証機能ONの店舗)プランに申し込み、Stripeのテストカード(`4242 4242 4242 4242`)で
      決済が完了し、会員証にQRコードが表示される
- [ ] (会員証機能OFFの店舗)ホーム画面に会員証・ポイント関連のカードが表示されない
- [ ] (順番待ち機能ONの店舗)順番待ちに登録し、受付番号と目安待ち時間が表示される
- [ ] (順番待ち機能OFFの店舗)ホーム画面に順番待ちのカードが表示されない

### 店舗側
- [ ] `/login` から店舗管理者アカウントでログインできる
- [ ] `/dashboard/waiting` で順番待ち一覧が表示され、「呼び出す」を押すと
      利用者にLINE通知が届く
- [ ] `/dashboard/qr` で利用者の会員証QRを読み取り、特典利用処理ができる
- [ ] `/dashboard/sales` で決済履歴・月別売上が表示される

### 運営側
- [ ] `/admin` から店舗の新規登録ができる
- [ ] 店舗一覧のトグルで機能ON/OFFを切り替えると、対象店舗の画面に即座に反映される
- [ ] `/admin/sales` で全店舗合算・店舗別の売上が確認できる

---

## 13. よくあるトラブル

| 症状 | 主な原因 |
|---|---|
| LIFF起動時に真っ白/エラーになる | LIFFのエンドポイントURLとVercelの実URLが不一致 / `NEXT_PUBLIC_LIFF_ID` が未設定 |
| 決済しても会員証にQRが出ない | Stripe WebhookのURL・署名シークレットが正しく設定されていない |
| 店舗側にLINE通知が届かない | その店舗の `shop_line_credentials` にチャネルアクセストークンが未登録、
または期限切れ |
| 順番待ちの一覧がリアルタイムに更新されない | Supabaseで `waiting_lists` テーブルのRealtimeが有効化されていない |
| 特定の店舗だけ会員証機能が使えるはずなのに出ない | 運営管理画面で `feature_subscription_enabled` がOFFのままになっている |

---

以上で本番公開まで完了です。追加の機能開発が必要な場合は `README.md` の
「未実装・拡張が必要な箇所」を参照してください。
