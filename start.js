/**
 * Point d'entrée principal - SIGMA MDX DEPLOY
 * Démarre le serveur web multi-utilisateurs
 * 
 * [AMÉLIORÉ] Gestion robuste des erreurs fatales, graceful shutdown,
 * validation de l'environnement au démarrage, et sécurisation de l'exec.
 */
import { EventEmitter } from "events";
import { execSync } from "child_process";
import dotenv from "dotenv";

// Charger les variables d'environnement en premier
dotenv.config();

// [300 BOTS] Augmenter la limite de listeners pour 300 bots simultanés
EventEmitter.defaultMaxListeners = 500;

// ─── Compteur d'erreurs fatales ──────────────────────────────────────────────
let fatalErrorCount = 0;
const MAX_FATAL_ERRORS = 10;
const FATAL_WINDOW_MS = 60000; // 1 minute
let fatalWindowStart = Date.now();

process.on("uncaughtException", (err) => {
  console.error(`[FATAL] uncaughtException: ${err.message}`);
  console.error(err.stack);
  
  // [AMÉLIORÉ] Compter les erreurs fatales et arrêter si trop fréquentes
  const now = Date.now();
  if (now - fatalWindowStart > FATAL_WINDOW_MS) {
    fatalErrorCount = 0;
    fatalWindowStart = now;
  }
  fatalErrorCount++;
  
  if (fatalErrorCount >= MAX_FATAL_ERRORS) {
    console.error(`[FATAL] ${MAX_FATAL_ERRORS} erreurs non gérées en ${FATAL_WINDOW_MS / 1000}s. Arrêt du processus.`);
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason) => {
  console.error(`[FATAL] unhandledRejection: ${reason}`);
  if (reason instanceof Error) console.error(reason.stack);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n[SHUTDOWN] Signal ${signal} reçu. Arrêt gracieux en cours...`);
  
  try {
    // Donner 10 secondes pour fermer proprement
    const shutdownTimeout = setTimeout(() => {
      console.error("[SHUTDOWN] Timeout atteint, arrêt forcé.");
      process.exit(1);
    }, 10000);
    shutdownTimeout.unref();
    
    // Importer le botManager pour arrêter les bots proprement
    try {
      const { default: botManager } = await import("./src/botManager.js");
      if (botManager && typeof botManager.stopAll === "function") {
        console.log("[SHUTDOWN] Arrêt des bots en cours...");
        await botManager.stopAll();
      }
    } catch (e) {
      console.error(`[SHUTDOWN] Erreur arrêt bots: ${e.message}`);
    }
    
    console.log("[SHUTDOWN] Arrêt terminé.");
    process.exit(0);
  } catch (err) {
    console.error(`[SHUTDOWN] Erreur: ${err.message}`);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ─── Libérer le port (sécurisé) ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// [AMÉLIORÉ] Valider que PORT est un entier avant de l'utiliser dans exec
const portNum = parseInt(PORT, 10);
if (!Number.isFinite(portNum) || portNum < 1 || portNum > 65535) {
  console.error(`[FATAL] PORT invalide: ${PORT}. Doit être un entier entre 1 et 65535.`);
  process.exit(1);
}

try {
  // Utilisation sécurisée : le port est validé comme entier
  execSync(`fuser -k ${portNum}/tcp 2>/dev/null || true`, { stdio: "ignore" });
} catch {
  // Ignorer si fuser n'est pas disponible
}

// ─── Vérification de l'environnement ─────────────────────────────────────────
function checkEnvironment() {
  const warnings = [];
  
  if (!process.env.DATABASE_URL) {
    console.error("[FATAL] DATABASE_URL non définie. Impossible de démarrer sans base de données.");
    process.exit(1);
  }
  
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === "admin123") {
    warnings.push("⚠️  ADMIN_PASSWORD non changé ! Utilisez un mot de passe fort en production.");
  }
  
  if (!process.env.PUBLIC_URL) {
    warnings.push("⚠️  PUBLIC_URL non définie. Les liens de pairing pourraient ne pas fonctionner.");
  }
  
  if (warnings.length > 0) {
    console.log("\n╔══════════════════════════════════════════════════════╗");
    console.log("║          ⚠️  AVERTISSEMENTS DE CONFIGURATION         ║");
    console.log("╠══════════════════════════════════════════════════════╣");
    warnings.forEach(w => console.log(`║ ${w.padEnd(52)}║`));
    console.log("╚══════════════════════════════════════════════════════╝\n");
  }
}

checkEnvironment();

// ─── Démarrage ───────────────────────────────────────────────────────────────
console.log(`[START] SIGMA MDX DEPLOY - Démarrage sur le port ${portNum}...`);
console.log(`[START] Node.js ${process.version} | PID: ${process.pid} | Platform: ${process.platform}`);

await import("./src/db.js");

const { runMigration } = await import("./src/migrate.js");
await runMigration();

// [300 BOTS] Créer les index pour performances à grande échelle
const { ensureIndexes } = await import("./src/db.js");
await ensureIndexes();

await import("./src/server.js");

console.log(`[START] ✅ Serveur démarré avec succès.`);
