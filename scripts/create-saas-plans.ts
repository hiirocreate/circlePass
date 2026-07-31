/**
 * 運営がSaaS利用料として店舗に請求する3プラン
 * (ライト/スタンダード/プレミアム)のStripe商品・価格を作成するスクリプト。
 *
 * 最初に1回だけ実行してください。実行すると3つのPrice IDが出力されるので、
 * それを .env の STRIPE_SAAS_PRICE_LIGHT / STANDARD / PREMIUM に設定します。
 *
 * 使い方:
 *   STRIPE_SECRET_KEY=sk_live_xxxx npx ts-node scripts/create-saas-plans.ts
 */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY の環境変数を設定してください");
  process.exit(1);
}

const PLANS = [
  { key: "light", name: "SaaS利用料 ライトプラン", amount: 3980 },
  { key: "standard", name: "SaaS利用料 スタンダードプラン", amount: 5980 },
  { key: "premium", name: "SaaS利用料 プレミアムプラン", amount: 9800 },
];

async function main() {
  // Stripe SDKをこのスクリプト単体でも使えるように動的import
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

  const results: Record<string, string> = {};

  for (const plan of PLANS) {
    const product = await stripe.products.create({ name: plan.name });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amount,
      currency: "jpy",
      recurring: { interval: "month" },
    });
    results[plan.key] = price.id;
    console.log(`${plan.name}: ${price.id}`);
  }

  console.log("\n以下を .env / Vercelの環境変数に設定してください:\n");
  console.log(`STRIPE_SAAS_PRICE_LIGHT=${results.light}`);
  console.log(`STRIPE_SAAS_PRICE_STANDARD=${results.standard}`);
  console.log(`STRIPE_SAAS_PRICE_PREMIUM=${results.premium}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
