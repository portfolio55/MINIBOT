/**
 * Rate Limiter pour les commandes bot - SIGMA MDX DEPLOY
 * 
 * Protège contre le spam de commandes par utilisateur.
 * Utilise un algorithme de fenêtre glissante en mémoire.
 */
import logger from "./logger.js";

// ─── Configuration ────────────────────────────────────────────────────────────
const DEFAULT_WINDOW_MS = parseInt(process.env.CMD_RATE_WINDOW_MS || "10000"); // 10 secondes
const DEFAULT_MAX_COMMANDS = parseInt(process.env.CMD_RATE_MAX || "5"); // 5 commandes par fenêtre
const CLEANUP_INTERVAL_MS = 60000; // Nettoyage toutes les minutes

// ─── Stockage ─────────────────────────────────────────────────────────────────
const userCommandHistory = new Map();

// Nettoyage périodique pour éviter les fuites mémoire
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, timestamps] of userCommandHistory) {
    // Supprimer les entrées expirées
    const valid = timestamps.filter(t => now - t < DEFAULT_WINDOW_MS * 2);
    if (valid.length === 0) {
      userCommandHistory.delete(key);
      cleaned++;
    } else {
      userCommandHistory.set(key, valid);
    }
  }
  if (cleaned > 0) {
    logger.debug(`[RATE-LIMIT] Nettoyage: ${cleaned} entrées supprimées, ${userCommandHistory.size} restantes`);
  }
}, CLEANUP_INTERVAL_MS);
cleanupInterval.unref();

/**
 * Vérifie si un utilisateur peut exécuter une commande
 * @param {string} userId - Identifiant unique de l'utilisateur (JID)
 * @param {string} botUuid - UUID du bot (pour isoler les limites par bot)
 * @param {object} options - Options personnalisées
 * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
 */
export function checkCommandRate(userId, botUuid, options = {}) {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    maxCommands = DEFAULT_MAX_COMMANDS,
  } = options;

  const key = `${botUuid}:${userId}`;
  const now = Date.now();

  // Récupérer l'historique des commandes
  let timestamps = userCommandHistory.get(key) || [];

  // Filtrer les timestamps dans la fenêtre
  timestamps = timestamps.filter(t => now - t < windowMs);

  if (timestamps.length >= maxCommands) {
    // Rate limit atteint
    const oldestInWindow = timestamps[0];
    const resetMs = windowMs - (now - oldestInWindow);
    return { allowed: false, remaining: 0, resetMs };
  }

  // Ajouter le timestamp actuel
  timestamps.push(now);
  userCommandHistory.set(key, timestamps);

  return {
    allowed: true,
    remaining: maxCommands - timestamps.length,
    resetMs: 0,
  };
}

/**
 * Réinitialise le rate limit pour un utilisateur (ex: après un unban)
 */
export function resetUserRate(userId, botUuid) {
  const key = `${botUuid}:${userId}`;
  userCommandHistory.delete(key);
}

/**
 * Retourne les statistiques du rate limiter
 */
export function getRateLimitStats() {
  return {
    trackedUsers: userCommandHistory.size,
    windowMs: DEFAULT_WINDOW_MS,
    maxCommands: DEFAULT_MAX_COMMANDS,
  };
}

export default { checkCommandRate, resetUserRate, getRateLimitStats };
