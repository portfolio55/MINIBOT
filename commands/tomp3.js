import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export const name = "tomp3";
export const aliases = ["v2a", "toaudio", "video2son"];
export const description = "Convertit une vidéo en fichier audio (mp3)";
export const category = "Converter";

export async function execute(sock, msg, args) {
  const jid = msg.key.remoteJid;

  let targetMessage = msg;
  if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    const quoted = msg.message.extendedTextMessage.contextInfo;
    targetMessage = {
      key: {
        remoteJid: jid,
        id: quoted.stanzaId,
        participant: quoted.participant,
      },
      message: quoted.quotedMessage,
    };
  }

  const videoMsg = targetMessage.message?.videoMessage;

  if (!videoMsg) {
    return await sock.sendMessage(
      jid,
      { text: "> SIGMA MDX DEPLOY: ⚠️ Réponds à une vidéo avec `.tomp3` pour la convertir en son." },
      { quoted: msg }
    );
  }

  const tempDir = "./temp";
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  const inputPath = path.join(tempDir, `tomp3_in_${Date.now()}.mp4`);
  const outputPath = path.join(tempDir, `tomp3_out_${Date.now()}.mp3`);

  try {
    await sock.sendMessage(
      jid,
      { text: "> SIGMA MDX DEPLOY: 🎬 Conversion de la vidéo en son en cours..." },
      { quoted: msg }
    );

    const videoBuffer = await downloadMediaMessage(
      targetMessage,
      "buffer",
      {},
      { reuploadRequest: sock.updateMediaMessage }
    );

    if (!videoBuffer || videoBuffer.length === 0) {
      throw new Error("Impossible de télécharger la vidéo.");
    }

    fs.writeFileSync(inputPath, videoBuffer);

    await new Promise((resolve, reject) => {
      exec(`ffmpeg -y -i "${inputPath}" -vn -acodec libmp3lame -q:a 2 "${outputPath}"`, (err) => {
        if (err) reject(err);
        else resolve();
      });
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
      { text: `> SIGMA MDX DEPLOY: ❌ Erreur lors de la conversion.\n${err.message}` },
      { quoted: msg }
    );
  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
}
