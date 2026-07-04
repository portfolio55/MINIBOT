import crypto from "crypto";

export const name = "gpass";

export async function execute(sock, msg, args, from) {
  try {
    const length = args[0] ? parseInt(args[0], 10) : 12;
    if (Number.isNaN(length) || length < 8) {
      return await sock.sendMessage(from, {
        text: "❌ Indique une longueur valide (minimum 8 caractères).\nExemple : gpass 12"
      }, { quoted: msg });
    }
    if (length > 128) {
      return await sock.sendMessage(from, {
        text: "❌ Longueur max 128 caractères."
      }, { quoted: msg });
    }

    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}|;:,.<>?";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += chars[crypto.randomInt(0, chars.length)];
    }

    await sock.sendMessage(from, {
      text: `🔐 *Mot de passe généré*\n\n\`\`\`${password}\`\`\`\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴜᴢᴀɴ sɪɢᴍᴀ`
    }, { quoted: msg });
  } catch (err) {
    console.error("❌ Erreur gpass:", err);
    await sock.sendMessage(from, { text: "❌ Erreur lors de la génération." }, { quoted: msg });
  }
}
