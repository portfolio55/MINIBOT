export const name = "kick";

export async function execute(sock, msg, args) {

  try {

    const from = msg.key.remoteJid;

    if (!from.endsWith("@g.us")) {

      return await sock.sendMessage(from, {

        text: "> SIGMA MDX DEPLOY:Commande de groupe ."

      }, { quoted: msg });

    }

    const groupMetadata = await sock.groupMetadata(from);

    // Récupérer les JID des membres à expulser

    let targets = [];

    // 1️⃣ Si mention

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

    if (mentioned && mentioned.length > 0) targets.push(...mentioned);

    // 2️⃣ Si réponse à un message

    const replied = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (replied) {

      const sender = msg.message.extendedTextMessage.contextInfo.participant;

      if (sender) targets.push(sender);

    }

    if (targets.length === 0) {

      return await sock.sendMessage(from, {

        text: "> SIGMA MDX DEPLOY: Mentionnez ou répondez au message du membre à supprimer !"

      }, { quoted: msg });

    }

    // Filtrer les doublons

    targets = [...new Set(targets)];

    // Expulser chaque membre

    await sock.groupParticipantsUpdate(from, targets, "remove");

    // Actualiser les infos du groupe aprèss expulsion

    const updatedGroup = await sock.groupMetadata(from);

    const remainingCount = updatedGroup.participants.length;

    // Message de confirmation stylisé

    const mentionsText = targets.map(jid => `👤 @${jid.split("@")[0]} ✅`).join("\n");

    const confirmationText = `> SIGMA MDX DEPLOY:
> 🚫 Membres expulsés :${mentionsText}
> 👥 Membres restants : ${remainingCount}`;

    await sock.sendMessage(from, { 

      text: confirmationText,

      mentions: targets

    });

  } catch (err) {

    console.error("_⚡SIGMA MDX MDX⚡:_ Erreur kick :", err);

    await sock.sendMessage(msg.key.remoteJid, {

      text: "> SIGMA MDX DEPLOY: ? Suppression Impossible."

    }, { quoted: msg });

  }

}