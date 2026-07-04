import fs from "fs";
import path from "path";
import { getGroupProtections, setGroupProtection, createGroupManager } from "../groupManager.js";
import { getSudoList, getOwners } from "../src/utils/cmdUtils.js";


export const name = "antibot";

export async function execute(sock, msg, args, from, botContext) {
  try {
    const { getGroupProtections: _getGP, setGroupProtection: _setGP } = botContext?.groupManager || createGroupManager(botContext?.sessionPath);
    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, { text: "Cette commande est réservée aux groupes." }, { quoted: msg });
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
      await sock.sendMessage(from, { text: "Accès refusé. Admin, owner ou sudo requis." }, { quoted: msg });
      return;
    }

    const arg = args[0]?.toLowerCase();
    if (!arg || !["on", "off"].includes(arg)) {
      const current = _getGP(from).antiBot ? "activé" : "désactivé";
      await sock.sendMessage(from, { 
        text: `> SIGMA MDX DEPLOY: Anti-Bot\n\nétat : ${current}\n\nUtilisation : \`!antibot on\` ou \`!antibot off\``
      }, { quoted: msg });
      return;
    }

    const newState = arg === "on";
    _setGP(from, "antiBot", newState);

    await sock.sendMessage(from, { 
      text: `> SIGMA MDX DEPLOY: Anti-Bot ${newState ? "activé" : "désactivé"} dans ce groupe.`
    }, { quoted: msg });

  } catch (err) {
    console.error("Erreur antibot:", err);
    await sock.sendMessage(from, { text: "Une erreur est survenue." }, { quoted: msg });
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