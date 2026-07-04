import { downloadContentFromMessage } from "@whiskeysockets/baileys";

export const name = "vv2";
export async function execute(sock, m, args) {
  try {
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "> SIGMA MDX DEPLOY : Repondez a une photo, video ou audio vue unique." },
        { quoted: m }
      );
      return;
    }

    const innerMsg =
      quoted.viewOnceMessageV2?.message ||
      quoted.viewOnceMessageV2Extension?.message ||
      quoted;

    const ownerJid = sock.user?.id;
    if (!ownerJid) {
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "> SIGMA MDX DEPLOY : Impossible de determiner le numero de l'owner." },
        { quoted: m }
      );
      return;
    }

    let buffer = Buffer.from([]);
    let mediaType = null;
    let caption = `> SIGMA MDX DEPLOY : Media recupere depuis ${m.key.remoteJid}`;

    if (innerMsg.imageMessage) {
      const stream = await downloadContentFromMessage(innerMsg.imageMessage, "image");
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      mediaType = "image";
    }
    else if (innerMsg.videoMessage) {
      const stream = await downloadContentFromMessage(innerMsg.videoMessage, "video");
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      mediaType = "video";
    }
    else if (innerMsg.audioMessage) {
      const stream = await downloadContentFromMessage(innerMsg.audioMessage, "audio");
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      mediaType = "audio";
    }
    else {
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "> SIGMA MDX DEPLOY : Pas une photo, video ou audio vue unique." },
        { quoted: m }
      );
      return;
    }

    try {
      if (mediaType === "image") {
        await sock.sendMessage(ownerJid, { 
          image: buffer, 
          caption: caption 
        });
      } else if (mediaType === "video") {
        await sock.sendMessage(ownerJid, { 
          video: buffer, 
          caption: caption 
        });
      } else if (mediaType === "audio") {
        await sock.sendMessage(ownerJid, { 
          audio: buffer, 
          mimetype: "audio/mp4", 
          ptt: innerMsg.audioMessage?.ptt || false 
        });
      }

      await sock.sendMessage(
        m.key.remoteJid,
        { text: "> SIGMA MDX DEPLOY : Media recupere et envoye dans l'IB de l'owner." },
        { quoted: m }
      );
    } catch (sendError) {
      console.error("Erreur lors de l'envoi a l'owner:", sendError);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: `> SIGMA MDX DEPLOY : Erreur lors de l'envoi a l'owner: ${sendError.message}` },
        { quoted: m }
      );
    }

  } catch (e) {
    await sock.sendMessage(
      m.key.remoteJid,
      { text: "Erreur vv2 : " + e.message },
      { quoted: m }
    );
  }
}
