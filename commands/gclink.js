export const name = "gclink";

export async function execute(sock, msg, args) {
  try {
    const from = msg.key.remoteJid;

    // Vérifie que c'est bien un groupe
    if (!from.endsWith("@g.us")) {
      return await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY: Commande pour groupe " });
    }

    // Récupère le lien d'invitation
    const groupInviteCode = await sock.groupInviteCode(from);
    const inviteLink = `https://chat.whatsapp.com/${groupInviteCode}`;

    await sock.sendMessage(from, { text: `> SIGMA MDX DEPLOY: 🔗 Lien du groupe :\n${inviteLink}` });

  } catch (err) {
    console.error("? Erreur link :", err);
    await sock.sendMessage(msg.key.remoteJid, { text: "> SIGMA MDX DEPLOY: ❌ Erreur lors de la récupération du lien." });
  }
}