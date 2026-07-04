export const name = "removeadmins";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const bare = (jid) => String(jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

export async function execute(sock, msg, args, from) {
  if (!from.endsWith("@g.us")) {
    return await sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." }, { quoted: msg });
  }
  try {
    const meta = await sock.groupMetadata(from);
    const botBares = [bare(sock.user?.id), bare(sock.user?.lid)].filter(Boolean);
    const adminsToRemove = meta.participants.filter(
      p => p.admin && !botBares.includes(bare(p.id))
    );
    if (adminsToRemove.length === 0) {
      return await sock.sendMessage(from, { text: "❌ Aucun admin à retirer (hormis le bot)." }, { quoted: msg });
    }
    const botParticipant = meta.participants.find(p => botBares.includes(bare(p.id)));
    const botIsAdmin = !!(botParticipant && (botParticipant.admin === "admin" || botParticipant.admin === "superadmin" || botParticipant.admin));
    if (!botIsAdmin) {
      try {
        const adminList = meta.participants.filter(p => p.admin).map(p => ({ id: p.id, admin: p.admin }));
        console.log("[removeadmins] bot not admin?", { botBares, botId: sock.user?.id, botLid: sock.user?.lid, found: botParticipant, admins: adminList.slice(0, 15) });
      } catch {}
      return await sock.sendMessage(from, { text: "❌ Le bot doit être admin." }, { quoted: msg });
    }
    await sock.sendMessage(from, { text: `⏳ Retrait de ${adminsToRemove.length} admin(s)...` }, { quoted: msg });
    for (const p of adminsToRemove) {
      try {
        await sock.groupParticipantsUpdate(from, [p.id], "remove");
        await sleep(1500);
      } catch (e) {
        console.warn("remove:", e?.message);
      }
    }
    await sock.sendMessage(from, { text: "✅ Tous les admins ont été retirés." }, { quoted: msg });
  } catch (e) {
    console.error("Erreur removeadmins:", e);
    await sock.sendMessage(from, { text: "❌ Erreur lors du retrait." }, { quoted: msg });
  }
}
