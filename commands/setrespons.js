import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import axios from "axios";

export const name = "setrespons";
export const aliases = ["setaudiorespons", "setaudio"];

async function downloadFromUrl(url) {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
  return Buffer.from(res.data);
}

export async function execute(sock, m, args, from, botContext) {
  const sessionPath = botContext?.sessionPath;
  const link = args[0]?.trim();

  try {
    let buffer;

    if (link && /^https?:\/\//i.test(link)) {
      await sock.sendMessage(m.key.remoteJid, { text: "🔄 Téléchargement de l'audio depuis le lien..." }, { quoted: m });
      buffer = await downloadFromUrl(link);
    } else {
      const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage || m.message;
      if (!quoted?.audioMessage) {
        await sock.sendMessage(m.key.remoteJid, {
          text: "❌ Réponds à un message audio, ou tape `.setrespons <lien_audio>` pour définir l'audio de réponse automatique."
        }, { quoted: m });
        return;
      }

      await sock.sendMessage(m.key.remoteJid, { text: "🔄 Traitement de l'audio..." }, { quoted: m });

      const stream = await downloadContentFromMessage(quoted.audioMessage, "audio");
      buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    }

    if (!buffer || buffer.length === 0) throw new Error("Audio vide ou inaccessible");

    // Chemin isolé par session
    const outputPath = sessionPath
      ? path.join(sessionPath, "respon.mp3")
      : path.join(process.cwd(), "respon.mp3");

    fs.writeFileSync(outputPath, buffer);
    const stats = fs.statSync(outputPath);

    await sock.sendMessage(m.key.remoteJid, {
      text: `✅ Audio de réponse défini avec succès ! (${Math.round(stats.size / 1024)} KB)\n\nActive-le avec \`.audiorespons on\` — dès qu'on te mentionne dans un groupe ou en privé, cet audio sera envoyé automatiquement.`
    }, { quoted: m });

  } catch (e) {
    console.error("setrespons error:", e);
    await sock.sendMessage(m.key.remoteJid, {
      text: `❌ Erreur: ${e.message}`
    }, { quoted: m });
  }
}
