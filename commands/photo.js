import { downloadContentFromMessage } from "@whiskeysockets/baileys";

export const name = "photo";
export async function execute(sock, m, args) {
  try {
    // Vérifie si on répond à un sticker
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
    if (!quoted) {
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "> SIGMA MDX DEPLOY: Répondez au sticker é convertir en image." },
        { quoted: m }
      );
      return;
    }

    // Télécharge le sticker
    const stream = await downloadContentFromMessage(quoted, "sticker");
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    // Renvoie le sticker comme photo
    await sock.sendMessage(
      m.key.remoteJid,
      {
        image: buffer,
        caption: "> SIGMA MDX DEPLOY: Conversion reussie",
      },
      { quoted: m }
    );
  } catch (e) {
    await sock.sendMessage(
      m.key.remoteJid,
      { text: "> SIGMA MDX DEPLOY: ? Erreur conversion sticker ? photo : " + e.message },
      { quoted: m }
    );
  }
}