import dotenv from "dotenv";
dotenv.config();

export const name = "demoteall";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  // Vérifie si la commande est utilisée dans un groupe
  if (!from.endsWith("@g.us")) {
    return await sock.sendMessage(from, {
      text: "⚡ *Commande réservée aux groupes seulement.*"
    });
  }

  try {
    const groupMetadata = await sock.groupMetadata(from);
    const participants = groupMetadata.participants || [];

    // --- Identifiants essentiels ---
    const botJid =
      (sock?.user?.id?.split?.(":")?.[0] || sock?.user?.jid?.split?.(":")?.[0] || "") +
      "@s.whatsapp.net";

    const OWNER_NUMBER = process.env.NUMBER?.replace(/\D/g, ""); // nettoie le numéro
    const OWNER_JID = OWNER_NUMBER ? `${OWNER_NUMBER}@s.whatsapp.net` : null;

    const sender = msg.key.participant || msg.participant || from;

    // Vérification .env
    if (!OWNER_JID) {
      console.error("⚡ Le numéro du propriétaire (NUMBER) n'est pas défini dans .env !");
      return await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY: ?? Le numéro du propriétaire n'est pas configuré."
      });
    }

    // --- Fonction utilitaire pour détecter les admins ---
    const isAdmin = p => {
      const adminFlag = p?.admin || p?.isAdmin || p?.isSuperAdmin;
      return adminFlag === true || adminFlag === "admin" || adminFlag === "superadmin";
    };

    // --- Liste des admins é rétrograder (exclure bot, owner, auteur) ---
    const toDemote = participants
      .filter(p => {
        const jid = p?.id || p?.jid || p?.participant;
        if (!jid) return false;
        return isAdmin(p) && jid !== botJid && jid !== OWNER_JID && jid !== sender;
      })
      .map(p => p.id);

    if (toDemote.length === 0) {
      return await sock.sendMessage(from, {
        text: "> SIGMA MDX DEPLOY: ? Aucun admin é rétrograder"
      });
    }

    // --- Exécution du demote ---
    await sock.groupParticipantsUpdate(from, toDemote, "demote");

    // --- Confirmation ---
    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

  } catch (err) {
    console.error("? Erreur demoteall :", err);
    await sock.sendMessage(from, {
      text: "? *Erreur lors de l'exécution de demoteall.* Vérifie mes permissions ou réessaye."
    });
  }
}
