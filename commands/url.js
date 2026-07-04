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

    // catbox.moe bloque l'upload direct de fichiers (fileupload) depuis les hébergeurs comme
    // Replit, mais accepte l'upload par URL (urlupload). On héberge donc le fichier
    // temporairement sur litterbox (même famille catbox), puis on demande à catbox.moe de le
    // récupérer via cette URL pour obtenir un lien permanent files.catbox.moe.
    const tempForm = new FormData();
    tempForm.append("reqtype", "fileupload");
    tempForm.append("time", "1h");
    tempForm.append("fileToUpload", fs.createReadStream(filePath));

    const tempUpload = await axios.post("https://litterbox.catbox.moe/resources/internals/api.php", tempForm, {
      headers: tempForm.getHeaders(),
      timeout: 30000
    });

    fs.unlinkSync(filePath); // Nettoyage

    const tempUrl = typeof tempUpload.data === "string" ? tempUpload.data.trim() : "";
    if (!tempUrl || !tempUrl.startsWith("http")) throw new Error("Upload temporaire échoué, aucune URL retournée.");

    const permForm = new FormData();
    permForm.append("reqtype", "urlupload");
    permForm.append("url", tempUrl);

    const permUpload = await axios.post("https://catbox.moe/user/api.php", permForm, {
      headers: permForm.getHeaders(),
      timeout: 30000
    });

    const url = typeof permUpload.data === "string" ? permUpload.data.trim() : "";
    if (!url || !url.startsWith("http")) throw new Error("Upload catbox échoué, aucune URL permanente retournée.");
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