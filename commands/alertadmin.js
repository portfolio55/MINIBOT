// =================== COMMANDE ALERTADMIN ===================
// Fichier : commandes/alertadmin.js

import fs from "fs";
import path from "path";
import { getGroupProtections, setGroupProtection, createGroupManager } from "../groupManager.js";
import { getSudoList, getOwners } from "../src/utils/cmdUtils.js";


export const name = "alertadmin";
export const aliases = ["aa", "adminalert", "promotealert"];

export async function execute(sock, msg, args, from, botContext) {
  try {
    if (!from) from = msg.key.remoteJid;
    
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
    
    if (!arg || !["on", "off", "état", "status", "info", "help"].includes(arg)) {
      const groupProtections = getGroupProtections(from);
      const current = groupProtections?.alertAdmin ? "✅ Activé" : "⚡ Désactivé";
      
      await sock.sendMessage(from, { 
        text: `> SIGMA MDX DEPLOY: AlertAdmin ${current}`
      }, { quoted: msg });
      return;
    }

    if (arg === "on") {
      setGroupProtection(from, "alertAdmin", true);
      
      await sock.sendMessage(from, { 
        text: `> SIGMA MDX DEPLOY: AlertAdmin ✅ ACTIVé

? Alertes détaillées activées pour les changements d'administrateurs.`
      }, { quoted: msg });
      
    } else if (arg === "off") {
      setGroupProtection(from, "alertAdmin", false);
      
      await sock.sendMessage(from, { 
        text: `> SIGMA MDX DEPLOY: AlertAdmin ?? DÉSACTIVÉ

? Les alertes de promotion/révocation sont désactivées.`
      }, { quoted: msg });
      
    } else if (arg === "état" || arg === "status" || arg === "info") {
      const groupProtections = getGroupProtections(from);
      const current = groupProtections?.alertAdmin ? "✅ Activé" : "⚡ Désactivé";
      
      const configInfo = `é Fonction : Alertes détaillées admin
é état : ${current}
é Alertes : Groupe + Propriétaire + Mentions admin
é Types : Promote (? admin) et Demote (? membre)
é Mentions : Cible + Acteur + Admins actuels
é Heure : Incluse avec fuseau horaire
é Réactions : Emoji selon l'action`;

      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY - AlertAdmin

?? ÉTAT ET CONFIGURATION

${configInfo}

⚙️ Commandes :
é .alertadmin on - Active
é .alertadmin off - Désactive
é .alertadmin status - Cette info

?? Alias : .aa, .adminalert, .promotealert

?? Différence avec warnAdmin :
é Messages plus détaillés et formatés
é Mentions supplémentaires des admins
é Heure précise de l'événement
é Notification au propriétaire`
      }, { quoted: msg });
      
    } else if (arg === "help") {
      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY - Aide AlertAdmin

?? QU'EST-CE QUE C'EST ?
AlertAdmin est un système de notification avancé pour les changements d'administrateurs.

?? QUE FAIT-IL ?
1. Détecte les promotions (promote) et révocations (demote)
2. Envoie une alerte détaillée dans le groupe
3. Mentionne la personne affectée et celle qui a agi
4. Avertit le propriétaire du bot en privé
5. Mentionne tous les administrateurs actuels

?? CONFIGURATION :
é Activé/désactivé par groupe
é Fonctionne seulement si le bot est admin
é Inclut l'heure exacte (fuseau Afrique/Alger)
é Messages formatés avec emojis

?? REMARQUE :
Le bot doit être administrateur pour envoyer les alertes dans le groupe.`
      }, { quoted: msg });
    }

  } catch (err) {
    console.error("? Erreur commande alertadmin:", err);
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