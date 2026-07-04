/**
 * Logger personnalisé pour la plateforme
 * 
 * [AMÉLIORÉ] Ajout de métriques de logging, logging structuré,
 * et export des compteurs pour le monitoring.
 */
import pino from "pino";

// ─── Configuration Pino ───────────────────────────────────────────────────────
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: process.env.LOG_COLORS !== "false",
      ignore: "pid,hostname",
      translateTime: "HH:MM:ss",
      singleLine: false
    }
  },
  base: null
});

// ─── Métriques internes ───────────────────────────────────────────────────────
const metrics = {
  debug: 0,
  info: 0,
  warn: 0,
  error: 0,
  startedAt: Date.now(),
};

// ─── Wrapper avec métriques ───────────────────────────────────────────────────
const logger = {
  debug(message, ...args) {
    metrics.debug++;
    pinoLogger.debug(message, ...args);
  },

  info(message, ...args) {
    metrics.info++;
    pinoLogger.info(message, ...args);
  },

  warn(message, ...args) {
    metrics.warn++;
    pinoLogger.warn(message, ...args);
  },

  error(message, ...args) {
    metrics.error++;
    pinoLogger.error(message, ...args);
  },

  fatal(message, ...args) {
    metrics.error++;
    pinoLogger.fatal(message, ...args);
  },

  /**
   * Retourne les métriques de logging (pour /health et /admin)
   */
  getMetrics() {
    return {
      ...metrics,
      uptimeMs: Date.now() - metrics.startedAt,
      currentLevel: process.env.LOG_LEVEL || "info",
    };
  },

  /**
   * Log structuré avec contexte additionnel
   * @param {string} level - Niveau de log
   * @param {string} message - Message principal
   * @param {object} context - Données contextuelles
   */
  structured(level, message, context = {}) {
    if (typeof pinoLogger[level] === "function") {
      pinoLogger[level](context, message);
      metrics[level] = (metrics[level] || 0) + 1;
    }
  },

  /**
   * Accès direct au logger pino sous-jacent (pour les cas avancés)
   */
  get pino() {
    return pinoLogger;
  },
};

export default logger;
