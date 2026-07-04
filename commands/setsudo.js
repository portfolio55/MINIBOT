import fs from "fs";
import path from "path";

export const name = "setsudo";

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

function addSudo(file, number) {
  const sudo = loadSudo(file);
  if (!sudo.includes(number)) sudo.push(number);
  saveSudo(file, sudo);
  return sudo;
}

export async function execute(sock, msg, args, from, botContext) {
  const chat = from || msg.key.remoteJid;
  const sudoFile = getSudoFile(botContext);

  let target;

  // Reply to a message
  const replied = msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (replied) target = replied;

  // Or number argument
  if (!target && args.length > 0) {
    target = args[0];
  }

  target = target ? String(target).replace(/[^0-9]/g, "") : null;

  if (!target) {
    return await sock.sendMessage(chat, {
      text: "> SIGMA MDX DEPLOY: Reponds a un message ou tape :\n*.setsudo 237xxxxxxxx*"
    }, { quoted: msg });
  }

  addSudo(sudoFile, target);

  await sock.sendMessage(chat, {
    text: `> SIGMA MDX DEPLOY: Le numero *${target}* a ete ajoute en sudo.`
  }, { quoted: msg });
}