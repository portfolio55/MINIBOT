import { query } from "./db.js";
import { proto, initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";
import logger from "./utils/logger.js";

function serialize(value) {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}

function deserialize(value) {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver);
}

export async function usePostgresAuthState(uuid) {
  const cache = new Map();
  const pendingWrites = new Map();
  let flushTimer = null;

  try {
    const res = await query(
      `SELECT key, value FROM baileys_auth WHERE uuid = $1`,
      [uuid]
    );
    for (const row of res.rows) {
      cache.set(row.key, row.value);
    }
    logger.info(`[AuthState] ${uuid.slice(0, 8)}: ${cache.size} clés chargées en mémoire`);
  } catch (err) {
    logger.error(`[AuthState] Erreur chargement cache ${uuid}: ${err.message}`);
  }

  const flushToDb = async () => {
    if (pendingWrites.size === 0) return;

    const batch = new Map(pendingWrites);
    pendingWrites.clear();

    const upserts = [];
    const deletes = [];

    for (const [key, value] of batch) {
      if (value === null) {
        deletes.push(key);
      } else {
        upserts.push({ key, value });
      }
    }

    try {
      const tasks = [];

      if (deletes.length > 0) {
        tasks.push(
          query(
            `DELETE FROM baileys_auth WHERE uuid = $1 AND key = ANY($2)`,
            [uuid, deletes]
          )
        );
      }

      // [PERF FIX] Les écritures étaient envoyées une par une avec `await` séquentiel
      // dans une boucle : chaque clé attendait le round-trip réseau de la précédente
      // avant de démarrer, ce qui multipliait la latence par le nombre de clés
      // modifiées (accumulation ressentie comme "bot lent"). On les envoie maintenant
      // en parallèle (le pool supporte jusqu'à 50 connexions), avec Promise.allSettled
      // pour continuer même si une écriture échoue individuellement.
      for (const { key, value } of upserts) {
        tasks.push(
          query(
            `INSERT INTO baileys_auth (uuid, key, value, updated_at)
             VALUES ($1, $2, $3::jsonb, NOW())
             ON CONFLICT (uuid, key) DO UPDATE SET value = $3::jsonb, updated_at = NOW()`,
            [uuid, key, JSON.stringify(value)]
          ).catch((err) => {
            logger.error(`[AuthState] Flush write error ${key}: ${err.message}`);
          })
        );
      }

      await Promise.allSettled(tasks);
    } catch (err) {
      logger.error(`[AuthState] Flush batch error: ${err.message}`);
    }
  };

  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      await flushToDb();
    }, 500);
  };

  const readData = (key) => {
    if (!cache.has(key)) return null;
    try {
      return deserialize(cache.get(key));
    } catch {
      return null;
    }
  };

  const writeData = (key, value) => {
    const serialized = serialize(value);
    cache.set(key, serialized);
    pendingWrites.set(key, serialized);
    scheduleFlush();
  };

  const removeData = (key) => {
    cache.delete(key);
    pendingWrites.set(key, null);
    scheduleFlush();
  };

  const creds = readData("creds") || initAuthCreds();

  const state = {
    creds,
    keys: {
      get: (type, ids) => {
        const result = {};
        for (const id of ids) {
          const key = `${type}-${id}`;
          let value = readData(key);
          if (type === "app-state-sync-key" && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          result[id] = value;
        }
        return result;
      },
      set: (data) => {
        for (const category of Object.keys(data)) {
          for (const id of Object.keys(data[category])) {
            const key = `${category}-${id}`;
            const value = data[category][id];
            if (value) {
              writeData(key, value);
            } else {
              removeData(key);
            }
          }
        }
      }
    }
  };

  const saveCreds = async () => {
    writeData("creds", state.creds);
    await flushToDb();
  };

  return { state, saveCreds };
}

export async function deleteAuthState(uuid) {
  try {
    await query(`DELETE FROM baileys_auth WHERE uuid = $1`, [uuid]);
    logger.info(`[AuthState] Auth state supprimé pour ${uuid}`);
  } catch (err) {
    logger.error(`[AuthState] Delete error: ${err.message}`);
  }
}

export async function hasAuthState(uuid) {
  try {
    const res = await query(
      `SELECT 1 FROM baileys_auth WHERE uuid = $1 AND key = 'creds' LIMIT 1`,
      [uuid]
    );
    return res.rows.length > 0;
  } catch {
    return false;
  }
}
