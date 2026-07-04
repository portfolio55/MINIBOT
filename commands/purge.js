export const name = "purge";

export async function execute(sock, msg, args, options = {}) {
  const from = msg?.key?.remoteJid;
  const ownerNumber = (process.env.OWNER_NUMBER || "").replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // ----- Réservé aux groupes -----
  if (!from || !from.endsWith("@g.us")) {
    await sock.sendMessage(from || msg.key.remoteJid, { text: "> SIGMA MDX DEPLOY : Commande de groupe" }, { quoted: msg });
    return;
  }

  try {
    const groupData = await sock.groupMetadata(from);
    const participants = groupData.participants || [];
    const botJid = (sock?.user?.id || sock?.user?.jid || "").split?.(":")?.[0] || "";
    const allMembers = participants.map(p => p.id);

    // ----- Membres à expulser : non-admin, ? bot, ? owner -----
    const toKick = participants
      .filter(p => !p.admin)
      .map(p => p.id)
      .filter(id => id !== botJid && id !== ownerNumber);

    if (toKick.length === 0) {
      await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Aucun membre non-admin à expulser." }, { quoted: msg });
      return;
    }

    // ----- COMPTE é REBOURS 3s (propre, sans contour) -----
    const cdMsg = await sock.sendMessage(from, { text: "3... ⚡" });
    await new Promise(r => setTimeout(r, 1000));
    await sock.sendMessage(from, { text: "2...?? ⚡", edit: cdMsg.key });
    await new Promise(r => setTimeout(r, 1000));
    await sock.sendMessage(from, { text: "1... ⚡", edit: cdMsg.key });
    await new Promise(r => setTimeout(r, 1000));
    await sock.sendMessage(from, { text: "⚡ 🎨?PURGE.? ⚡", edit: cdMsg.key });

    // ----- TEXTE DRAMATIQUE + IMAGE + HIDETAG -----
    const purgeText = `> +----- PURGE -----+
Le Purificateur\n\n` +
      `Je ne vois pas ce que vous appelez éfolieé.\n` +
      `Ce monde empeste la décadence é je ne fais que respirer ce que vous avez créé.\n\n` +
      `Et quand on voit la maladie, on doit agir.\n\n` +
      `Je ne suis pas un monstre. Je suis une nécessité.\n` +
      `La lame n'est pas cruelle : elle sépare. Elle choisit. Elle purifie.\n` +
      `Les cris ? Ce ne sont que les priéres de ceux qui comprennent trop tard.\n\n` +
      `Jéai accepté ce que les autres refusent : la mission.\n` +
      `Rendre au monde un visage net. Sans taches. Sans parasites.\n\n` +
      `Je ne tue pas.\n` +
      `Jéefface.\n\n` +
      `> +-----------------+
> By SIGMA MDX`;

    await sock.sendMessage(from, {
      image: { url: "https://files.catbox.moe/2g94h4.jpg" },
      caption: purgeText,
      mentions: allMembers
    });

    // ----- EXPULSION EN UNE FOIS -----
    await sock.groupParticipantsUpdate(from, toKick, "remove");

    // ----- RAPPORT FINAL + HIDETAG -----
    await sock.sendMessage(from, {
      text: `> SIGMA MDX MD: *Purge exécutée : ${toKick.length} membre(s) expulsé(s).*\nAdmin et owner protégés`,
      mentions: allMembers
    });

  } catch (err) {
    console.error("Erreur purge :", err);
    await sock.sendMessage(from, { text: "*Erreur lors de la purge.* Vérifie mes permissions." }, { quoted: msg });
  }
}