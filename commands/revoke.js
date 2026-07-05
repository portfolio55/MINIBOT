export const name = "revoke";

export async function execute(sock, msg, args, from) {
  if (!from.endsWith("@g.us")) {
    return await sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." }, { quoted: msg });
  }
  try {
    const meta = await sock.groupMetadata(from);
    const sender = msg.key.participant || from;
    const isAdmin = meta.participants.find(p => p.id === sender)?.admin;
    if (!isAdmin) {
      return await sock.sendMessage(from, { text: "❌ Seuls les admins peuvent révoquer le lien." });
    }
    await sock.groupRevokeInvite(from);
    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
  } catch (e) {
    console.error("Erreur revoke:", e);
    await sock.sendMessage(from, { text: "❌ Impossible de révoquer le lien." });
  }
}
