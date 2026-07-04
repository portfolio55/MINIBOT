export const name = "setgname";

export async function execute(sock, msg, args, from) {
  if (!from.endsWith("@g.us")) {
    return await sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." }, { quoted: msg });
  }
  const newName = args.join(" ").trim();
  if (!newName) {
    return await sock.sendMessage(from, { text: "❌ Donne le nouveau nom du groupe.\nExemple : !setgname Mon Groupe" }, { quoted: msg });
  }
  try {
    const meta = await sock.groupMetadata(from);
    const sender = msg.key.participant || from;
    const isAdmin = meta.participants.find(p => p.id === sender)?.admin;
    if (!isAdmin) {
      return await sock.sendMessage(from, { text: "❌ Seuls les admins peuvent modifier le nom." }, { quoted: msg });
    }
    await sock.groupUpdateSubject(from, newName);
    await sock.sendMessage(from, { text: `✅ Nom du groupe mis à jour : *${newName}*` }, { quoted: msg });
  } catch (e) {
    console.error("Erreur setgname:", e);
    await sock.sendMessage(from, { text: "❌ Impossible de modifier le nom." }, { quoted: msg });
  }
}
