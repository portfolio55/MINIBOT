import fs from "fs-extra";
import path from "path";

export const name = "prefix";
export const aliases = ["modeprefix"];

export async function execute(sock, msg, args, from, botContext) {
  const sessionPath = botContext?.sessionPath;
  const modePrefixFile = sessionPath ? path.join(sessionPath, "modeprefix.json") : "./modeprefix.json";

  const loadMode = () => {
    try {
      if (!fs.existsSync(modePrefixFile)) return true;
      const d = JSON.parse(fs.readFileSync(modePrefixFile, "utf-8"));
      return d.modeprefix !== false;
    } catch { return true; }
  };

  const saveMode = (val) => {
    fs.writeFileSync(modePrefixFile, JSON.stringify({ modeprefix: val }, null, 2));
  };

  const currentMode = loadMode();

  if (args.length === 0) {
    await sock.sendMessage(from, {
      text: `> ⚙️ *MODE PRÉFIXE*\n\nÉtat actuel : *${currentMode ? "AVEC préfixe (.) activé" : "SANS préfixe désactivé"}*\n\nUsage :\n• \`.prefix on\` — activer le préfixe\n• \`.prefix off\` — désactiver le préfixe`
    }, { quoted: msg });
    return;
  }

  const arg = args[0].toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await sock.sendMessage(from, {
      text: `> ❌ Argument invalide. Utilise \`.prefix on\` ou \`.prefix off\``
    }, { quoted: msg });
    return;
  }

  const newState = arg === "on";
  if (newState === currentMode) {
    await sock.sendMessage(from, {
      text: `> ℹ️ Le mode préfixe est déjà *${newState ? "activé" : "désactivé"}*.`
    }, { quoted: msg });
    return;
  }

  saveMode(newState);
  await sock.sendMessage(from, {
    text: `> ✅ Mode préfixe *${newState ? "activé" : "désactivé"}* avec succès !`
  }, { quoted: msg });
}
