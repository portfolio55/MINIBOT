import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import axios from "axios";
import fs from "fs";
import { join } from "path";
import FormData from "form-data";

export const name = "url";
export async function execute(sock, m, args) {
  try {
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage || m.message;

    let type = null;
    if (quoted.imageMessage) type = "image";
    else if (quoted.videoMessage) type = "video";
    else if (quoted.audioMessage) type = "audio";

    if (!type) {
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "> SIGMA MDX DEPLOY: ?? Réponds à une image, vidéo ou audio pour la convertir en URL." },
        { quoted: m }
      );
      return;
    }

    // Télécharger le média
    const stream = await downloadContentFromMessage(quoted[`${type}Message`], type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

    // Sauvegarde temporaire
    const tempDir = "./temp";
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const ext = type === "image" ? "jpg" : type === "video" ? "mp4" : "mp3";
    const filePath = join(tempDir, `media_${Date.now()}.${ext}`);
    fs.writeFileSync(filePath, buffer);

    // Upload vers litterbox.catbox.moe (l'API catbox classique bloque les uploads anonymes
    // depuis les hébergeurs comme Replit, litterbox reste accessible et donne des liens catbox)
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("time", "72h");
    form.append("fileToUpload", fs.createReadStream(filePath));

    const upload = await axios.post("https://litterbox.catbox.moe/resources/internals/api.php", form, {
      headers: form.getHeaders(),
      timeout: 30000
    });

    fs.unlinkSync(filePath); // Nettoyage

    const url = typeof upload.data === "string" ? upload.data.trim() : "";
    if (!url || !url.startsWith("http")) throw new Error("Upload échoué, aucune URL retournée.");
    await sock.sendMessage(
      m.key.remoteJid,
      { text: `> SIGMA MDX DEPLOY: ? URL générée : ${url}` },
      { quoted: m }
    );
  } catch (e) {
    await sock.sendMessage(
      m.key.remoteJid,
      { text: "? Erreur URL : " + e.message },
      { quoted: m }
    );
  }
}