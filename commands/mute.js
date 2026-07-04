export const name = "mute";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  // Vérifier si c'est un groupe
  if (!from.endsWith("@g.us")) {
    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Commande utilisée pour les groupes." }, { quoted: msg });
    return;
  }

  try {
    // Mettre le groupe en mode admin uniquement (fermé)
    await sock.groupSettingUpdate(from, "announcement"); // "announcement" = seuls les admins peuvent envoyer des messages
    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Groupe fermé!" }, { quoted: msg });
  } catch (err) {
    console.error("Erreur lors de la fermeture du groupe :", err);
    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Impossible de fermer le groupe. Assurez-vous que vous étes admin." }, { quoted: msg });
  }
}