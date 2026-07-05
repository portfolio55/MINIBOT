export const name = "removeall2";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const bare = (jid) => String(jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

export async function execute(sock, msg, args, from) {
  if (!from.endsWith("@g.us")) {
    return await sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." });
  }
  try {
    const meta = await sock.groupMetadata(from);
    const botBares = [bare(sock.user?.id), bare(sock.user?.lid)].filter(Boolean);
    const toRemove = meta.participants.filter(p => !botBares.includes(bare(p.id)));
    if (toRemove.length === 0) {
      return await sock.sendMessage(from, { text: "❌ Aucun membre à retirer." });
    }
    const botParticipant = meta.participants.find(p => botBares.includes(bare(p.id)));
    const botIsAdmin = !!(botParticipant && (botParticipant.admin === "admin" || botParticipant.admin === "superadmin" || botParticipant.admin));
    if (!botIsAdmin) {
      try {
        const adminList = meta.participants.filter(p => p.admin).map(p => ({ id: p.id, admin: p.admin }));
        console.log("[removeall2] bot not admin?", { botBares, botId: sock.user?.id, botLid: sock.user?.lid, found: botParticipant, admins: adminList.slice(0, 15) });
      } catch {}
      return await sock.sendMessage(from, { text: "❌ Le bot doit être admin." });
    }
    for (const p of toRemove) {
      try {
        await sock.groupParticipantsUpdate(from, [p.id], "remove");
        await sleep(1500);
      } catch (e) {
        console.warn("remove:", e?.message);
      }
    }
    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
  } catch (e) {
    console.error("Erreur removeall2:", e);
    await sock.sendMessage(from, { text: "❌ Erreur lors du retrait." });
  }
}
