import chalk from "chalk";
import fs from "fs";
import path from "path";

// =================== FONCTIONS UTILITAIRES ===================
const getOwnerLid = () => {
  try {
    if (!fs.existsSync("./jid.json")) {
      console.log(chalk.yellow("⚠️ jid.json non trouvé"));
      return null;
    }
    
    const rawData = fs.readFileSync("./jid.json", "utf-8");
    const jidData = JSON.parse(rawData);
    const ownerLid = jidData?.ownerLid;
    
    return ownerLid || null;
    
  } catch (error) {
    console.error(chalk.red("❌ Erreur lecture jid.json:"), error.message);
    return null;
  }
};

// Fonction pour extraire le texte du message
const getMessageText = (msg) => {
  if (!msg?.message) return "";
  
  const message = msg.message;
  
  return message.conversation || 
         message.extendedTextMessage?.text ||
         message.imageMessage?.caption ||
         message.videoMessage?.caption ||
         "";
};

// Fonction pour vérifier si le message mentionne l'owner
const isMentioningOwner = (msg) => {
  try {
    const ownerLid = getOwnerLid();
    if (!ownerLid) {
      console.log(chalk.yellow("⚠️ [AUDIORESPONS] Aucun ownerLid trouvé dans jid.json"));
      return false;
    }
    
    const text = getMessageText(msg);
    
    // Vérifier mention textuelle simple (@numéro)
    if (text && text.includes(`@${ownerLid}`)) {
      console.log(chalk.blue(`🔔 [AUDIORESPONS] Mention textuelle détectée: @${ownerLid}`));
      return true;
    }
    
    // Vérifier les mentions WhatsApp (JID)
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const ownerJid = `${ownerLid}@s.whatsapp.net`;
    
    if (mentionedJids.includes(ownerJid)) {
      console.log(chalk.blue(`🔔 [AUDIORESPONS] Mention JID détectée: ${ownerJid}`));
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error(chalk.red("❌ Erreur vérification mention:"), error.message);
    return false;
  }
};

// Fonction pour envoyer l'audio depuis le fichier local
const sendAudioResponse = async (sock, msg, from, sessionPath) => {
  try {
    const audioFilePath = sessionPath
      ? path.join(sessionPath, "respon.mp3")
      : path.resolve(process.cwd(), "respon.mp3");
    
    console.log(chalk.blue(`🎵 [AUDIORESPONS] Tentative de lecture: ${audioFilePath}`));
    
    // Vérifier si le fichier existe
    if (!fs.existsSync(audioFilePath)) {
      console.log(chalk.red(`❌ [AUDIORESPONS] Fichier non trouvé: ${audioFilePath}`));
      
      await sock.sendMessage(from, {
        text: "❌ Fichier 'respon.mp3' introuvable à la racine du projet."
      }, { quoted: msg });
      return;
    }
    
    // Lire les statistiques du fichier
    const stats = fs.statSync(audioFilePath);
    console.log(chalk.blue(`📁 [AUDIORESPONS] Taille fichier: ${stats.size} bytes`));
    
    if (stats.size === 0) {
      throw new Error("Fichier audio vide (0 byte)");
    }
    
    // Lire le fichier audio
    const audioBuffer = fs.readFileSync(audioFilePath);
    
    // Vérifier les premiers bytes pour confirmer que c'est un MP3
    const fileSignature = audioBuffer.slice(0, 3).toString('hex').toUpperCase();
    console.log(chalk.blue(`🔍 [AUDIORESPONS] Signature fichier: 0x${fileSignature}`));
    
    // MP3 signature: 0xFFFB ou 0x494433 (ID3)
    if (!(fileSignature.startsWith('FFFB') || fileSignature.startsWith('494433'))) {
      console.log(chalk.yellow(`⚠️ [AUDIORESPONS] Le fichier peut ne pas être un MP3 valide`));
    }
    
    // ENVOYER L'AUDIO EN RÉPONSE
    await sock.sendMessage(from, {
      audio: audioBuffer,
      mimetype: 'audio/mpeg', // Toujours 'audio/mpeg' pour MP3
      ptt: false // IMPORTANT: false pour fichier audio standard
    }, { quoted: msg });
    
    console.log(chalk.green(`✅ [AUDIORESPONS] Audio envoyé avec succès dans ${from}`));
    
  } catch (error) {
    console.error(chalk.red(`❌ [AUDIORESPONS] Erreur envoi audio:`, error.message));
    
    // Envoyer un message d'erreur
    try {
      await sock.sendMessage(from, {
        text: `❌ Erreur audio: ${error.message}`
      }, { quoted: msg });
    } catch (e) {
      console.error(chalk.red("❌ Impossible d'envoyer erreur"));
    }
  }
};

// =================== FONCTION D'INITIALISATION ===================
export function initProtections(sock, ownerNumber, sessionPath) {
  const botUuid = sessionPath ? path.basename(sessionPath).replace("bot_", "") : "global";
  console.log(chalk.green(`[AUDIORESPONS] Système initialisé - contrôle par .audiorespons on/off`));
  
  // Vérifier si le fichier respon.mp3 existe au démarrage
  const audioFilePath = sessionPath
    ? path.join(sessionPath, "respon.mp3")
    : path.resolve(process.cwd(), "respon.mp3");
  if (!fs.existsSync(audioFilePath)) {
    console.log(chalk.yellow(`⚠️ [AUDIORESPONS] Fichier 'respon.mp3' non trouvé à la racine.`));
    console.log(chalk.yellow(`   Créez un fichier MP3 nommé 'respon.mp3' à la racine du projet.`));
  } else {
    const stats = fs.statSync(audioFilePath);
    console.log(chalk.green(`✅ [AUDIORESPONS] Fichier 'respon.mp3' trouvé (${stats.size} bytes)`));
  }
  
  // Système DÉSACTIVÉ par défaut (sera activé par la commande .audiorespons on)
  let isResponsActive = false;
  
  // Stocker la référence du sock pour l'utiliser partout
  let globalSock = sock;
  
  // Écouter TOUS les messages (groupes et privés)
  sock.ev.on("messages.upsert", async ({ messages }) => {
    if (!messages || messages.length === 0 || !isResponsActive) return;
    
    const msg = messages[0];
    
    try {
      if (!msg.key || !msg.key.remoteJid) return;
      
      const from = msg.key.remoteJid;
      
      // Ignorer si c'est le bot lui-même
      if (msg.key.fromMe) return;
      
      // Vérifier si c'est un groupe ou discussion privée
      const isGroup = from.endsWith('@g.us');
      const isPrivate = from.endsWith('@s.whatsapp.net');
      
      if (!isGroup && !isPrivate) return; // Ignorer les statuts, etc.
      
      // Vérifier si ce message mentionne l'owner
      if (isMentioningOwner(msg)) {
        console.log(chalk.cyan(`🎯 [AUDIORESPONS] Mention détectée dans ${isGroup ? 'groupe' : 'privé'}: ${from}`));
        
        // Envoyer l'audio en réponse
        await sendAudioResponse(globalSock, msg, from, sessionPath);
      }
      
    } catch (error) {
      console.error(chalk.red("❌ [AUDIORESPONS] Erreur traitement message:", error.message));
    }
  });
  
  // === FONCTIONS DE CONTRÔLE POUR LA COMMANDE AUDIORESPONS ===
  const toggleRespons = () => {
    isResponsActive = !isResponsActive;
    console.log(chalk.yellow(`[AUDIORESPONS] ${isResponsActive ? 'ACTIVÉ dans tous les groupes' : 'DÉSACTIVÉ'}`));
    return isResponsActive;
  };
  
  const setResponsStatus = (status) => {
    isResponsActive = Boolean(status);
    console.log(chalk.yellow(`[AUDIORESPONS] ${isResponsActive ? 'ACTIVÉ dans tous les groupes' : 'DÉSACTIVÉ'}`));
    return isResponsActive;
  };
  
  // Stocker dans le global pour que la commande audiorespons puisse y accéder
  const responsSystem = {
    toggle: toggleRespons,
    setStatus: setResponsStatus,
    status: () => ({
      active: isResponsActive,
      ownerLid: getOwnerLid(),
      audioFile: fs.existsSync(audioFilePath) ? 
        `${path.basename(audioFilePath)} (${fs.statSync(audioFilePath).size} bytes)` : 
        'Non trouvé'
    })
  };
  
  // Initialiser le système global
  if (!global.responsRegistry) global.responsRegistry = {};
  global.responsRegistry[botUuid] = responsSystem;
  
  console.log(chalk.green(`✅ [AUDIORESPONS] Système prêt. Utilisez: .audiorespons on/off`));
  
  return responsSystem;
}