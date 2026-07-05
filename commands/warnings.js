import { createGroupManager } from "../groupManager.js";

export const name = "warnings";
const MAX_WARNS = 3;

export async function execute(sock, msg, args, from, botContext) {
  try {
    const gm = botContext?.groupManager || createGroupManager(botContext?.sessionPath);

    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, { text: "Cette commande est réservée aux groupes." });
      return;
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const repliedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const sender = msg.key.participant || from;
    const target = (mentioned && mentioned.length > 0) ? mentioned[0] : (repliedParticipant || sender);

    const count = gm.getWarnCount(from, target);
    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY: @${target.split("@")[0]} a ${count}/${MAX_WARNS} avertissement(s).`,
      mentions: [target]
    });
  } catch (err) {
    console.error("Erreur warnings:", err);
    await sock.sendMessage(from, { text: "Une erreur est survenue." });
  }
}
