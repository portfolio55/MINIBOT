import fs from "fs";
import path from "path";

export const name = "listsudo";

const getSudoFile = (botContext) => {
  const sessionPath = botContext?.sessionPath;
  return sessionPath ? path.join(sessionPath, "sudo.json") : "./sudo.json";
};

function loadSudo(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return [];
  }
}

export async function execute(sock, msg, args, from, botContext) {
  const chat = from || msg.key.remoteJid;
  const sudoFile = getSudoFile(botContext);

  const sudo = loadSudo(sudoFile);
  const list = sudo.length > 0
    ? sudo.map((n, i) => `${i + 1}. ${n}`).join("\n")
    : "Aucun sudo defini.";

  await sock.sendMessage(chat, {
    text: `> +---- LISTSUDO ---+\n> SIGMA MDX DEPLOY: Liste des sudo users :\n\n${list}\n> +---------------+`
  }, { quoted: msg });
}