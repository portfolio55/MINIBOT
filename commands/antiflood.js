import { createGroupManager } from "../groupManager.js";
import { getSudoList, getOwners } from "../src/utils/cmdUtils.js";

export const name = "antiflood";

export async function execute(sock, msg, args, from, botContext) {
  try {
    const { getGroupProtections: _getGP, setGroupProtection: _setGP } = botContext?.groupManager || createGroupManager(botContext?.sessionPath);

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

    const arg = args[0]?.toLowerCase();
    if (!arg || !["on", "off"].includes(arg)) {
      const current = _getGP(from).antiSpam ? "activé" : "désactivé";
      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY: Anti-Flood\n\nétat : ${current}\n\nExpulse automatiquement un membre qui envoie trop de messages en peu de temps.\nUtilisation : \`.antiflood on\` ou \`.antiflood off\``
      });
      return;
    }

    const newState = arg === "on";
    _setGP(from, "antiSpam", newState);

    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
  } catch (err) {
    console.error("Erreur antiflood:", err);
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
