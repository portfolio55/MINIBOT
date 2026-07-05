import { downloadContentFromMessage } from "@whiskeysockets/baileys";

export const name = "vv";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
      await sock.sendMessage(
        from,
        { text: "> SIGMA MDX DEPLOY : 📸 Répondez à une photo, vidéo ou audio vue unique." }
      );
      return;
    }

    const innerMsg =
      quoted.viewOnceMessageV2?.message ||
      quoted.viewOnceMessageV2Extension?.message ||
      quoted;

    if (innerMsg.imageMessage) {
      const stream = await downloadContentFromMessage(innerMsg.imageMessage, "image");
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      await sock.sendMessage(from, { image: buffer });
      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
      return;
    }

    if (innerMsg.videoMessage) {
      const stream = await downloadContentFromMessage(innerMsg.videoMessage, "video");
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      await sock.sendMessage(from, { video: buffer });
      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
      return;
    }

    if (innerMsg.audioMessage) {
      const stream = await downloadContentFromMessage(innerMsg.audioMessage, "audio");
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      await sock.sendMessage(from, { audio: buffer, mimetype: "audio/mpeg" });
      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
      return;
    }

    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY: ❌ Pas une photo, vidéo ou audio vue unique." });
  } catch (err) {
    await sock.sendMessage(from, { text: `> SIGMA MDX DEPLOY: ❌ Erreur vv: ${err.message}` });
  }
}
