/**
 * Memory Guard - SIGMA MDX DEPLOY
 * 
 * Surveille l'utilisation mémoire et déclenche des alertes
 * ou des actions correctives en cas de dépassement.
 */
import logger from "./logger.js";

// ─── Configuration ────────────────────────────────────────────────────────────
const HEAP_WARNING_MB = parseInt(process.env.HEAP_WARNING_MB || "512");
const HEAP_CRITICAL_MB = parseInt(process.env.HEAP_CRITICAL_MB || "1024");
const CHECK_INTERVAL_MS = parseInt(process.env.MEMORY_CHECK_INTERVAL_MS || "30000");

let lastWarningAt = 0;
let warningCount = 0;
let intervalHandle = null;

/**
 * Vérifie l'utilisation mémoire et log des alertes si nécessaire
 */
function checkMemory() {
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);

  if (heapUsedMB >= HEAP_CRITICAL_MB) {
    warningCount++;
    logger.error(
      `🚨 [MEMORY] CRITIQUE: Heap ${heapUsedMB}MB / RSS ${rssMB}MB (seuil: ${HEAP_CRITICAL_MB}MB)`
    );

    // Forcer un garbage collection si disponible (--expose-gc)
    if (global.gc) {
      logger.warn("[MEMORY] Forçage du garbage collection...");
      global.gc();
    }
  } else if (heapUsedMB >= HEAP_WARNING_MB) {
    const now = Date.now();
    // Ne pas spammer les warnings (max 1 par minute)
    if (now - lastWarningAt > 60000) {
      warningCount++;
      lastWarningAt = now;
      logger.warn(
        `⚠️ [MEMORY] Heap élevé: ${heapUsedMB}MB / RSS ${rssMB}MB (seuil warning: ${HEAP_WARNING_MB}MB)`
      );
    }
  }
}

/**
 * Démarre la surveillance mémoire périodique
 */
export function startMemoryGuard() {
  if (intervalHandle) return; // Déjà démarré

  logger.info(
    `[MEMORY] Guard démarré (warning: ${HEAP_WARNING_MB}MB, critical: ${HEAP_CRITICAL_MB}MB, interval: ${CHECK_INTERVAL_MS}ms)`
  );

  intervalHandle = setInterval(checkMemory, CHECK_INTERVAL_MS);
  intervalHandle.unref(); // Ne pas empêcher le processus de s'arrêter
}

/**
 * Arrête la surveillance mémoire
 */
export function stopMemoryGuard() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/**
 * Retourne les statistiques mémoire actuelles
 */
export function getMemoryStats() {
  const mem = process.memoryUsage();
  return {
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    rssMB: Math.round(mem.rss / 1024 / 1024),
    externalMB: Math.round(mem.external / 1024 / 1024),
    warningThresholdMB: HEAP_WARNING_MB,
    criticalThresholdMB: HEAP_CRITICAL_MB,
    warningCount,
  };
}

export default { startMemoryGuard, stopMemoryGuard, getMemoryStats };
