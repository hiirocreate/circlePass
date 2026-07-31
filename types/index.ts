export type Shop = {
  id: string;
  name: string;
  phone: string | null;
  business_hours: string | null;
  regular_holiday: string | null;
  logo_url: string | null;
  line_oa_url: string | null;
  accent_color: string;
  is_active: boolean;
  feature_subscription_enabled: boolean;
  feature_waiting_enabled: boolean;
  waiting_minutes_per_group: number;
  waiting_max_capacity: number;
  waiting_line_notify: boolean;
};

export type SubscriptionPlan = {
  id: string;
  shop_id: string;
  plan_name: string;
  price: number;
  description: string | null;
  usage_limit: number | null;
  available_days: string[] | null;
  available_time_start: string | null;
  available_time_end: string | null;
  auto_renew: boolean;
  stripe_price_id: string | null;
  is_active: boolean;
};

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "expired";

export type Subscription = {
  id: string;
  user_id: string;
  plan_id: string;
  shop_id: string;
  status: SubscriptionStatus;
  current_period_end: string | null;
  next_payment_date: string | null;
};

export type WaitingStatus = "waiting" | "calling" | "completed" | "canceled";

export type WaitingList = {
  id: string;
  user_id: string;
  shop_id: string;
  people_count: number;
  name: string;
  memo: string | null;
  waiting_number: number;
  estimated_wait_minutes: number | null;
  status: WaitingStatus;
  created_at: string;
};
