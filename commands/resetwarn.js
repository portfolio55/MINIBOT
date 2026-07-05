import { createGroupManager } from "../groupManager.js";
import { getSudoList, getOwners } from "../src/utils/cmdUtils.js";

export const name = "resetwarn";

export async function execute(sock, msg, args, from, botContext) {
  try {
    const gm = botContext?.groupManager || createGroupManager(botContext?.sessionPath);

    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, { text: "Cette commande est réservée aux groupes." });
      return;
    }

    const sender = msg.key.participant || from;
    const senderNum = sender.split("@")[0].replace(/[^0-9]/g, "");
    const owners = getOwners(botContext).map(n => n.replace(/[^0-9]/g, ""));
    const sudoList = getSudoList(botContext).map(n => n.replace(/[^0-9]/g, ""));
    const isOwner = owners.includes(senderNum);
    const isSudo = sudoList.includes(senderNum);
    const isAdmin = await isGroupAdmin(sock, from, sender);

    if (!isOwner && !isSudo && !isAdmin) {
      await sock.sendMessage(from, { text: "Accès refusé. Admin, owner ou sudo requis." });
      return;
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const repliedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const target = (mentioned && mentioned.length > 0) ? mentioned[0] : repliedParticipant;

    if (!target) {
      await sock.sendMessage(from, { text: "❌ Mentionne ou réponds au message de la personne concernée." });
      return;
    }

    gm.resetWarn(from, target);
    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
  } catch (err) {
    console.error("Erreur resetwarn:", err);
    await sock.sendMessage(from, { text: "Une erreur est survenue." });
  }
}

async function isGroupAdmin(sock, groupJid, userJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    return metadata.participants.some(p => p.id === userJid && p.admin);
  } catch {
    return false;
  }
}
