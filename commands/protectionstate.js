import { createGroupManager } from "../groupManager.js";
import { getSudoList, getOwners } from "../src/utils/cmdUtils.js";

export const name = "protectionstate";
export const aliases = ["ps", "protections", "etatprotections"];

export async function execute(sock, msg, args, from, botContext) {
  try {
    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY : Cette commande est réservée aux groupes uniquement."
      }, { quoted: msg });
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
      await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY : Accès refusé.\nSeuls les admins, owners ou sudo peuvent voir l'état des protections."
      }, { quoted: msg });
      return;
    }

    const { getGroupProtections } = createGroupManager(botContext?.sessionPath);
    const protections = getGroupProtections(from);

    const protectionList = [
      { key: "antiMessage",  label: "Anti-Message",        on: "✅", off: "❌" },
      { key: "antiLink",     label: "Anti-Link",           on: "✅", off: "❌" },
      { key: "antiBot",      label: "Anti-Bot",            on: "✅", off: "❌" },
      { key: "antiSticker",  label: "Anti-Sticker",        on: "✅", off: "❌" },
      { key: "antiVoice",    label: "Anti-Vocal",          on: "✅", off: "❌" },
      { key: "antiVideo",    label: "Anti-Vidéo",          on: "✅", off: "❌" },
      { key: "antiSpam",     label: "Anti-Spam",           on: "✅", off: "❌" },
      { key: "autoReact",    label: "Auto-Réaction",       on: "✅", off: "❌" },
      { key: "autoVV2",      label: "Auto-VV (Vue Unique)",on: "✅", off: "❌" },
      { key: "antipromote1", label: "Anti-Promote",        on: "✅", off: "❌" },
      { key: "welcome",      label: "Welcome Message",     on: "✅", off: "❌" },
      { key: "goodbye",      label: "Goodbye Message",     on: "✅", off: "❌" },
      { key: "autoSigmaChat",label: "Auto-Chat IA",        on: "✅", off: "❌" },
      { key: "sigmaVoice",   label: "Sigma Voice IA",      on: "✅", off: "❌" },
      { key: "alertAdmin",   label: "Alert Admin",         on: "✅", off: "❌" },
      { key: "respons",      label: "Auto-Réponse",        on: "✅", off: "❌" },
    ];

    const groupMetadata = await sock.groupMetadata(from);
    const groupName = groupMetadata.subject || "Groupe inconnu";

    let statusText = `> *⚙️ ÉTAT DES PROTECTIONS*\n> 👥 Groupe : *${groupName}*\n\n`;
    protectionList.forEach(prot => {
      const state = protections[prot.key] ? prot.on : prot.off;
      statusText += `${state} *${prot.label}*\n`;
    });
    statusText += `\n> _Utilise les commandes comme_ \`.antilink on/off\` _pour modifier._`;

    await sock.sendMessage(from, { text: statusText }, { quoted: msg });

  } catch (err) {
    console.error("Erreur commande protectionstate:", err);
    await sock.sendMessage(from, {
      text: "> SIGMA MDX DEPLOY : Une erreur est survenue."
    }, { quoted: msg });
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
