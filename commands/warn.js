import { createGroupManager } from "../groupManager.js";
import { getSudoList, getOwners } from "../src/utils/cmdUtils.js";

export const name = "warn";
const MAX_WARNS = 3;

export async function execute(sock, msg, args, from, botContext) {
  try {
    const gm = botContext?.groupManager || createGroupManager(botContext?.sessionPath);

    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, { text: "Cette commande est réservée aux groupes." });
      return;
    }

    const sender = msg.key.participant || from;
    const senderNum = sender.split("@")[0].replace(/[^0-9]/g, "");
    const owners = getOwners(botContext).map(n => n.replace(/[^0-9]/g, ""));
    const sudoList = getSudoList(botContext).map(n => n.replace(/[^0-9]/g, ""));
    const isOwner = owners.includes(senderNum);
    const isSudo = sudoList.includes(senderNum);
    const isAdmin = await isGroupAdmin(sock, from, sender);

    if (!isOwner && !isSudo && !isAdmin) {
      await sock.sendMessage(from, { text: "Accès refusé. Admin, owner ou sudo requis." });
      return;
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const repliedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const target = (mentioned && mentioned.length > 0) ? mentioned[0] : repliedParticipant;

    if (!target) {
      await sock.sendMessage(from, { text: "❌ Mentionne ou réponds au message de la personne à avertir." });
      return;
    }

    const reason = args.join(" ").trim();
    const count = gm.addWarn(from, target);

    if (count >= MAX_WARNS) {
      const meta = await sock.groupMetadata(from);
      const botBare = (sock.user?.id || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
      const botLid = (sock.user?.lid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
      const botParticipant = meta.participants.find(p => {
        const bare = (p.id || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
        return bare === botBare || (botLid && bare === botLid);
      });
      const botIsAdmin = !!(botParticipant && botParticipant.admin);

      if (botIsAdmin) {
        await sock.groupParticipantsUpdate(from, [target], "remove");
        gm.resetWarn(from, target);
        await sock.sendMessage(from, {
          text: `> SIGMA MDX DEPLOY: ⛔ @${target.split("@")[0]} a atteint ${MAX_WARNS} avertissements et a été expulsé.`,
          mentions: [target]
        });
        return;
      }

      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY: ⚠️ @${target.split("@")[0]} a atteint ${MAX_WARNS} avertissements, mais le bot n'est pas admin pour l'expulser.`,
        mentions: [target]
      });
      return;
    }

    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY: ⚠️ Avertissement ${count}/${MAX_WARNS} pour @${target.split("@")[0]}${reason ? `\nRaison : ${reason}` : ""}`,
      mentions: [target]
    });
  } catch (err) {
    console.error("Erreur warn:", err);
    await sock.sendMessage(from, { text: "Une erreur est survenue." });
  }
}

async function isGroupAdmin(sock, groupJid, userJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    return metadata.participants.some(p => p.id === userJid && p.admin);
  } catch {
    return false;
  }
}
