-- 既に supabase/schema.sql を実行済みの環境に対して、店舗ごとの機能範囲フラグを追加する。
-- 新規環境は schema.sql をそのまま実行すれば本マイグレーションは不要。

alter table shops
  add column if not exists feature_subscription_enabled boolean not null default true,
  add column if not exists feature_waiting_enabled boolean not null default true;
