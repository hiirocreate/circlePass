# LINEミニアプリ設定手順

## 1. LINE Developersでの準備

1. [LINE Developers Console](https://developers.line.biz/console/) で「プロバイダー」を作成する。
2. 「LINEログイン」チャネルを作成する(または既存のものを使う)。
   - チャネルの「LIFF」タブから新規LIFFアプリを追加する。
     - **サイズ**: `Full`(会員証やフォーム入力があるため全画面表示を推奨)
     - **エンドポイントURL**: `https://<your-domain>.vercel.app`(本アプリのデプロイ先)
     - **Scope**: `profile`, `openid` にチェック
     - **ボットリンク機能**: 店舗のLINE公式アカウントと連携する場合は `On (Aggressive)` を推奨
       (友だち追加を促し、通知を届けやすくするため)
   - 発行された **LIFF ID** を `.env` の `NEXT_PUBLIC_LIFF_ID` に設定する。
   - チャネルの「チャネル基本設定」から **Channel ID** を取得し `LINE_CHANNEL_ID` に設定する
     (`/api/auth/line/callback` でのid_token検証に使用)。
3. 店舗ごとにLINE公式アカウント(Messaging APIチャネル)を用意し、
   「Messaging API設定」から **チャネルアクセストークン** を発行して控えておく
   (リッチメニュー作成・通知送信に使用。店舗ごとに異なる値になる)。

> 補足: 本システムは1つのLIFFアプリを全店舗で共有し、`?shop=<店舗ID>` のクエリパラメータで
> 店舗を判別する設計です(`lib/useShopId.ts`)。通知の送信元(LINE公式アカウント)は
> 店舗ごとに分かれるため、`LINE_CHANNEL_ACCESS_TOKEN` は本来店舗ごとに異なりますが、
> 現状の実装は環境変数1つのみを想定した簡易構成です。店舗ごとに異なるチャネルを使う場合は
> `shops` テーブルに `line_channel_access_token` 列を追加し、`lib/line.ts` の
> `sendLineMessage` で店舗ごとの値を使うよう拡張してください。

## 2. リッチメニューの設定

店舗のLINE公式アカウントのトーク画面下部に表示される、ホーム/会員証/順番待ちへの
ショートカットメニューです。`scripts/create-rich-menu.ts` で作成します。

1. `public/richmenu/menu.png` にメニュー画像を配置する(`public/richmenu/README.md` 参照)。
2. 以下を実行する(店舗ごとに `SHOP_ID` を変えて店舗の数だけ実行する):

   ```bash
   LINE_CHANNEL_ACCESS_TOKEN=<その店舗のMessaging APIチャネルアクセストークン> \
   NEXT_PUBLIC_LIFF_ID=<LIFF ID> \
   SHOP_ID=<shopsテーブルのid> \
   npm run richmenu:create
   ```

3. 実行後、該当LINE公式アカウントの友だち全員にリッチメニューが表示されます。
4. メニューのタップ領域は `https://liff.line.me/<LIFF ID>/home?shop=<SHOP_ID>` のように
   LIFF URLにパスとクエリパラメータを付与する形でホーム/会員証/順番待ち画面へ直接遷移します。

## 3. Webマニフェスト

`app/manifest.ts` でアプリ名・アイコン・テーマカラーを定義しています
(LINEのWebView上でホーム画面に追加された際の表示や、将来的なPWA化に対応するため)。
`public/icons/icon-192.png` と `public/icons/icon-512.png` を用意してください
(店舗共通のアプリアイコンとして使う想定。店舗ごとのロゴは `shops.logo_url` で
アプリ内に表示されます)。

## 4. LINEミニアプリとして公式に公開する場合

LINEの「ミニアプリ」タブ(Discover)に掲載する公式な「LINE Mini App」として申請する場合は、
LIFFアプリとは別に LINE Developers Console 上で追加の審査申請(サービス名・カテゴリ・
利用規約URL・問い合わせ先などの入力)が必要です。これはコンソール上の手続きのため
コードでは対応できません。個別店舗向けの非公開運用(友だち追加したユーザーのみが
リッチメニュー経由で利用する形)であれば、上記1〜3の設定のみで運用可能です。
