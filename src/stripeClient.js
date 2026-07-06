/**
 * Client Stripe — récupère les identifiants via l'intégration Replit connectée
 * (jamais de clé API en dur dans le code ou les variables d'environnement).
 */
import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

/**
 * Récupère les identifiants Stripe depuis l'API de connexion Replit.
 * Pas de cache : les jetons peuvent tourner, on les récupère à chaque fois.
 */
async function getStripeCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Variables d'environnement Replit manquantes. Vérifiez que l'intégration Stripe est bien connectée (onglet Integrations)."
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!resp.ok) {
    throw new Error(`Échec de récupération des identifiants Stripe: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  const item = data.items?.[0];
  const settings = item?.settings;

  if (!settings?.secret) {
    throw new Error("Intégration Stripe non connectée ou clé secrète manquante. Connectez Stripe via l'onglet Integrations.");
  }

  return {
    secretKey: settings.secret,
    webhookSecret: item?.webhook_config?.signing_secret || item?.webhook_config?.secret || settings.webhook_secret,
  };
}

/**
 * Retourne un client Stripe authentifié (jamais mis en cache).
 */
export async function getUncachableStripeClient() {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

/**
 * Retourne une instance StripeSync fraîche pour la synchro webhook/DB.
 */
export async function getStripeSync() {
  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("NEON_DATABASE_URL ou DATABASE_URL requis pour l'intégration Stripe");
  }

  const { secretKey, webhookSecret } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? "",
  });
}
