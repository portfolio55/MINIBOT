// =================== COMMANDE AUTO-VV2 ===================
// Fichier : commandes/autovv2.js

import fs from "fs";
import path from "path";
import { createGroupManager } from "../groupManager.js";
import { getSudoList, getOwners } from "../src/utils/cmdUtils.js";


export const name = "autovv";
export const aliases = ["avv2", "autoviewonce2", "vv2"];

export async function execute(sock, msg, args, from, botContext) {
  try {
    if (!from) from = msg.key.remoteJid;
    
    const gm = createGroupManager(botContext?.sessionPath);
    const getGroupProtections = gm.getGroupProtections;
    const setGroupProtection = gm.setGroupProtection;

    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, { 
        text: "? Cette commande est réservée aux groupes." 
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
        text: "? Accès refusé. Admin, owner ou sudo requis." 
      }, { quoted: msg });
      return;
    }

    const arg = args[0]?.toLowerCase();
    
    if (!arg || !["on", "off", "config", "status", "help"].includes(arg)) {
      const groupProtections = getGroupProtections(from);
      const current = groupProtections?.autoVV2 ? "✅ Activé" : "⚡ Désactivé";
      
      await sock.sendMessage(from, { 
        text: `> SIGMA MDX DEPLOY: Auto-VV 2.0

?? état : ${current}

?? Utilisation :
é .autovv2 on - Active la récupération améliorée des vues uniques
é .autovv2 off - Désactive la récupération
é .autovv2 config - Affiche la configuration
é .autovv2 status - Affiche l'état détaillé

?? Alias : .avv2, .autoviewonce2, .vv2

?? Version 2.0 : Supporte images, vidéos, audios, stickers, documents`
      }, { quoted: msg });
      return;
    }

    if (arg === "on") {
      setGroupProtection(from, "autoVV2", true);
      
      const config = { supportedTypes: ["image", "video", "audio", "sticker", "document"], ignoreAdmins: false, sendReaction: true, maxFileSize: 50 * 1024 * 1024 };
      const supportedTypes = config.supportedTypes.join(", ");
      const ignoreAdmins = config.ignoreAdmins ? "Oui" : "Non";
      
      await sock.sendMessage(from, { 
        text: `> SIGMA MDX DEPLOY: Auto-VV 2.0 ✅ ACTIVé

? SIGMA MDX récupérera automatiquement les messages en vue unique avec la version 2.0.

?? NOUVEAUTéS :
é Support étendu : Images, Vidéos, Audios, Stickers, Documents
é Mentions de l'expéditeur
é Réactions automatiques
é Meilleure gestion d'erreurs

?? Configuration actuelle :
é Types supportés : ${supportedTypes}
é Ignore les admins : ${ignoreAdmins}
é Taille max : ${(config.maxFileSize / (1024*1024)).toFixed(0)} MB

?? Utilise .autovv2 off pour désactiver`
      }, { quoted: msg });
      
    } else if (arg === "off") {
      setGroupProtection(from, "autoVV2", false);
      
      await sock.sendMessage(from, { 
        text: `> SIGMA MDX DEPLOY: Auto-VV 2.0 ?? DÉSACTIVÉ

? SIGMA MDX ne récupérera plus les messages en vue unique (version 2.0).

?? Les messages en vue unique resteront privés comme prévu par l'expéditeur.`
      }, { quoted: msg });
      
    } else if (arg === "config" || arg === "status") {
      const groupProtections = getGroupProtections(from);
      const current = groupProtections?.autoVV2 ? "✅ Activé" : "⚡ Désactivé";
      const config = { supportedTypes: ["image", "video", "audio", "sticker", "document"], ignoreAdmins: false, sendReaction: true, maxFileSize: 50 * 1024 * 1024 };
      
      const configInfo = `é état : ${current}
é Types supportés : ${config.supportedTypes.join(", ")}
é Ignore les admins : ${config.ignoreAdmins ? "Oui" : "Non"}
é Taille max : ${(config.maxFileSize / (1024*1024)).toFixed(0)} MB
é Envoi réaction : ${config.sendReaction ? "Oui" : "Non"}
é Mode privé (DM) : ✅ Activé`;

      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY - Auto-VV 2.0

?? ÉTAT ET CONFIGURATION

${configInfo}

⚙️ Commandes :
é .autovv2 on - Active dans ce groupe
é .autovv2 off - Désactive dans ce groupe
é .autovv2 config - Cette info

?? Alias : .avv2, .autoviewonce2, .vv2`
      }, { quoted: msg });
      
    } else if (arg === "help") {
      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY - Aide Auto-VV 2.0

?? QU'EST-CE QUE C'EST ?
Auto-VV 2.0 est une version améliorée qui récupère automatiquement les messages envoyés en "vue unique" et les rend visibles é tous.

🎨 FONCTIONNALITéS :
é Récupère les images, vidéos, audios, stickers et documents
é Mentionne l'expéditeur original
é Ajoute une réaction au message
é Gestion d'erreurs améliorée

?? CONFIGURATION :
é Par défaut : Ignore les admins du groupe
é Taille max : 100MB par fichier
é Fonctionne aussi en messages privés (DM)

?? REMARQUE :
Cette fonction respecte la vie privée et peut être désactivée é tout moment.`
      }, { quoted: msg });
    }

  } catch (err) {
    console.error("? Erreur commande autovv2:", err);
    await sock.sendMessage(from, { 
      text: `? Erreur : ${err.message || "Erreur inconnue"}` 
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