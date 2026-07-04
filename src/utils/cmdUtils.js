/**
 * Utilitaires partagés pour les commandes — sans effets de bord.
 * Remplace les imports depuis index.js (qui démarre un bot legacy).
 */
import fs from "fs-extra";
import path from "path";

/**
 * Charge la liste sudo depuis le fichier de session du bot.
 * @param {string|null} sessionPath 
 * @returns {string[]}
 */
export const loadSudoFromSession = (sessionPath) => {
  try {
    const file = sessionPath ? path.join(sessionPath, "sudo.json") : "./sudo.json";
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    return data.sudoUsers || [];
  } catch {
    return [];
  }
};

/**
 * Extrait la liste sudo depuis le botContext (préféré) ou depuis le fichier.
 * @param {object|null} botContext 
 * @returns {string[]}
 */
export const getSudoList = (botContext) => {
  if (botContext?.sudoList) return botContext.sudoList;
  return loadSudoFromSession(botContext?.sessionPath);
};

/**
 * Extrait la liste des owners depuis le botContext.
 * @param {object|null} botContext 
 * @returns {string[]}
 */
export const getOwners = (botContext) => {
  return botContext?.owners || global.owners || [];
};
