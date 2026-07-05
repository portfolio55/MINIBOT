import { createGroupManager } from "../groupManager.js";

export const name = "listwords";

export async function execute(sock, msg, args, from, botContext) {
  try {
    const gm = botContext?.groupManager || createGroupManager(botContext?.sessionPath);

    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, { text: "Cette commande est réservée aux groupes." });
      return;
    }

    const words = gm.getBannedWords(from);
    if (!words || words.length === 0) {
      await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY: Aucun mot interdit configuré dans ce groupe." });
      return;
    }

    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY: Mots interdits (${words.length})\n\n${words.map((w, i) => `${i + 1}. ${w}`).join("\n")}`
    });
  } catch (err) {
    console.error("Erreur listwords:", err);
    await sock.sendMessage(from, { text: "Une erreur est survenue." });
  }
}
