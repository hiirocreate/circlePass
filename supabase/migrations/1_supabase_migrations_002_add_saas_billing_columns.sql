-- 既に supabase/schema.sql を実行済みの環境に対して、
-- 店舗→運営のSaaS利用料決済に必要なカラムを追加する。
-- 新規環境は schema.sql をそのまま実行すれば本マイグレーションは不要。

alter table shops
  add column if not exists saas_stripe_customer_id text,
  add column if not exists saas_payment_status text not null default 'unpaid';

-- CHECK制約は add column では付けられないため別途追加
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shops_saas_payment_status_check'
  ) then
    alter table shops
      add constraint shops_saas_payment_status_check
      check (saas_payment_status in ('unpaid','active','past_due','canceled'));
  end if;
end $$;
