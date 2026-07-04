export const name = "lockgc";

export async function execute(sock, msg, args, from) {
  if (!from.endsWith("@g.us")) {
    return await sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." }, { quoted: msg });
  }
  try {
    const meta = await sock.groupMetadata(from);
    const sender = msg.key.participant || from;
    const isAdmin = meta.participants.find(p => p.id === sender)?.admin;
    if (!isAdmin) {
      return await sock.sendMessage(from, { text: "❌ Seuls les admins peuvent verrouiller le groupe." }, { quoted: msg });
    }
    await sock.groupSettingUpdate(from, "locked");
    await sock.sendMessage(from, { text: "🔒 Groupe verrouillé. Les nouveaux membres ne peuvent plus rejoindre." }, { quoted: msg });
  } catch (e) {
    console.error("Erreur lockgc:", e);
    await sock.sendMessage(from, { text: "❌ Impossible de verrouiller." }, { quoted: msg });
  }
}
