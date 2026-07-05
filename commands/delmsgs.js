export const name = "delmsgs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function bareNumber(jid) {
  return String(jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
}

export async function execute(sock, msg, args, from, botContext) {
  if (!from.endsWith("@g.us")) {
    return await sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." });
  }

  try {
    const meta = await sock.groupMetadata(from);
    const botBares = [bareNumber(sock.user?.id), bareNumber(sock.user?.lid)].filter(Boolean);
    const botParticipant = meta.participants.find((p) => botBares.includes(bareNumber(p.id)));
    const botIsAdmin = !!(botParticipant && (botParticipant.admin === "admin" || botParticipant.admin === "superadmin" || botParticipant.admin));

    if (!botIsAdmin) {
      try {
        const adminList = meta.participants.filter((p) => p.admin).map((p) => ({ id: p.id, admin: p.admin }));
        console.log("[delmsgs] bot not admin?", { botBares, botId: sock.user?.id, botLid: sock.user?.lid, found: botParticipant, admins: adminList.slice(0, 15) });
      } catch {}
      return await sock.sendMessage(from, { text: "❌ Le bot doit être admin du groupe pour supprimer les messages d'un autre membre." });
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const repliedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const target = (mentioned && mentioned.length > 0) ? mentioned[0] : repliedParticipant;

    if (!target) {
      return await sock.sendMessage(from, { text: "❌ Mentionne ou réponds à un message de la personne dont tu veux supprimer les messages." });
    }

    if (!botContext?.getUserMessageIds) {
      return await sock.sendMessage(from, { text: "❌ Fonctionnalité indisponible pour le moment." });
    }

    const ids = botContext.getUserMessageIds(from, target);

    if (!ids || ids.length === 0) {
      return await sock.sendMessage(from, {
        text: "❌ Aucun message récent de ce membre n'est en mémoire.\nSeuls les messages reçus depuis que le bot est en ligne (max 48h) peuvent être supprimés — impossible de supprimer un historique antérieur."
      });
    }

    for (const id of ids) {
      try {
        await sock.sendMessage(from, {
          delete: { remoteJid: from, fromMe: false, id, participant: target }
        });
      } catch (e) {
        // ignore les échecs individuels (message déjà supprimé, trop ancien, etc.)
      }
      await sleep(800);
    }

    botContext.clearUserMessages(from, target);

    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
  } catch (err) {
    console.error("Erreur delmsgs :", err);
    await sock.sendMessage(from, { text: "❌ Erreur lors de la suppression des messages." });
  }
}
