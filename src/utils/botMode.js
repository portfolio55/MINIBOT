/**
 * Mode du bot par session (girl/boy) pour SIGMA MDX DEPLOY
 * Chaque instance a son propre mode stocké dans sa session
 */
import fs from "fs-extra";

const MODE_FILE_NAME = "mode.json";

/**
 * Récupère le mode du bot pour une session
 * @param {string} sessionPath - Chemin du dossier de session du bot
 * @returns {Promise<'girl'|'boy'>}
 */
export async function getBotMode(sessionPath) {
  try {
    const modePath = `${sessionPath}/${MODE_FILE_NAME}`;
    if (await fs.pathExists(modePath)) {
      const data = await fs.readJSON(modePath);
      const mode = (data.mode || "boy").toLowerCase();
      return mode === "girl" ? "girl" : "boy";
    }
  } catch (e) {
    // ignore
  }
  return "boy";
}

/**
 * Définit le mode du bot pour une session
 * @param {string} sessionPath - Chemin du dossier de session du bot
 * @param {'girl'|'boy'} mode
 */
export async function setBotMode(sessionPath, mode) {
  const modePath = `${sessionPath}/${MODE_FILE_NAME}`;
  await fs.writeJSON(modePath, { mode: mode.toLowerCase() }, { spaces: 2 });
}

/**
 * Emoji de réaction selon le mode : 🦋 girl, 🐸 boy
 * @param {'girl'|'boy'} mode
 * @returns {string}
 */
export function getReactionEmoji(mode) {
  return mode === "girl" ? "🦋" : "🐸";
}
