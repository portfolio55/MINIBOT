import fs from "fs";
import path from "path";

export const name = "setprefix";
export const ownerOnly = true;

const getPrefixFile = (botContext) => {
  const sessionPath = botContext?.sessionPath;
  return sessionPath ? path.join(sessionPath, "prefix.json") : "./prefix.json";
};

function loadPrefix(file) {
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    return data?.prefix ?? null;
  } catch {
    return null;
  }
}

function savePrefix(file, prefix) {
  fs.writeFileSync(file, JSON.stringify({ prefix }, null, 2));
}

export async function execute(sock, msg, args, from, botContext) {
  const chat = from || msg.key.remoteJid;
  const prefixFile = getPrefixFile(botContext);

  if (!args?.length) {
    const current = loadPrefix(prefixFile);
    return await sock.sendMessage(chat, {
      text: current
        ? `> Préfixe actuel: *${current}*\n\n> Pour changer: *.setprefix .*`
        : `> Aucun préfixe défini.\n\n> Pour changer: *.setprefix .*`
    }, { quoted: msg });
  }

  const newPrefix = String(args[0]);

  if (!newPrefix || newPrefix.length > 5) {
    return await sock.sendMessage(chat, {
      text: "> Préfixe invalide. Exemple: *.setprefix .* (max 5 caractères)"
    }, { quoted: msg });
  }

  savePrefix(prefixFile, newPrefix);

  await sock.sendMessage(chat, {
    text: `> ✅ Préfixe mis à jour: *${newPrefix}*\n> Exemple: ${newPrefix}menu`
  }, { quoted: msg });
}
