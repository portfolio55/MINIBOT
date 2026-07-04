// groupManager.js
// Stockage PostgreSQL + cache mémoire — remplace les fichiers group.json
import path from "path";
import { dbGetAllGroupProtections, dbSetGroupProtections } from "./src/db.js";

const DEFAULT_PROTECTIONS = {
  antiLink: false,
  antiPromote1: false,
  antiDemote: false,
  antiBot: false,
  antiSpam: false,
  autoReact: false,
  statusLike: false,
  warnAdmin: false,
  antiSticker: false,
  antiVoice: false,
  antiVideo: false,
  sigmaVoice: false,
  autoSigmaChatTTS: true,
  antiMessage: false,
  alertAdmin: false,
  respons: true,
  sigmaChat: true,
  welcome: false,
  goodbye: false,
  autoVV2: false,
  autoSigmaChat: false
};

// Extrait l'UUID du sessionPath (./sessions/bot_<UUID>)
const uuidFromSessionPath = (sessionPath) => {
  if (!sessionPath) return null;
  const base = path.basename(sessionPath);
  return base.startsWith("bot_") ? base.slice(4) : null;
};

/**
 * Crée un gestionnaire de groupes isolé pour une session bot donnée.
 * Cache mémoire synchrone + persistence PostgreSQL asynchrone.
 */
export const createGroupManager = (sessionPath) => {
  const uuid = uuidFromSessionPath(sessionPath);
  const cache = {}; // groupJid → { protection: bool, ... }

  // Chargement initial depuis la DB (asynchrone)
  if (uuid) {
    dbGetAllGroupProtections(uuid)
      .then((rows) => {
        for (const row of rows) {
          cache[row.groupJid] = row.protections;
        }
      })
      .catch((err) => {
        console.error(`[GroupManager] Erreur chargement DB (${uuid}): ${err.message}`);
      });
  }

  const persistToDB = (groupJid) => {
    if (!uuid) return;
    dbSetGroupProtections(uuid, groupJid, cache[groupJid]).catch((err) => {
      console.error(`[GroupManager] Erreur écriture DB (${uuid}/${groupJid}): ${err.message}`);
    });
  };

  const getGroupProtections = (groupJid) => {
    return cache[groupJid] || {};
  };

  const setGroupProtection = (groupJid, protection, value) => {
    if (!cache[groupJid]) cache[groupJid] = {};
    cache[groupJid][protection] = value;
    persistToDB(groupJid);
  };

  const toggleGroupProtection = (groupJid, protection) => {
    const current = getGroupProtections(groupJid)[protection] ?? false;
    setGroupProtection(groupJid, protection, !current);
    return !current;
  };

  const registerGroupOnOwnerMessage = (groupJid) => {
    if (cache[groupJid]) return;
    cache[groupJid] = { ...DEFAULT_PROTECTIONS };
    persistToDB(groupJid);
    console.log(`[GROUP MANAGER] Nouveau groupe : ${groupJid.split("@")[0]}`);
  };

  return {
    getGroupProtections,
    setGroupProtection,
    toggleGroupProtection,
    registerGroupOnOwnerMessage
  };
};

// API globale (legacy — utilisée sans sessionPath, sans isolation)
let _globalCache = {};
let _globalUuid = null;

const _persistGlobal = (groupJid) => {
  if (!_globalUuid) return;
  dbSetGroupProtections(_globalUuid, groupJid, _globalCache[groupJid]).catch((err) => {
    console.error(`[GroupManager] Erreur écriture globale: ${err.message}`);
  });
};

export const getGroupProtections = (groupJid) => _globalCache[groupJid] || {};

export const setGroupProtection = (groupJid, protection, value) => {
  if (!_globalCache[groupJid]) _globalCache[groupJid] = {};
  _globalCache[groupJid][protection] = value;
  _persistGlobal(groupJid);
};

export const toggleGroupProtection = (groupJid, protection) => {
  const current = getGroupProtections(groupJid)[protection] ?? false;
  setGroupProtection(groupJid, protection, !current);
  return !current;
};

export const registerGroupOnOwnerMessage = (groupJid) => {
  if (_globalCache[groupJid]) return;
  _globalCache[groupJid] = { ...DEFAULT_PROTECTIONS };
  _persistGlobal(groupJid);
  console.log(`[GROUP MANAGER] Nouveau groupe : ${groupJid.split("@")[0]}`);
};

export default {
  getGroupProtections,
  setGroupProtection,
  toggleGroupProtection,
  registerGroupOnOwnerMessage,
  createGroupManager
};
