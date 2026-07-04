/**
 * Configuration centralisée - SIGMA MDX DEPLOY
 * 
 * Toutes les variables d'environnement sont lues ici et exportées
 * sous forme d'objet typé et validé. Évite les process.env dispersés.
 */
import dotenv from "dotenv";
dotenv.config();

function getInt(key, defaultValue) {
  const val = process.env[key];
  if (val === undefined || val === "") return defaultValue;
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function getBool(key, defaultValue) {
  const val = process.env[key];
  if (val === undefined || val === "") return defaultValue;
  return val === "true" || val === "1";
}

function getString(key, defaultValue = "") {
  return process.env[key] || defaultValue;
}

// ─── Export de la configuration ───────────────────────────────────────────────
export const config = {
  // Serveur
  server: {
    port: getInt("PORT", 5000),
    host: getString("HOST", "0.0.0.0"),
    publicUrl: getString("PUBLIC_URL"),
    domain: getString("DOMAIN"),
    trustProxy: getBool("TRUST_PROXY", false),
  },

  // Sécurité
  security: {
    adminPassword: getString("ADMIN_PASSWORD", "admin123"),
    jwtSecret: getString("JWT_SECRET"),
    maxFailedAttempts: getInt("MAX_FAILED_ATTEMPTS", 5),
    lockoutDurationMs: getInt("LOCKOUT_DURATION_MS", 900000),
    allowedOrigins: getString("ALLOWED_ORIGINS", "*").split(",").map(s => s.trim()),
  },

  // Base de données
  database: {
    url: getString("DATABASE_URL"),
    poolMax: getInt("DB_POOL_MAX", 20),
    poolMin: getInt("DB_POOL_MIN", 2),
    sslRejectUnauthorized: getBool("DB_SSL_REJECT_UNAUTHORIZED", false),
  },

  // Bots
  bots: {
    maxBots: getInt("MAX_BOTS", 300),
    sendMinDelayMs: getInt("BOT_SEND_MIN_DELAY_MS", 350),
    maxQueueSize: getInt("BOT_MAX_QUEUE_SIZE", 500),
    sendTtlMs: getInt("BOT_SEND_TTL_MS", 30000),
    cmdTimeoutMs: getInt("CMD_TIMEOUT_MS", 15000),
    reconnectConcurrency: getInt("BOT_RECONNECT_CONCURRENCY", 15),
    reconnectDelayMs: getInt("BOT_RECONNECT_DELAY_MS", 150),
  },

  // Rate limiting commandes
  rateLimit: {
    windowMs: getInt("CMD_RATE_WINDOW_MS", 10000),
    maxCommands: getInt("CMD_RATE_MAX", 5),
  },

  // Mémoire
  memory: {
    heapWarningMB: getInt("HEAP_WARNING_MB", 512),
    heapCriticalMB: getInt("HEAP_CRITICAL_MB", 1024),
    checkIntervalMs: getInt("MEMORY_CHECK_INTERVAL_MS", 30000),
  },

  // Logging
  logging: {
    level: getString("LOG_LEVEL", "info"),
    colors: getBool("LOG_COLORS", true),
  },

  // APIs externes
  apis: {
    giftedApiKey: getString("GIFTED_API_KEY", "gifted"),
    openaiApiKey: getString("OPENAI_API_KEY"),
  },
};

export default config;
