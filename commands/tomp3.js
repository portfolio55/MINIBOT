import fs from "fs";
import path from "path";
import crypto from "crypto";
import { exec } from "child_process";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export const name = "tomp3";
export const aliases = ["v2a", "toaudio", "video2son"];
export const description = "Convertit une vidéo (ou un audio) en fichier mp3";
export const category = "Converter";

function unwrapMessage(message) {
  if (!message) return message;
  if (message.viewOnceMessageV2Extension?.message) return unwrapMessage(message.viewOnceMessageV2Extension.message);
  if (message.viewOnceMessageV2?.message) return unwrapMessage(message.viewOnceMessageV2.message);
  if (message.viewOnceMessage?.message) return unwrapMessage(message.viewOnceMessage.message);
  if (message.ephemeralMessage?.message) return unwrapMessage(message.ephemeralMessage.message);
  return message;
}

export async function execute(sock, msg, args) {
  const jid = msg.key.remoteJid;
  const tempFiles = [];

  let targetMessage = msg;
  if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    const quoted = msg.message.extendedTextMessage.contextInfo;
    targetMessage = {
      key: {
        remoteJid: jid,
        id: quoted.stanzaId,
        participant: quoted.participant,
      },
      message: unwrapMessage(quoted.quotedMessage),
    };
  } else {
    targetMessage = { key: msg.key, message: unwrapMessage(msg.message) };
  }

  const mediaMsg = targetMessage.message?.videoMessage || targetMessage.message?.audioMessage;

  if (!mediaMsg) {
    return await sock.sendMessage(
      jid,
      { text: "> SIGMA MDX DEPLOY : ⚠️ Réponds à une vidéo ou un audio avec `.tomp3` pour la convertir en son." },
      { quoted: msg }
    );
  }

  const tempDir = path.join(process.cwd(), "temp");
  fs.mkdirSync(tempDir, { recursive: true });

  const uid = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const inputExt = targetMessage.message?.audioMessage ? "ogg" : "mp4";
  const inputPath = path.join(tempDir, `tomp3_in_${uid}.${inputExt}`);
  const outputPath = path.join(tempDir, `tomp3_out_${uid}.mp3`);
  tempFiles.push(inputPath, outputPath);

  try {
    await sock.sendMessage(
      jid,
      { text: "> SIGMA MDX DEPLOY : 🎬 Conversion en son en cours..." },
      { quoted: msg }
    );

    let mediaBuffer;
    try {
      mediaBuffer = await downloadMediaMessage(
        targetMessage,
        "buffer",
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );
    } catch (dlErr) {
      throw new Error(`Impossible de télécharger le média (${dlErr.message}).`);
    }

    if (!mediaBuffer || mediaBuffer.length === 0) {
      throw new Error("Impossible de télécharger le média.");
    }

    fs.writeFileSync(inputPath, mediaBuffer);

    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -y -i "${inputPath}" -vn -acodec libmp3lame -q:a 2 "${outputPath}"`,
        { timeout: 60000 },
        (err, _stdout, stderr) => {
          if (err) return reject(new Error(stderr?.slice(0, 300) || err.message));
          resolve();
        }
      );
    });

    if (!fs.existsSync(outputPath)) throw new Error("Échec de la conversion en mp3.");

    await sock.sendMessage(
      jid,
      {
        audio: fs.readFileSync(outputPath),
        mimetype: "audio/mpeg",
        ptt: false,
        fileName: "audio.mp3"
      },
      { quoted: msg }
    );
  } catch (err) {
    console.error("❌ Erreur tomp3 :", err);
    await sock.sendMessage(
      jid,
      { text: `> SIGMA MDX DEPLOY : ❌ Erreur lors de la conversion.\n${err.message}` },
      { quoted: msg }
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
