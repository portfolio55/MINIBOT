import { createGroupManager } from "../groupManager.js";
import { getSudoList, getOwners } from "../src/utils/cmdUtils.js";

export const name = "antipromote";

export async function execute(sock, msg, args, from, botContext) {
  if (!from.endsWith("@g.us")) return sock.sendMessage(from, { text: "Groupe uniquement." }, { quoted: msg });

  const { getGroupProtections, setGroupProtection } = botContext?.groupManager || createGroupManager(botContext?.sessionPath);

  const sender = msg.key.participant || from;
  const senderNum = getBareNumber(sender);

  const owners = getOwners(botContext).map(n => n.replace(/[^0-9]/g, ""));
  const sudo = getSudoList(botContext).map(n => n.replace(/[^0-9]/g, ""));
  const isAdmin = await isGroupAdmin(sock, from, sender);

  if (!owners.includes(senderNum) && !sudo.includes(senderNum) && !isAdmin) 
    return sock.sendMessage(from, { text: "Admin / owner / sudo requis." }, { quoted: msg });

  const arg = args[0]?.toLowerCase();
  const current = getGroupProtections(from).antipromote1;

  if (!arg || !["on", "off"].includes(arg)) {
    return sock.sendMessage(from, { 
      text: `Anti-Promote : ${current ? "ON" : "OFF"}\n\n!antipromote on | off` 
    }, { quoted: msg });
  }

  const newState = arg === "on";
  setGroupProtection(from, "antipromote1", newState);

  sock.sendMessage(from, { 
    text: `Anti-Promote ${newState ? "activé 🔒" : "désactivé 🔓"}` 
  }, { quoted: msg });
}

async function isGroupAdmin(sock, groupJid, userJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    return meta.participants.some(p => p.id === userJid && p.admin);
  } catch { return false; }
}

function getBareNumber(jid) {
  return String(jid).split("@")[0].replace(/[^0-9]/g, "");
}