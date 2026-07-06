/**
 * Crée les produits/prix Stripe correspondant aux plans d'abonnement SIGMA MDX
 * (paiement par carte, en plus de MoneyFusion — récurrent, mode "subscription").
 *
 * Idempotent : vérifie l'existence avant de créer.
 *
 * Usage: node scripts/seed-stripe-products.js
 *
 * Après exécution, copiez le JSON affiché dans la variable d'environnement
 * STRIPE_PRICE_MAP pour que le serveur sache faire correspondre chaque price_id
 * Stripe à un plan (utilisé par /api/stripe/checkout et le webhook).
 *
 * Prix par défaut en EUR (Stripe cible surtout les paiements internationaux par
 * carte ; MoneyFusion reste le moyen de paiement principal en FCFA / mobile money
 * pour l'Afrique). Ajustez STRIPE_PRICE_EUR_* si besoin avant de lancer le script.
 */
import "dotenv/config";
import { getUncachableStripeClient } from "../src/stripeClient.js";

const PLANS = [
  { key: "2days", label: "2 jours", intervalCount: 2, interval: "day", amountCents: parseInt(process.env.STRIPE_PRICE_EUR_2DAYS || "100", 10) },
  { key: "week", label: "1 semaine", intervalCount: 1, interval: "week", amountCents: parseInt(process.env.STRIPE_PRICE_EUR_WEEK || "200", 10) },
  { key: "month", label: "1 mois", intervalCount: 1, interval: "month", amountCents: parseInt(process.env.STRIPE_PRICE_EUR_MONTH || "500", 10) },
];

async function main() {
  const stripe = await getUncachableStripeClient();
  const priceMap = {};

  for (const plan of PLANS) {
    const productName = `SIGMA MDX - ${plan.label}`;
    const existing = await stripe.products.search({ query: `name:'${productName}' AND active:'true'` });

    let product = existing.data[0];
    if (product) {
      console.log(`Produit déjà existant: ${productName} (${product.id})`);
    } else {
      product = await stripe.products.create({
        name: productName,
        description: `Abonnement SIGMA MDX - ${plan.label} (paiement par carte)`,
        metadata: { plan: plan.key },
      });
      console.log(`Produit créé: ${productName} (${product.id})`);
    }

    const existingPrices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
    let price = existingPrices.data.find(
      (p) => p.recurring?.interval === plan.interval && p.recurring?.interval_count === plan.intervalCount && p.unit_amount === plan.amountCents
    );

    if (price) {
      console.log(`Prix déjà existant pour ${plan.key}: ${price.id}`);
    } else {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.amountCents,
        currency: "eur",
        recurring: { interval: plan.interval, interval_count: plan.intervalCount },
        metadata: { plan: plan.key },
      });
      console.log(`Prix créé pour ${plan.key}: ${price.id} (${(plan.amountCents / 100).toFixed(2)} EUR / ${plan.intervalCount} ${plan.interval})`);
    }

    priceMap[price.id] = plan.key;
  }

  console.log("\n✓ Terminé. Ajoutez cette variable d'environnement STRIPE_PRICE_MAP:");
  console.log(JSON.stringify(priceMap));
}

main().catch((err) => {
  console.error("Erreur lors du seed des produits Stripe:", err.message);
  process.exit(1);
});
