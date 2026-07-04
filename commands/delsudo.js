import fs from "fs";
import path from "path";

export const name = "delsudo";

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

function saveSudo(file, list) {
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
}

function normalizeNumber(input) {
  if (!input) return null;
  return String(input).replace(/[^0-9]/g, "");
}

function removeSudo(file, number) {
  const sudo = loadSudo(file);
  const filtered = sudo.filter(n => n !== number);
  saveSudo(file, filtered);
  return sudo.length !== filtered.length;
}

export async function execute(sock, msg, args, from, botContext) {
  const chat = from || msg.key.remoteJid;
  const sudoFile = getSudoFile(botContext);

  let target;
  const replied = msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (replied) target = replied;
  if (!target && args.length > 0) target = args[0];

  const bare = normalizeNumber(target);
  if (!bare) {
    return await sock.sendMessage(chat, {
      text: "> SIGMA MDX DEPLOY: Reponds a un message ou tape :\n*.delsudo 237xxxxxxxx*"
    }, { quoted: msg });
  }

  const removed = removeSudo(sudoFile, bare);
  await sock.sendMessage(chat, {
    text: removed
      ? `> SIGMA MDX DEPLOY: Le numero *${bare}* a ete retire des sudo.`
      : `> SIGMA MDX DEPLOY: Le numero *${bare}* n'etait pas sudo.`
  }, { quoted: msg });
}