import fs from "fs";
import path from "path";
import { exec } from "child_process";
import crypto from "crypto";
import webp from "node-webpmux";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export const name = "sticker";
export const aliases = ["s"];

function unwrapMessage(message) {
  if (!message) return message;
  if (message.viewOnceMessageV2Extension?.message) return unwrapMessage(message.viewOnceMessageV2Extension.message);
  if (message.viewOnceMessageV2?.message) return unwrapMessage(message.viewOnceMessageV2.message);
  if (message.viewOnceMessage?.message) return unwrapMessage(message.viewOnceMessage.message);
  if (message.ephemeralMessage?.message) return unwrapMessage(message.ephemeralMessage.message);
  return message;
}

export async function execute(sock, m, args) {
  const jid = m.key.remoteJid;
  const tempFiles = [];

  try {
    const username = m.pushName || "Utilisateur";

    // Message cible (direct ou cité)
    let targetMessage = m;
    if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quoted = m.message.extendedTextMessage.contextInfo;
      targetMessage = {
        key: {
          remoteJid: jid,
          id: quoted.stanzaId,
          participant: quoted.participant,
        },
        message: unwrapMessage(quoted.quotedMessage),
      };
    } else {
      targetMessage = { key: m.key, message: unwrapMessage(m.message) };
    }

    const mediaMsg =
      targetMessage.message?.imageMessage ||
      targetMessage.message?.videoMessage ||
      targetMessage.message?.documentMessage ||
      targetMessage.message?.stickerMessage;

    if (!mediaMsg) {
      return await sock.sendMessage(
        jid,
        { text: "> SIGMA MDX DEPLOY : ⚠️ Réponds à une image ou vidéo (ou envoie-la avec la légende) avec `.sticker`." },
        { quoted: m }
      );
    }

    // Vidéos : WhatsApp limite les stickers animés à ~10s, on protège le traitement
    if (mediaMsg.seconds && mediaMsg.seconds > 15) {
      return await sock.sendMessage(
        jid,
        { text: "> SIGMA MDX DEPLOY : ⚠️ La vidéo est trop longue (max ~15s) pour être convertie en sticker." },
        { quoted: m }
      );
    }

    // Téléchargement du média
    let mediaBuffer;
    try {
      mediaBuffer = await downloadMediaMessage(
        targetMessage,
        "buffer",
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );
    } catch (dlErr) {
      return await sock.sendMessage(
        jid,
        { text: `> SIGMA MDX DEPLOY : ❌ Impossible de télécharger le média (${dlErr.message}).` },
        { quoted: m }
      );
    }

    if (!mediaBuffer || mediaBuffer.length === 0) {
      return await sock.sendMessage(
        jid,
        { text: "> SIGMA MDX DEPLOY : ❌ Média vide ou introuvable." },
        { quoted: m }
      );
    }

    // Dossier temporaire
    const tempDir = path.join(process.cwd(), "temp");
    fs.mkdirSync(tempDir, { recursive: true });

    const isAnimated =
      !!targetMessage.message?.videoMessage ||
      mediaMsg.mimetype?.includes("video") ||
      mediaMsg.mimetype?.includes("gif") ||
      (mediaMsg.seconds && mediaMsg.seconds > 0);

    const inputExt = isAnimated ? "mp4" : "png";
    const inputPath = path.join(tempDir, `input_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${inputExt}`);
    const outputPath = path.join(tempDir, `sticker_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.webp`);
    tempFiles.push(inputPath, outputPath);
    fs.writeFileSync(inputPath, mediaBuffer);

    // Conversion via ffmpeg
    const cmd = isAnimated
      ? `ffmpeg -y -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0.0" -loop 0 -c:v libwebp -preset default -an -vsync 0 -pix_fmt yuva420p -quality 70 -compression_level 6 -t 10 "${outputPath}"`
      : `ffmpeg -y -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0.0" -loop 0 -c:v libwebp -preset default -an -vsync 0 -pix_fmt yuva420p -quality 80 -compression_level 6 "${outputPath}"`;

    await new Promise((resolve, reject) => {
      exec(cmd, { timeout: 30000 }, (err, _stdout, stderr) => {
        if (err) return reject(new Error(stderr?.slice(0, 300) || err.message));
        resolve();
      });
    });

    if (!fs.existsSync(outputPath)) throw new Error("échec de la conversion en WebP.");

    // Ajout des métadonnées EXIF
    const webpBuffer = fs.readFileSync(outputPath);
    const img = new webp.Image();
    await img.load(webpBuffer);

    const metadata = {
      "sticker-pack-id": crypto.randomBytes(16).toString("hex"),
      "sticker-pack-name": "SIGMA MDX",
      "sticker-pack-publisher": username,
      emojis: ["😀"],
    };

    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuffer = Buffer.from(JSON.stringify(metadata), "utf8");
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);

    img.exif = exif;
    const finalBuffer = await img.save(null);

    // Envoi du sticker
    await sock.sendMessage(jid, { sticker: finalBuffer }, { quoted: m });
  } catch (e) {
    console.error("❌ Erreur sticker.js :", e);
    await sock.sendMessage(
      jid,
      { text: `> SIGMA MDX DEPLOY : ❌ Erreur sticker : ${e.message}` },
      { quoted: m }
    );
  } finally {
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignorer les erreurs de nettoyage
      }
    }
  }
}
