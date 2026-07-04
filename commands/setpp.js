import { downloadContentFromMessage } from "@whiskeysockets/baileys";

export const name = "setpp";

export async function execute(sock, msg, args) {

  const from = msg.key.remoteJid;

  // Vérifier si on a bien répondu à un message

  const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;

  if (!ctxInfo || !ctxInfo.quotedMessage?.imageMessage) {

    return await sock.sendMessage(from, {

      text: "> SIGMA MDX DEPLOY: ?? Réponds à une image pour changer la photo de profil du bot."

    }, { quoted: msg });

  }

  try {

    const quoted = ctxInfo.quotedMessage.imageMessage;

    // Télécharger l'image via Baileys

    const stream = await downloadContentFromMessage(quoted, "image");

    let buffer = Buffer.from([]);

    for await (const chunk of stream) {

      buffer = Buffer.concat([buffer, chunk]);

    }

    // Définir la photo de profil du bot

    await sock.updateProfilePicture(sock.user.id, buffer);

    await sock.sendMessage(from, {

      text: "> SIGMA MDX DEPLOY: ? La photo de profil du bot a été mise à jour avec succés !"

    }, { quoted: msg });

  } catch (err) {

    console.error("? Erreur setpp :", err);

    await sock.sendMessage(from, {

      text: "> SIGMA MDX DEPLOY: ? Impossible de changer la photo de profil."

    }, { quoted: msg });

  }

}