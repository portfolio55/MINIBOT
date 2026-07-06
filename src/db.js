/**
 * Couche base de données PostgreSQL
 * Remplace les fichiers JSON pour bots, tokens, groupes, et config bot
 */
import pg from "pg";
import logger from "./utils/logger.js";

const { Pool } = pg;

// [OPTIMISÉ 300 BOTS] Pool avec configuration haute capacité
// NEON_DATABASE_URL a la priorité (base externe pour déploiement VPS) sur DATABASE_URL (Replit interne)
const CONNECTION_STRING = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

// [FIX] Neon ferme silencieusement les connexions inactives côté serveur (pooler serverless).
// Si notre pool garde une connexion "idle" plus longtemps que ça, la prochaine requête qui
// la réutilise échoue avec "Connection terminated due to connection timeout" — c'était la
// cause des lenteurs/échecs aléatoires (jusqu'à 100s) sur .ping/.menu/.url en production.
// On réduit idleTimeoutMillis pour que le pool recycle les connexions AVANT que Neon les tue,
// et on active le TCP keepAlive pour éviter les coupures réseau silencieuses.
const pool = new Pool({
  connectionString: CONNECTION_STRING,
  max: parseInt(process.env.DB_POOL_MAX || "50"),       // 50 connexions max (adapté pour 300 bots)
  min: parseInt(process.env.DB_POOL_MIN || "5"),        // 5 connexions minimum toujours prêtes
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || "20000"), // recycler avant que Neon coupe
  connectionTimeoutMillis: 10000,                       // Plus de temps pour obtenir une connexion sous charge
  statement_timeout: 30000,
  allowExitOnIdle: false,                               // Ne jamais fermer le pool
  keepAlive: true,                                      // évite les coupures TCP silencieuses
  keepAliveInitialDelayMillis: 5000,
  ssl: CONNECTION_STRING?.includes("localhost")
    ? false
    : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" }
});

// Statistiques du pool pour le monitoring
const poolStats = { totalQueries: 0, errors: 0, slowQueries: 0 };

pool.on("error", (err) => {
  poolStats.errors++;
  logger.error(`[DB] Erreur pool PostgreSQL: ${err.message}`);
});

/**
 * Exécute une requête SQL avec logging et monitoring
 * @param {string} text - Requête SQL paramétrée
 * @param {Array} params - Paramètres de la requête
 * @returns {Promise<import('pg').QueryResult>}
 */
// [FIX] Erreurs "de connexion" (connexion morte côté Neon, coupure réseau) vs erreurs
// "de requête" (SQL invalide, contrainte violée, etc.) : seules les premières valent la
// peine d'être retentées, car une connexion recyclée par le pool a de bonnes chances de
// fonctionner. Sans ce retry, UNE connexion périmée dans le pool suffisait à faire échouer
// (ou traîner jusqu'au timeout de la commande, ~60-100s) n'importe quelle commande WhatsApp.
const CONNECTION_ERROR_PATTERNS = [
  "Connection terminated",
  "connection timeout",
  "ECONNRESET",
  "ETIMEDOUT",
  "Connection ended unexpectedly",
  "server closed the connection",
];

function isRetryableConnectionError(err) {
  const msg = err?.message || "";
  return CONNECTION_ERROR_PATTERNS.some((p) => msg.includes(p));
}

export const query = async (text, params) => {
  const start = Date.now();
  poolStats.totalQueries++;
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 200) {
      poolStats.slowQueries++;
      logger.warn(`[DB] Requête lente (${duration}ms): ${text.slice(0, 80)}`);
    }
    return res;
  } catch (err) {
    if (isRetryableConnectionError(err)) {
      poolStats.connectionRetries = (poolStats.connectionRetries || 0) + 1;
      logger.warn(`[DB] Connexion périmée détectée, nouvelle tentative: ${err.message}`);
      try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 200) {
          poolStats.slowQueries++;
          logger.warn(`[DB] Requête lente après retry (${duration}ms): ${text.slice(0, 80)}`);
        }
        return res;
      } catch (retryErr) {
        poolStats.errors++;
        logger.error(`[DB] Erreur requête (après retry): ${retryErr.message} | SQL: ${text.slice(0, 120)}`);
        throw retryErr;
      }
    }
    poolStats.errors++;
    logger.error(`[DB] Erreur requête: ${err.message} | SQL: ${text.slice(0, 120)}`);
    throw err;
  }
};

/**
 * Retourne les statistiques du pool de connexions (pour /health et /admin)
 */
