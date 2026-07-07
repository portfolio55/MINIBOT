import fs from "fs";
import path from "path";
import axios from "axios";

export const name = "sigma";

const DEFAULT_IMAGE = "https://files.catbox.moe/as264g.jpg";

function configPath(botContext) {
  const sessionPath = botContext?.sessionPath;
  return sessionPath
    ? path.join(sessionPath, "sigma.json")
    : path.join(process.cwd(), "sigma.json");
}

function loadConfig(botContext) {
  try {
    const p = configPath(botContext);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  } catch {}
  return { image: DEFAULT_IMAGE, text: "" };
}

function saveConfig(botContext, config) {
  fs.writeFileSync(configPath(botContext), JSON.stringify(config, null, 2));
}

async function downloadImage(url) {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
  return Buffer.from(res.data);
}

export async function execute(sock, m, args, from, botContext) {
  const jid = m.key.remoteJid;

  try {
    // ── Configuration : .sigma <texte> <lien_image> ──────────────
    if (args.length > 0) {
      const urlIndex = args.findIndex(a => /^https?:\/\//i.test(a));
      const imageUrl = urlIndex >= 0 ? args[urlIndex] : null;
      const text = args.filter((_, i) => i !== urlIndex).join(" ").trim();

      const config = loadConfig(botContext);

      if (imageUrl) {
        // Vérifier que le lien est bien accessible avant de le sauvegarder
        try {
          const buf = await downloadImage(imageUrl);
          if (!buf || buf.length === 0) throw new Error("image vide");
          config.image = imageUrl;
        } catch {
          await sock.sendMessage(jid, { text: "❌ Lien d'image invalide ou inaccessible." });
          return;
        }
      }
      if (text) config.text = text;
      saveConfig(botContext, config);

      // Convention : succès = réaction ✅ (pas de message qui cite la commande)
      await sock.sendMessage(jid, { react: { text: "✅", key: m.key } });
      return;
    }

    // ── Envoi : .sigma (sans argument) ────────────────────────────
    const config = loadConfig(botContext);
    const buffer = await downloadImage(config.image || DEFAULT_IMAGE);
    await sock.sendMessage(jid, {
      image: buffer,
      caption: config.text || ""
    });
  } catch (e) {
    console.error("sigma error:", e);
    await sock.sendMessage(jid, { text: "❌ Erreur: " + e.message });
  }
}
