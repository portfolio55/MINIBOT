import { createGroupManager } from "../groupManager.js";
import { getSudoList, getOwners } from "../src/utils/cmdUtils.js";

export const name = "antiword";

export async function execute(sock, msg, args, from, botContext) {
  try {
    const gm = botContext?.groupManager || createGroupManager(botContext?.sessionPath);
    const { getGroupProtections: _getGP, setGroupProtection: _setGP } = gm;

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
      const current = _getGP(from).antiWord ? "activé" : "désactivé";
      const words = gm.getBannedWords(from);
      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY: Anti-Word\n\nétat : ${current}\nMots interdits : ${words.length}\n\nUtilisation :\n\`.antiword on\` / \`.antiword off\`\n\`.addword <mot>\` — ajouter un mot interdit\n\`.delword <mot>\` — retirer un mot\n\`.listwords\` — voir la liste`
      });
      return;
    }

    const newState = arg === "on";
    _setGP(from, "antiWord", newState);

    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
  } catch (err) {
    console.error("Erreur antiword:", err);
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
