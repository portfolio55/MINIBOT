/**
 * Migration one-shot: JSON → PostgreSQL
 * Lit les fichiers JSON existants et les insère en DB (idempotent).
 * Doit être appelé une seule fois au démarrage.
 */
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./db.js";
import logger from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, "..");
const STORAGE_DIR = path.join(ROOT, "storage");
const SESSIONS_DIR = path.join(ROOT, "sessions");

async function migrateBots() {
  const botsFile = path.join(STORAGE_DIR, "bots.json");
  const tokensFile = path.join(STORAGE_DIR, "tokens.json");
  if (!(await fs.pathExists(botsFile))) return;

  let bots;
  try {
    bots = await fs.readJSON(botsFile);
  } catch {
    return;
  }

  const entries = Object.entries(bots);
  if (entries.length === 0) return; // Déjà vide, rien à faire

  let migrated = 0;
  for (const [uuid, bot] of entries) {
    // Ne pas réinsérer les bots qui étaient logged_out
    if (bot.status === "logged_out") continue;
    try {
      await query(
        `INSERT INTO bots (uuid, phone_number, token, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4,
           COALESCE($5::timestamptz, NOW()),
           COALESCE($6::timestamptz, NOW())
         )
         ON CONFLICT (uuid) DO NOTHING`,
        [
          uuid,
          bot.phoneNumber || "",
          bot.token || "",
          bot.status || "pairing",
          bot.createdAt || null,
          bot.lastConnected || bot.createdAt || null
        ]
      );
      migrated++;
    } catch (err) {
      logger.warn(`[Migrate] Erreur insertion bot ${uuid}: ${err.message}`);
    }
  }

  if (migrated > 0) logger.info(`[Migrate] ${migrated} bot(s) migrés vers DB`);

  // Archiver les JSON après migration — la DB est désormais la source de vérité
  try {
    await fs.writeJSON(botsFile, {}, { spaces: 2 });
    await fs.writeJSON(tokensFile, {}, { spaces: 2 });
    logger.info(`[Migrate] JSON archivés (bots.json/tokens.json vidés) — DB = source de vérité`);
  } catch (err) {
    logger.warn(`[Migrate] Impossible de vider les JSON: ${err.message}`);
  }
}

async function migrateBotConfig(uuid, sessionPath) {
  const configFile    = path.join(sessionPath, "config.json");
  const prefixFile    = path.join(sessionPath, "prefix.json");
  const modeprefixFile = path.join(sessionPath, "modeprefix.json");
  const jidFile       = path.join(sessionPath, "jid.json");
  const responsFile   = path.join(sessionPath, "respons.json");
  const brandingFile  = path.join(sessionPath, "branding.json");
  const sudoFile      = path.join(sessionPath, "sudo.json");

  let owners    = [];
  let sudoUsers = [];
  let prefix    = ".";
  let prefixMode = true;
  let ownerLid  = null;
  let audioUrl  = null;
  let branding  = {};

  try {
    if (await fs.pathExists(configFile)) {
      const cfg = await fs.readJSON(configFile);
      owners = cfg.owners || [];
    }
  } catch {}

  try {
    if (await fs.pathExists(sudoFile)) {
      sudoUsers = await fs.readJSON(sudoFile);
      if (!Array.isArray(sudoUsers)) sudoUsers = [];
    }
  } catch {}

  try {
    if (await fs.pathExists(prefixFile)) {
      const p = await fs.readJSON(prefixFile);
      prefix = p.prefix || ".";
    }
  } catch {}

  try {
    if (await fs.pathExists(modeprefixFile)) {
      const mp = await fs.readJSON(modeprefixFile);
      prefixMode = mp.modeprefix ?? true;
    }
  } catch {}

  try {
    if (await fs.pathExists(jidFile)) {
      const j = await fs.readJSON(jidFile);
      ownerLid = j.ownerLid || null;
    }
  } catch {}

  try {
    if (await fs.pathExists(responsFile)) {
      const r = await fs.readJSON(responsFile);
      audioUrl = r.audioUrl || null;
    }
  } catch {}

  try {
    if (await fs.pathExists(brandingFile)) {
      branding = await fs.readJSON(brandingFile) || {};
    }
  } catch {}

  try {
    await query(
      `INSERT INTO bot_config
         (uuid, owners, sudo_users, prefix, prefix_mode, owner_lid, audio_url, branding)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (uuid) DO NOTHING`,
      [
        uuid,
        JSON.stringify(owners),
        JSON.stringify(sudoUsers),
        prefix,
        prefixMode,
        ownerLid,
        audioUrl,
        JSON.stringify(branding)
      ]
    );
  } catch (err) {
    logger.warn(`[Migrate] Erreur insertion bot_config ${uuid}: ${err.message}`);
  }
}

