/**
 * Route de Health Check améliorée - SIGMA MDX DEPLOY
 * 
 * Fournit un endpoint /health complet pour le monitoring,
 * les load balancers, et les plateformes de déploiement.
 */
import { Router } from "express";
import { checkDbHealth, getPoolStats } from "../db.js";
import logger from "../utils/logger.js";

const router = Router();

/**
 * GET /health
 * Retourne l'état de santé du serveur et de ses dépendances
 */
router.get("/health", async (req, res) => {
  const startTime = Date.now();

  try {
    // Vérifier la base de données
    const dbHealth = await checkDbHealth();

    // Collecter les métriques
    const mem = process.memoryUsage();
    const uptime = process.uptime();

    const health = {
      status: dbHealth.ok ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.floor(uptime),
        human: formatUptime(uptime),
      },
      database: {
        connected: dbHealth.ok,
        latencyMs: dbHealth.latencyMs || null,
        error: dbHealth.error || null,
        pool: getPoolStats(),
      },
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
      },
      logging: logger.getMetrics(),
      responseTimeMs: Date.now() - startTime,
      version: process.env.npm_package_version || "1.0.0",
      node: process.version,
    };

    const statusCode = dbHealth.ok ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (err) {
    res.status(503).json({
      status: "unhealthy",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /health/live
 * Liveness probe minimaliste (pour Kubernetes/Docker)
 */
router.get("/health/live", (req, res) => {
  res.status(200).json({ status: "alive" });
});

/**
 * GET /health/ready
 * Readiness probe (vérifie que le serveur peut accepter du trafic)
 */
router.get("/health/ready", async (req, res) => {
  try {
    const db = await checkDbHealth();
    if (db.ok) {
      res.status(200).json({ status: "ready" });
    } else {
      res.status(503).json({ status: "not_ready", reason: "database_unavailable" });
    }
  } catch {
    res.status(503).json({ status: "not_ready" });
  }
});

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

export default router;
