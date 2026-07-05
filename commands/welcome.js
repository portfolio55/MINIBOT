import fs from "fs";

import path from "path";

import { getGroupProtections, setGroupProtection, createGroupManager } from "../groupManager.js";
import { getSudoList, getOwners } from "../src/utils/cmdUtils.js";



export const name = "welcome";

export async function execute(sock, msg, args, from, botContext) {

  try {
    const { getGroupProtections: _getGP, setGroupProtection: _setGP } = botContext?.groupManager || createGroupManager(botContext?.sessionPath);

    // === GROUPE UNIQUEMENT ===

    if (!from.endsWith("@g.us")) {

      await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY: Cette commande est réservée aux groupes." });

      return;

    }

    // === RÉCUPÉRER L'EXPÉDITEUR ===

    const sender = msg.key.participant || from;

    const senderNum = sender.split("@")[0].replace(/[^0-9]/g, "");

    // === VÉRIFICATION DES DROITS ===

    const owners = getOwners(botContext).map(n => n.replace(/[^0-9]/g, ""));

    const sudoList = getSudoList(botContext).map(n => n.replace(/[^0-9]/g, ""));

    const isOwner = owners.includes(senderNum);

    const isSudo = sudoList.includes(senderNum);

    const isAdmin = await isGroupAdmin(sock, from, sender);

    if (!isOwner && !isSudo && !isAdmin) {

      await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY: Accès refusé. Admin, owner ou sudo requis." });

      return;

    }

    // === ARGUMENT ===

    const arg = args[0]?.toLowerCase();

    if (!arg || !["on", "off"].includes(arg)) {

      const current = _getGP(from).welcome ? "activé" : "désactivé";

      await sock.sendMessage(from, { 

        text: `> SIGMA MDX DEPLOY: Welcome Message\n\nétat : ${current}\n\nUtilisation : \`!welcome on\` ou \`!welcome off\``

      });

      return;

    }

    // === MISE é JOUR ===

    const newState = arg === "on";

    _setGP(from, "welcome", newState);

    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

  } catch (err) {

    console.error("Erreur welcome:", err);

    await sock.sendMessage(from, { text: "Une erreur est survenue." });

  }

}

// === Utilitaire isGroupAdmin ===

async function isGroupAdmin(sock, groupJid, userJid) {

  try {

    const metadata = await sock.groupMetadata(groupJid);

    return metadata.participants.some(p => p.id === userJid && p.admin);

  } catch {

    return false;

  }

}