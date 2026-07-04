// =================== COMMANDE AUTO-SIGMA-CHAT ===================
// Fichier : commandes/autosigmachat.js

import fs from "fs";
import path from "path";
import { getGroupProtections, setGroupProtection, createGroupManager } from "../groupManager.js";
import { getSudoList, getOwners } from "../src/utils/cmdUtils.js";


export const name = "sigmachat";
export const aliases = ["akc", "autosigma", "autoai"];

export async function execute(sock, msg, args, from, botContext) {
  try {
    const { getGroupProtections: _getGP, setGroupProtection: _setGP } = createGroupManager(botContext?.sessionPath);
    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, { text: "? Cette commande est réservée aux groupes." }, { quoted: msg });
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
      await sock.sendMessage(from, { text: "? Accès refusé. Admin, owner ou sudo requis." }, { quoted: msg });
      return;
    }

    const arg = args[0]?.toLowerCase();
    if (!arg || !["on", "off", "état", "status"].includes(arg)) {
      const current = _getGP(from).autoSigmaChat ? "✅ Activé" : "⚡ Désactivé";
      await sock.sendMessage(from, { 
        text: `> SIGMA MDX DEPLOY: Auto-Sigma-Chat\n\n?? état : ${current}\n\nUtilisation : \`!sigmachat on\` ou \`!sigmachat off\`\n?? Alias: !akc, !autosigma, !autoai`
      }, { quoted: msg });
      return;
    }

    if (arg === "on" || arg === "off") {
      const newState = arg === "on";
      _setGP(from, "autoSigmaChat", newState);

      await sock.sendMessage(from, { 
        text: `> SIGMA MDX DEPLOY: Auto-Sigma-Chat ${newState ? "✅ activé" : "⚡ désactivé"} dans ce groupe.\n\n${newState ? "Le bot répondra automatiquement é tous les messages." : "Le bot ne répondra plus automatiquement."}`
      }, { quoted: msg });
    } else if (arg === "état" || arg === "status") {
      const currentStatus = _getGP(from).autoSigmaChat ? "✅ Activé" : "⚡ Désactivé";
      const configInfo = `é Cooldown : 5 secondes\né Longueur min : 3 caractères\né Ignore les commandes\né API : Gemini`;
      
      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY - Auto-Sigma-Chat\n\n?? état : ${currentStatus}\n\n?? Configuration :\n${configInfo}\n\n?? Usage : !sigmachat on/off`
      }, { quoted: msg });
    }

  } catch (err) {
    console.error("? Erreur sigmachat:", err);
    await sock.sendMessage(from, { text: "? Une erreur est survenue." }, { quoted: msg });
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