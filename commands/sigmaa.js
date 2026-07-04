import fs from "fs";
import path from "path";
import { getGroupProtections, setGroupProtection, createGroupManager } from "../groupManager.js";
import { getSudoList, getOwners } from "../src/utils/cmdUtils.js";


export const name = "sigmavoice";

export async function execute(sock, msg, args, from, botContext) {
  try {
    const { getGroupProtections: _getGP, setGroupProtection: _setGP } = botContext?.groupManager || createGroupManager(botContext?.sessionPath);
    // Vérifie que c'est dans un groupe
    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, { 
        text: "> SIGMA MDX DEPLOY : Cette commande est réservée aux groupes uniquement." 
      }, { quoted: msg });
      return;
    }

    const sender = msg.key.participant || from;
    const senderNum = sender.split("@")[0].replace(/[^0-9]/g, "");

    // Récupération des owners et sudo
    const owners = getOwners(botContext).map(n => n.replace(/[^0-9]/g, ""));
    const sudoList = getSudoList(botContext).map(n => n.replace(/[^0-9]/g, ""));

    const isOwner = owners.includes(senderNum);
    const isSudo = sudoList.includes(senderNum);
    const isAdmin = await isGroupAdmin(sock, from, sender);

    // Vérification des permissions
    if (!isOwner && !isSudo && !isAdmin) {
      await sock.sendMessage(from, { 
        text: "> SIGMA MDX DEPLOY : Accès refusé.\nSeuls les admins, owners ou sudo peuvent utiliser cette commande." 
      }, { quoted: msg });
      return;
    }

    const arg = args[0]?.toLowerCase();

    // Affichage de l'état actuel si pas d'argument ou argument invalide
    if (!arg || !["on", "off"].includes(arg)) {
      const current = _getGP(from).sigmaVoice ? "activé" : "désactivé";
      await sock.sendMessage(from, { 
        text: `> SIGMA MDX DEPLOY : 🎨 Mode SIGMA VOICE (IA Vocale Auto)\n\nétat actuel : *${current}*\n\nUtilisation :\n\`!sigmavoice on\` ? Activer les réponses vocales automatiques\n\`!sigmavoice off\` ? Désactiver`
      }, { quoted: msg });
      return;
    }

    // Activation / Désactivation
    const newState = arg === "on";
    _setGP(from, "sigmaVoice", newState);

    await sock.sendMessage(from, { 
      text: `> SIGMA MDX DEPLOY : 🎨 SIGMA VOICE (IA Vocale) a été *${newState ? "activé" : "désactivé"}* dans ce groupe.`
    }, { quoted: msg });

  } catch (err) {
    console.error("Erreur commande sigmavoice :", err);
    await sock.sendMessage(from, { 
      text: "> SIGMA MDX DEPLOY : ?? Une erreur est survenue lors du traitement de la commande." 
    }, { quoted: msg });
  }
}

// Fonction pour vérifier si l'utilisateur est admin du groupe
async function isGroupAdmin(sock, groupJid, userJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    return metadata.participants.some(p => p.id === userJid && p.admin);
  } catch {
    return false;
  }
}