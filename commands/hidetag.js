export const name = "hidetag";

export async function execute(sock, msg, args, from) {
  if (!from.endsWith("@g.us")) {
    return await sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." }, { quoted: msg });
  }
  const text = args.join(" ").trim();
  if (!text) {
    return await sock.sendMessage(from, { text: "❌ Ajoute un message.\nExemple : !hidetag Bonjour à tous" }, { quoted: msg });
  }
  try {
    const meta = await sock.groupMetadata(from);
    const sender = msg.key.participant || from;
    const isAdmin = meta.participants.find(p => p.id === sender)?.admin;
    if (!isAdmin) {
      return await sock.sendMessage(from, { text: "❌ Seuls les admins peuvent utiliser hidetag." }, { quoted: msg });
    }
    const mentions = meta.participants.map(p => p.id);
    await sock.sendMessage(from, { text, mentions }, { quoted: msg });
  } catch (e) {
    console.error("Erreur hidetag:", e);
    await sock.sendMessage(from, { text: "❌ Erreur." }, { quoted: msg });
  }
}
