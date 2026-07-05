import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';

export const name = 'tomp4';
export const aliases = ['tovideo', 'mp4'];
export const description = 'Convertit un sticker WebP animé en vidéo MP4';
export const category = 'Media';

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;
  const tempFiles = [];

  const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
  if (!quotedContext?.quotedMessage) {
    return await sock.sendMessage(from, {
      text: '> SIGMA MDX DEPLOY : ⚠️ Réponds à un sticker avec `.tomp4`.'
    }, { quoted: msg });
  }

  const stickerMsg = quotedContext.quotedMessage?.stickerMessage;
  if (!stickerMsg || stickerMsg.mimetype !== 'image/webp') {
    return await sock.sendMessage(from, {
      text: '> SIGMA MDX DEPLOY : ⚠️ Le message cité n\'est pas un sticker WebP.'
    }, { quoted: msg });
  }

  const tempDir = path.join(process.cwd(), 'temp');
  fs.mkdirSync(tempDir, { recursive: true });

  const uid = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const inputPath = path.join(tempDir, `tomp4_in_${uid}.webp`);
  const outputPath = path.join(tempDir, `tomp4_out_${uid}.mp4`);
  tempFiles.push(inputPath, outputPath);

  try {
    await sock.sendMessage(from, {
      text: '⚡ SIGMA MDX DEPLOY : conversion du sticker en vidéo en cours...'
    }, { quoted: msg });

    const quotedMessageForDownload = {
      key: {
        remoteJid: from,
        id: quotedContext.stanzaId,
        participant: quotedContext.participant,
        fromMe: false
      },
      message: quotedContext.quotedMessage
    };

    let buffer;
    try {
      buffer = await downloadMediaMessage(
        quotedMessageForDownload,
        'buffer',
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );
    } catch (dlErr) {
      throw new Error(`Échec du téléchargement du sticker (${dlErr.message}).`);
    }

    if (!buffer || buffer.length === 0) {
      throw new Error('Échec du téléchargement du sticker (buffer vide).');
    }

    fs.writeFileSync(inputPath, buffer);

    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -y -i "${inputPath}" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${outputPath}"`,
        { timeout: 30000 },
        (err, _stdout, stderr) => {
          if (err) return reject(new Error(stderr?.slice(0, 300) || err.message));
          resolve();
        }
      );
    });

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new Error('Le sticker est statique (non animé) ou la conversion a échoué.');
    }

    await sock.sendMessage(from, {
      video: fs.readFileSync(outputPath),
      mimetype: 'video/mp4',
      caption: '> SIGMA MDX DEPLOY : ✅ Sticker converti en vidéo.'
    }, { quoted: msg });
  } catch (err) {
    console.error('❌ Erreur tomp4 :', err);
    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY : ❌ ${err.message}`
    }, { quoted: msg });
  } finally {
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignorer les erreurs de nettoyage
      }
    }
  }
}
