-- =========================================================
-- LINE Mini App SaaS (サブスク会員証 + 順番待ちシステム)
-- Supabase スキーマ定義
-- =========================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- 運営 / 店舗管理者アカウント (管理画面ログイン用)
-- Supabase Auth の auth.users と1:1で紐付ける
-- ---------------------------------------------------------
create type admin_role as enum ('operator', 'shop_admin');

create table admins (
  id uuid primary key references auth.users(id) on delete cascade,
  role admin_role not null default 'shop_admin',
  shop_id uuid, -- shop_admin の場合のみセット (operatorはNULL=全店舗管理)
  name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 店舗
-- ---------------------------------------------------------
create table shops (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  business_hours text, -- 例: "11:00-23:00"
  regular_holiday text, -- 定休日
  logo_url text,
  line_oa_url text, -- LINE公式アカウントURL
  qr_image_url text,
  accent_color text default '#EA580C', -- 店舗ごとのアクセントカラー(デフォルトはオレンジ)
  is_active boolean not null default true, -- 運営による強制停止フラグ
  -- 運営側で調整可能な、店舗ごとに利用できる機能範囲
  -- (例: 順番待ちシステムのみ利用したい店舗はfeature_subscription_enabledをfalseにする)
  feature_subscription_enabled boolean not null default true, -- サブスク会員証・来店ポイント・QR機能
  feature_waiting_enabled boolean not null default true, -- 順番待ちシステム
  -- SaaS契約プラン(店舗自身がSaaS利用料を払う側)
  saas_plan text not null default 'light' check (saas_plan in ('light','standard','premium')),
  saas_stripe_subscription_id text,
  waiting_minutes_per_group integer not null default 15, -- 1組あたりの目安待ち時間(分)
  waiting_max_capacity integer not null default 50, -- 順番待ち最大受付人数
  waiting_line_notify boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table admins
  add constraint admins_shop_id_fkey foreign key (shop_id) references shops(id) on delete cascade;

-- ---------------------------------------------------------
-- 店舗ごとのLINE公式アカウント(Messaging API)認証情報
-- shops テーブルは利用者アプリから select("*") で読まれる(誰でも閲覧可)ため、
-- チャネルアクセストークンのような秘匿情報は別テーブルに分離し、
-- サーバー側(Service Role Key)からのみアクセスする。
-- ---------------------------------------------------------
create table shop_line_credentials (
  shop_id uuid primary key references shops(id) on delete cascade,
  channel_access_token text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 利用者 (LINEログインユーザー)
-- ---------------------------------------------------------
create table users (
  id uuid primary key default uuid_generate_v4(),
  line_id text not null unique,
  name text not null,
  icon_url text,
  created_at timestamptz not null default now()
);

-- 利用者と店舗の関係(どの店舗の会員か)。1ユーザーが複数店舗の会員証を持てる設計
create table user_shop_memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  member_rank text default 'レギュラー', -- 会員ランク
  points integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, shop_id)
);

-- ---------------------------------------------------------
-- サブスクプラン (店舗が作成)
-- ---------------------------------------------------------
create table subscription_plans (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  plan_name text not null,
  price integer not null, -- 円
  description text,
  usage_limit integer, -- 月の利用回数上限。NULLなら無制限
  available_days text[], -- 例: ['mon','tue',...] NULLなら制限なし
  available_time_start time,
  available_time_end time,
  auto_renew boolean not null default true,
  stripe_price_id text, -- Stripe Price ID
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- サブスク契約
-- ---------------------------------------------------------
create type subscription_status as enum ('active', 'past_due', 'canceled', 'expired');

create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  plan_id uuid not null references subscription_plans(id),
  shop_id uuid not null references shops(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status subscription_status not null default 'active',
  current_period_end timestamptz,
  next_payment_date timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now()
);

-- サブスク利用履歴 (QR読み取りで特典利用時に記録)
create table subscription_histories (
  id uuid primary key default uuid_generate_v4(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  used_type text not null, -- 'drink_free' | 'point' | 'all_you_can_drink' | 'other'
  memo text,
  created_at timestamptz not null default now()
);

-- Stripe決済履歴
create table payment_histories (
  id uuid primary key default uuid_generate_v4(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  stripe_invoice_id text,
  amount integer not null,
  status text not null, -- 'paid' | 'failed'
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 来店ポイント履歴
-- ---------------------------------------------------------
create table point_histories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  point integer not null, -- 付与はプラス、消費はマイナス
  description text,
  created_at timestamptz not null default now()
);

-- 特典交換ルール (店舗設定: 必要ポイントと特典内容)
create table point_rewards (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  required_points integer not null,
  reward_description text not null,
  is_active boolean not null default true
);

create type redemption_status as enum ('pending', 'completed', 'canceled');

-- 特典交換の申請〜店舗側QR確認〜完了までを管理する
-- ポイントは申請時点では減算せず、店舗側がQR確認して完了した時点で減算する
create table reward_redemptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  reward_id uuid not null references point_rewards(id),
  points_used integer not null,
  status redemption_status not null default 'pending',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------
-- 順番待ち
-- ---------------------------------------------------------
create type waiting_status as enum ('waiting', 'calling', 'completed', 'canceled');

create table waiting_lists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  people_count integer not null,
  name text not null,
  memo text,
  waiting_number integer not null, -- 当日の受付連番
  estimated_wait_minutes integer,
  status waiting_status not null default 'waiting',
  notified_remaining_3 boolean not null default false,
  called_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_waiting_lists_shop_status on waiting_lists(shop_id, status, created_at);

-- ---------------------------------------------------------
-- お知らせ配信 (運営から店舗/利用者への一斉通知)
-- ---------------------------------------------------------
create table announcements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text not null,
  target text not null default 'all', -- 'all' | 'shops' | 'users'
  created_at timestamptz not null default now()
);

-- =========================================================
-- Row Level Security
-- =========================================================
alter table shops enable row level security;
alter table users enable row level security;
alter table user_shop_memberships enable row level security;
alter table subscription_plans enable row level security;
alter table subscriptions enable row level security;
alter table subscription_histories enable row level security;
alter table payment_histories enable row level security;
alter table point_histories enable row level security;
alter table point_rewards enable row level security;
alter table reward_redemptions enable row level security;
alter table waiting_lists enable row level security;
alter table admins enable row level security;
alter table announcements enable row level security;
alter table shop_line_credentials enable row level security;

-- 補助関数: 現在ログイン中のadminのroleとshop_idを取得
create or replace function current_admin_role() returns admin_role
language sql stable security definer as $$
  select role from admins where id = auth.uid();
$$;

create or replace function current_admin_shop_id() returns uuid
language sql stable security definer as $$
  select shop_id from admins where id = auth.uid();
$$;

-- 店舗: 誰でも閲覧可(利用者アプリで店舗情報を出すため)、更新は運営 or 自店舗の管理者のみ
create policy shops_select_all on shops for select using (true);
create policy shops_update_own on shops for update using (
  current_admin_role() = 'operator' or id = current_admin_shop_id()
);
create policy shops_insert_operator on shops for insert with check (current_admin_role() = 'operator');

-- サブスクプラン: 誰でも閲覧可、編集は運営 or 自店舗の管理者
create policy plans_select_all on subscription_plans for select using (true);
create policy plans_write_own_shop on subscription_plans for all using (
  current_admin_role() = 'operator' or shop_id = current_admin_shop_id()
);

-- 順番待ち: 店舗管理者は自店舗分のみ操作可。運営は全件。
create policy waiting_admin_own_shop on waiting_lists for all using (
  current_admin_role() = 'operator' or shop_id = current_admin_shop_id()
);

-- サブスク契約・履歴・ポイント: 店舗管理者は自店舗分のみ
create policy subscriptions_admin_own_shop on subscriptions for all using (
  current_admin_role() = 'operator' or shop_id = current_admin_shop_id()
);

-- 決済履歴: subscriptions経由でshop_idを判定し、運営 or 自店舗の管理者のみ参照可
create policy payment_histories_admin_own_shop on payment_histories for all using (
  current_admin_role() = 'operator' or exists (
    select 1 from subscriptions s
    where s.id = payment_histories.subscription_id
      and s.shop_id = current_admin_shop_id()
  )
);
create policy point_histories_admin_own_shop on point_histories for all using (
  current_admin_role() = 'operator' or shop_id = current_admin_shop_id()
);
-- 特典交換ルール: 誰でも閲覧可(利用者アプリで一覧表示するため)、編集は運営 or 自店舗の管理者
create policy point_rewards_select_all on point_rewards for select using (true);
create policy point_rewards_admin_own_shop on point_rewards for all using (
  current_admin_role() = 'operator' or shop_id = current_admin_shop_id()
);
create policy reward_redemptions_admin_own_shop on reward_redemptions for all using (
  current_admin_role() = 'operator' or shop_id = current_admin_shop_id()
);

-- 店舗ごとのLINEチャネルアクセストークン: 運営 or 自店舗の管理者のみ(利用者アプリからは不可)
create policy shop_line_credentials_admin_own_shop on shop_line_credentials for all using (
  current_admin_role() = 'operator' or shop_id = current_admin_shop_id()
);

-- admins テーブル: 本人と運営のみ閲覧可
create policy admins_select_self_or_operator on admins for select using (
  id = auth.uid() or current_admin_role() = 'operator'
);
create policy admins_write_operator_only on admins for insert with check (current_admin_role() = 'operator');
create policy admins_update_operator_only on admins for update using (current_admin_role() = 'operator');

-- announcements: 運営のみ書き込み、全員閲覧可
create policy announcements_select_all on announcements for select using (true);
create policy announcements_write_operator on announcements for insert with check (current_admin_role() = 'operator');

-- users / memberships / histories はサーバー側(Service Role Key)からのみ操作する想定のため
-- クライアント直接アクセスは許可しない(ポリシー未作成 = デフォルトで全拒否)。
-- LINEログインは独自セッション(JWT)管理のため、Supabase Authのuidとは別軸で
-- API Route(app/api配下)がService Role Keyを使って処理する。

-- =========================================================
-- updated_at 自動更新トリガー
-- =========================================================
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger shops_set_updated_at before update on shops
for each row execute function set_updated_at();

-- =========================================================
-- Realtime
-- 店舗側の順番待ち管理画面・利用者の待ち状況画面をリアルタイム反映するため
-- waiting_lists の変更をSupabase Realtimeで配信する
-- =========================================================
alter publication supabase_realtime add table waiting_lists;
