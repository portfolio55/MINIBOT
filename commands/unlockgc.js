export const name = "unlockgc";

export async function execute(sock, msg, args, from) {
  if (!from.endsWith("@g.us")) {
    return await sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." }, { quoted: msg });
  }
  try {
    const meta = await sock.groupMetadata(from);
    const sender = msg.key.participant || from;
    const isAdmin = meta.participants.find(p => p.id === sender)?.admin;
    if (!isAdmin) {
      return await sock.sendMessage(from, { text: "❌ Seuls les admins peuvent déverrouiller le groupe." }, { quoted: msg });
    }
    await sock.groupSettingUpdate(from, "unlocked");
    await sock.sendMessage(from, { text: "🔓 Groupe déverrouillé. Les nouveaux membres peuvent rejoindre." }, { quoted: msg });
  } catch (e) {
    console.error("Erreur unlockgc:", e);
    await sock.sendMessage(from, { text: "❌ Impossible de déverrouiller." }, { quoted: msg });
  }
}