async function migrateGroupProtections(uuid, sessionPath) {
  const groupFile = path.join(sessionPath, "group.json");
  if (!(await fs.pathExists(groupFile))) return;

  let data;
  try {
    data = await fs.readJSON(groupFile);
  } catch {
    return;
  }

  const groups = data?.groups || data || {};
  let migrated = 0;

  for (const [groupJid, protections] of Object.entries(groups)) {
    if (typeof protections !== "object" || !protections) continue;
    try {
      await query(
        `INSERT INTO group_protections (uuid, group_jid, protections)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (uuid, group_jid) DO NOTHING`,
        [uuid, groupJid, JSON.stringify(protections)]
      );
      migrated++;
    } catch (err) {
      logger.warn(`[Migrate] Erreur insertion groupe ${groupJid}: ${err.message}`);
    }
  }
  if (migrated > 0) logger.info(`[Migrate] ${migrated} groupe(s) migrés pour bot ${uuid.slice(0, 8)}`);
}

async function migrateAllBotData() {
  if (!(await fs.pathExists(SESSIONS_DIR))) return;

  const entries = await fs.readdir(SESSIONS_DIR);
  for (const entry of entries) {
    if (!entry.startsWith("bot_")) continue;
    const uuid = entry.slice(4);
    if (!uuid || uuid.length < 30) continue;
    const sessionPath = path.join(SESSIONS_DIR, entry);

    // Vérifier que le bot existe en DB avant d'insérer la config
    const res = await query(`SELECT 1 FROM bots WHERE uuid = $1`, [uuid]);
    if (!res.rows.length) continue;

    await migrateBotConfig(uuid, sessionPath);
    await migrateGroupProtections(uuid, sessionPath);
  }
}

async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS bots (
      uuid VARCHAR(36) PRIMARY KEY,
      phone_number VARCHAR(30) NOT NULL,
      token VARCHAR(100) NOT NULL,
      status VARCHAR(30) DEFAULT 'pairing',
      username VARCHAR(50) UNIQUE,
      password_hash TEXT,
      subscription_plan VARCHAR(20) DEFAULT 'trial',
      subscription_expires_at TIMESTAMPTZ,
      trial_used BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // [ABONNEMENTS] Colonnes ajoutées après coup — migration idempotente pour bases existantes
  await query(`ALTER TABLE bots ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE`);
  await query(`ALTER TABLE bots ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await query(`ALTER TABLE bots ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT 'trial'`);
  await query(`ALTER TABLE bots ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ`);
  await query(`ALTER TABLE bots ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false`);
  // [ANTI-ABUS ESSAI 24H] Historique des numéros ayant déjà consommé l'essai gratuit.
  // Persiste même si le bot est supprimé, pour empêcher un même numéro de regénérer
  // un essai gratuit en supprimant puis re-appairant son bot (nouveau uuid à chaque fois).
  await query(`
    CREATE TABLE IF NOT EXISTS trial_phone_history (
      phone_number VARCHAR(30) PRIMARY KEY,
      used_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL REFERENCES bots(uuid) ON DELETE CASCADE,
      plan VARCHAR(20) NOT NULL,
      amount INTEGER NOT NULL,
      mf_token VARCHAR(100) UNIQUE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      confirmed_at TIMESTAMPTZ
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS bot_config (
      uuid VARCHAR(36) PRIMARY KEY REFERENCES bots(uuid) ON DELETE CASCADE,
      owners JSONB DEFAULT '[]',
      sudo_users JSONB DEFAULT '[]',
      prefix VARCHAR(10) DEFAULT '.',
      prefix_mode BOOLEAN DEFAULT true,
      owner_lid VARCHAR(100),
      audio_url TEXT,
      branding JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS group_protections (
      uuid VARCHAR(36) NOT NULL REFERENCES bots(uuid) ON DELETE CASCADE,
      group_jid VARCHAR(100) NOT NULL,
      protections JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (uuid, group_jid)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS baileys_auth (
      uuid VARCHAR(36) NOT NULL,
      key VARCHAR(255) NOT NULL,
      value JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (uuid, key)
    )
  `);
}

async function ensureIndexes() {
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_bots_uuid ON bots(uuid)`,
    `CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status)`,
    `CREATE INDEX IF NOT EXISTS idx_baileys_auth_uuid ON baileys_auth(uuid)`,
    `CREATE INDEX IF NOT EXISTS idx_baileys_auth_id ON baileys_auth(uuid, key)`,
    `CREATE INDEX IF NOT EXISTS idx_group_protections_jid ON group_protections(group_jid, uuid)`,
    `CREATE INDEX IF NOT EXISTS idx_bot_config_uuid ON bot_config(uuid)`,
    `CREATE INDEX IF NOT EXISTS idx_bots_username ON bots(username)`,
    `CREATE INDEX IF NOT EXISTS idx_bots_subscription_expires ON bots(subscription_expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_uuid ON payments(uuid)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_mf_token ON payments(mf_token)`
  ];
  for (const sql of indexes) {
    try {
      await query(sql);
    } catch (err) {
      logger.debug(`[Migrate] Index skip: ${err.message}`);
    }
  }
}

export async function runMigration() {
  try {
    logger.info("[Migrate] Début migration JSON → PostgreSQL...");
    await ensureTables();
    await ensureIndexes();
    await migrateBots();
    await migrateAllBotData();
    logger.info("[Migrate] Migration terminée ✓");
  } catch (err) {
    logger.error(`[Migrate] Erreur globale: ${err.message}`);
  }
}