export function getPoolStats() {
  return {
    ...poolStats,
    poolSize: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
  };
}

/**
 * Vérifie la connectivité à la base de données
 * @returns {Promise<{ok: boolean, latencyMs?: number, error?: string}>}
 */
export async function checkDbHealth() {
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── BOTS ──────────────────────────────────────────────────────────────────

export async function dbInsertBot(uuid, phoneNumber, token) {
  await query(
    `INSERT INTO bots (uuid, phone_number, token, status)
     VALUES ($1, $2, $3, 'pairing')
     ON CONFLICT (uuid) DO NOTHING`,
    [uuid, phoneNumber, token]
  );
}

export async function dbUpdateBotStatus(uuid, status) {
  await query(
    `UPDATE bots
     SET status = $2, updated_at = NOW()
     WHERE uuid = $1`,
    [uuid, status]
  );
}

export async function dbGetBotByUUID(uuid) {
  const res = await query(
    `SELECT uuid, phone_number AS "phoneNumber", token, status,
            created_at AS "createdAt", updated_at AS "lastConnected"
     FROM bots WHERE uuid = $1`,
    [uuid]
  );
  return res.rows[0] || null;
}

export async function dbGetBotByToken(token) {
  const res = await query(
    `SELECT b.uuid, b.phone_number AS "phoneNumber", b.token, b.status,
            b.created_at AS "createdAt", b.updated_at AS "lastConnected"
     FROM bots b WHERE b.token = $1`,
    [token]
  );
  return res.rows[0] || null;
}

export async function dbDeleteBot(uuid) {
  await query(`DELETE FROM bots WHERE uuid = $1`, [uuid]);
}

export async function dbListAllBots() {
  const res = await query(
    `SELECT uuid, phone_number AS "phoneNumber", token, status,
            username, subscription_plan AS "subscriptionPlan",
            subscription_expires_at AS "subscriptionExpiresAt", trial_used AS "trialUsed",
            created_at AS "createdAt", updated_at AS "lastConnected"
     FROM bots ORDER BY created_at DESC`
  );
  return res.rows;
}

// ─── ABONNEMENTS / COMPTES UTILISATEURS ───────────────────────────────────

export async function dbSetBotAccount(uuid, { username, passwordHash, subscriptionPlan, subscriptionExpiresAt, trialUsed }) {
  await query(
    `UPDATE bots
     SET username = COALESCE($2, username),
         password_hash = COALESCE($3, password_hash),
         subscription_plan = COALESCE($4, subscription_plan),
         subscription_expires_at = COALESCE($5::timestamptz, subscription_expires_at),
         trial_used = COALESCE($6, trial_used),
         updated_at = NOW()
     WHERE uuid = $1`,
    [uuid, username || null, passwordHash || null, subscriptionPlan || null, subscriptionExpiresAt || null, trialUsed ?? null]
  );
}

export async function dbGetBotByUsername(username) {
  const res = await query(
    `SELECT uuid, phone_number AS "phoneNumber", token, status, username, password_hash AS "passwordHash",
            subscription_plan AS "subscriptionPlan", subscription_expires_at AS "subscriptionExpiresAt",
            trial_used AS "trialUsed"
     FROM bots WHERE username = $1`,
    [username]
  );
  return res.rows[0] || null;
}

export async function dbGetBotAccount(uuid) {
  const res = await query(
    `SELECT uuid, phone_number AS "phoneNumber", token, status, username,
            subscription_plan AS "subscriptionPlan", subscription_expires_at AS "subscriptionExpiresAt",
            trial_used AS "trialUsed"
     FROM bots WHERE uuid = $1`,
    [uuid]
  );
  return res.rows[0] || null;
}

// [ANTI-ABUS ESSAI 24H] Vérifie si un numéro a déjà consommé son essai gratuit,
// même si le bot lié a été supprimé depuis (contrairement à bots.trial_used qui
// disparaît avec la ligne lors d'une suppression).
export async function dbHasPhoneUsedTrial(phoneNumber) {
  const res = await query(
    `SELECT 1 FROM trial_phone_history WHERE phone_number = $1`,
    [phoneNumber]
  );
  return res.rows.length > 0;
}

export async function dbRecordTrialPhone(phoneNumber) {
  await query(
    `INSERT INTO trial_phone_history (phone_number) VALUES ($1) ON CONFLICT (phone_number) DO NOTHING`,
    [phoneNumber]
  );
}

// [ANTI-ABUS ESSAI 24H] Contrôle par IP, plus tolérant que le contrôle par numéro : une
// même adresse IP peut être partagée par de nombreuses personnes différentes (CGNAT des
// opérateurs mobiles), donc on ne bloque qu'à partir d'un certain nombre d'essais sur la
// même IP (IP_TRIAL_LIMIT), pas dès le premier comme pour les numéros de téléphone.
const IP_TRIAL_LIMIT = parseInt(process.env.IP_TRIAL_LIMIT || "3", 10);

export async function dbHasIpUsedTrial(ipAddress) {
  if (!ipAddress) return false;
  const res = await query(
    `SELECT COUNT(*)::int AS count FROM trial_ip_history WHERE ip_address = $1`,
    [ipAddress]
  );
  return res.rows[0].count >= IP_TRIAL_LIMIT;
}

export async function dbRecordTrialIp(ipAddress, phoneNumber = null) {
  if (!ipAddress) return;
  await query(
    `INSERT INTO trial_ip_history (ip_address, phone_number) VALUES ($1, $2)`,
    [ipAddress, phoneNumber]
  );
}

export async function dbGetExpiredSubscriptions() {
  const res = await query(
    `SELECT uuid, phone_number AS "phoneNumber", status, subscription_expires_at AS "subscriptionExpiresAt"
     FROM bots
     WHERE subscription_expires_at IS NOT NULL
       AND subscription_expires_at < NOW()
       AND status NOT IN ('logged_out', 'expired')`
  );
  return res.rows;
}

export async function dbExtendSubscription(uuid, plan, addMs) {
  const res = await query(
    `UPDATE bots
     SET subscription_plan = $2,
         subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, NOW()), NOW()) + ($3 || ' milliseconds')::interval,
         updated_at = NOW()
     WHERE uuid = $1
     RETURNING subscription_expires_at AS "subscriptionExpiresAt"`,
    [uuid, plan, String(addMs)]
  );
  return res.rows[0] || null;
}

// ─── STRIPE (moyen de paiement additionnel, en parallèle de MoneyFusion) ───

export async function dbSetStripeCustomerId(uuid, stripeCustomerId) {
  await query(
    `UPDATE bots SET stripe_customer_id = $2, updated_at = NOW() WHERE uuid = $1`,
    [uuid, stripeCustomerId]
  );
}

export async function dbLinkStripeSubscription(uuid, stripeCustomerId, stripeSubscriptionId) {
  await query(
    `UPDATE bots
     SET stripe_customer_id = $2, stripe_subscription_id = $3, updated_at = NOW()
     WHERE uuid = $1`,
    [uuid, stripeCustomerId, stripeSubscriptionId]
  );
}

export async function dbGetBotByStripeCustomerId(stripeCustomerId) {
  const res = await query(
    `SELECT uuid, phone_number AS "phoneNumber", stripe_customer_id AS "stripeCustomerId",
            stripe_subscription_id AS "stripeSubscriptionId"
     FROM bots WHERE stripe_customer_id = $1`,
    [stripeCustomerId]
  );
  return res.rows[0] || null;
}

// ─── PAIEMENTS ─────────────────────────────────────────────────────────────

export async function dbCreatePayment(uuid, plan, amount, mfToken) {
  const res = await query(
    `INSERT INTO payments (uuid, plan, amount, mf_token, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [uuid, plan, amount, mfToken]
  );
  return res.rows[0];
}

export async function dbGetPaymentByToken(mfToken) {
  const res = await query(`SELECT * FROM payments WHERE mf_token = $1`, [mfToken]);
  return res.rows[0] || null;
}

export async function dbConfirmPayment(mfToken) {
  const res = await query(
    `UPDATE payments
     SET status = 'paid', confirmed_at = NOW()
     WHERE mf_token = $1 AND status != 'paid'
     RETURNING *`,
    [mfToken]
  );
  return res.rows[0] || null;
}

// ─── BOT CONFIG ────────────────────────────────────────────────────────────

export async function dbGetBotConfig(uuid) {
  const res = await query(
    `SELECT owners, sudo_users AS "sudoUsers", prefix, prefix_mode AS "prefixMode",
            owner_lid AS "ownerLid", audio_url AS "audioUrl", branding
     FROM bot_config WHERE uuid = $1`,
    [uuid]
  );
  return res.rows[0] || null;
}

export async function dbUpsertBotConfig(uuid, fields) {
  const {
    owners, sudoUsers, prefix, prefixMode,
    ownerLid, audioUrl, branding
  } = fields;

  await query(
    `INSERT INTO bot_config (uuid, owners, sudo_users, prefix, prefix_mode, owner_lid, audio_url, branding, updated_at)
     VALUES ($1,
       COALESCE($2::jsonb, '[]'),
       COALESCE($3::jsonb, '[]'),
       COALESCE($4, '.'),
       COALESCE($5, true),
       $6, $7,
       COALESCE($8::jsonb, '{}'),
       NOW()
     )
     ON CONFLICT (uuid) DO UPDATE SET
       owners      = COALESCE(EXCLUDED.owners, bot_config.owners),
       sudo_users  = COALESCE(EXCLUDED.sudo_users, bot_config.sudo_users),
       prefix      = COALESCE(EXCLUDED.prefix, bot_config.prefix),
       prefix_mode = COALESCE(EXCLUDED.prefix_mode, bot_config.prefix_mode),
       owner_lid   = COALESCE(EXCLUDED.owner_lid, bot_config.owner_lid),
       audio_url   = COALESCE(EXCLUDED.audio_url, bot_config.audio_url),
       branding    = COALESCE(EXCLUDED.branding, bot_config.branding),
       updated_at  = NOW()`,
    [
      uuid,
      owners !== undefined ? JSON.stringify(owners) : null,
      sudoUsers !== undefined ? JSON.stringify(sudoUsers) : null,
      prefix || null,
      prefixMode !== undefined ? prefixMode : null,
      ownerLid || null,
      audioUrl || null,
      branding !== undefined ? JSON.stringify(branding) : null
    ]
  );
}

export async function dbUpdateBotField(uuid, field, value) {
  const allowed = {
    owners:      `owners = $2::jsonb`,
    sudoUsers:   `sudo_users = $2::jsonb`,
    prefix:      `prefix = $2`,
    prefixMode:  `prefix_mode = $2`,
    ownerLid:    `owner_lid = $2`,
    audioUrl:    `audio_url = $2`,
    branding:    `branding = $2::jsonb`
  };
  const setClause = allowed[field];
  if (!setClause) throw new Error(`Champ bot_config inconnu: ${field}`);

  const val = (field === "owners" || field === "sudoUsers" || field === "branding")
    ? JSON.stringify(value)
    : value;

  await query(
    `INSERT INTO bot_config (uuid, ${field === "sudoUsers" ? "sudo_users" : field === "prefixMode" ? "prefix_mode" : field === "ownerLid" ? "owner_lid" : field === "audioUrl" ? "audio_url" : field})
       VALUES ($1, $2${(field === "owners" || field === "sudoUsers" || field === "branding") ? "::jsonb" : ""})
     ON CONFLICT (uuid) DO UPDATE SET ${setClause}, updated_at = NOW()`,
    [uuid, val]
  );
}

// ─── GROUP PROTECTIONS ────────────────────────────────────────────────────

export async function dbGetAllGroupProtections(uuid) {
  const res = await query(
    `SELECT group_jid AS "groupJid", protections
     FROM group_protections WHERE uuid = $1`,
    [uuid]
  );
  return res.rows;
}

export async function dbSetGroupProtections(uuid, groupJid, protections) {
  await query(
    `INSERT INTO group_protections (uuid, group_jid, protections, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (uuid, group_jid) DO UPDATE SET
       protections = $3::jsonb,
       updated_at  = NOW()`,
    [uuid, groupJid, JSON.stringify(protections)]
  );
}

export async function dbDeleteBotGroups(uuid) {
  await query(`DELETE FROM group_protections WHERE uuid = $1`, [uuid]);
}

// ─── INITIALISATION DES INDEX (pour 300+ bots) ──────────────────────────────

/**
 * Crée les index nécessaires pour les performances à grande échelle.
 * Appelé au démarrage du serveur.
 */
export async function ensureIndexes() {
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_baileys_auth_uuid ON baileys_auth (uuid);
      CREATE INDEX IF NOT EXISTS idx_baileys_auth_uuid_key ON baileys_auth (uuid, key);
      CREATE INDEX IF NOT EXISTS idx_bots_status ON bots (status);
      CREATE INDEX IF NOT EXISTS idx_bots_token ON bots (token);
      CREATE INDEX IF NOT EXISTS idx_bot_config_uuid ON bot_config (uuid);
      CREATE INDEX IF NOT EXISTS idx_group_protections_uuid ON group_protections (uuid);
    `);
    logger.info(`[DB] Index créés/vérifiés pour performances 300+ bots`);
  } catch (err) {
    logger.warn(`[DB] Erreur création index (non-bloquant): ${err.message}`);
  }
}

export default pool;
