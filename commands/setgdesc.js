export const name = "setgdesc";

export async function execute(sock, msg, args, from) {
  if (!from.endsWith("@g.us")) {
    return await sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." }, { quoted: msg });
  }
  const desc = args.join(" ").trim();
  if (!desc) {
    return await sock.sendMessage(from, { text: "❌ Donne la nouvelle description.\nExemple : !setgdesc Ma description" }, { quoted: msg });
  }
  try {
    const meta = await sock.groupMetadata(from);
    const sender = msg.key.participant || from;
    const isAdmin = meta.participants.find(p => p.id === sender)?.admin;
    if (!isAdmin) {
      return await sock.sendMessage(from, { text: "❌ Seuls les admins peuvent modifier la description." }, { quoted: msg });
    }
    await sock.groupUpdateDescription(from, desc);
    await sock.sendMessage(from, { text: "✅ Description du groupe mise à jour." }, { quoted: msg });
  } catch (e) {
    console.error("Erreur setgdesc:", e);
    await sock.sendMessage(from, { text: "❌ Impossible de modifier la description." }, { quoted: msg });
  }
}
