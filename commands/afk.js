export const name = "afk";

export async function execute(sock, msg, args, from, botContext) {
  try {
    const sender = msg.key.participant || from;
    const reason = args.join(" ").trim();

    if (!botContext?.protectionManager) {
      await sock.sendMessage(from, { text: "❌ Fonctionnalité indisponible pour le moment." });
      return;
    }

    if (!botContext.protectionManager._afkMap) {
      botContext.protectionManager._afkMap = new Map();
    }

    botContext.protectionManager._afkMap.set(sender, {
      reason: reason || null,
      since: Date.now()
    });

    await sock.sendMessage(from, { react: { text: "💤", key: msg.key } });
  } catch (err) {
    console.error("Erreur afk:", err);
    await sock.sendMessage(from, { text: "Une erreur est survenue." });
  }
}
