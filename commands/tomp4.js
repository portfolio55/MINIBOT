import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { writeFile, existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export const name = 'tomp4';
export const aliases = ['tovideo', 'mp4'];
export const description = 'Convert WebP sticker to MP4 video';
export const category = 'Media';

export async function execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    
    // Vérifier s'il y a un message cité
    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
    if (!quotedContext?.quotedMessage) {
        return await sock.sendMessage(from, {
            text: '? *SIGMA MDX DEPLOY*: Please reply to a sticker with this command.'
        }, { quoted: msg });
    }

    // Vérifier si c'est un sticker WebP
    const mimetype = quotedContext.quotedMessage?.stickerMessage?.mimetype;
    if (mimetype !== 'image/webp') {
        return await sock.sendMessage(from, {
            text: '? *SIGMA MDX DEPLOY*: The replied message is not a WebP sticker.'
        }, { quoted: msg });
    }

    try {
        // Message d'attente
        const sentMsg = await sock.sendMessage(from, {
            text: '⚡ *SIGMA MDX DEPLOY* - Converting sticker to MP4...'
        }, { quoted: msg });

        // --- PARTIE CRITIQUE : RECONSTRUCTION DE L'OBJET MESSAGE ---
        // Créer l'objet message complet attendu par downloadMediaMessage
        const quotedMessageForDownload = {
            key: {
                remoteJid: from,
                id: quotedContext.stanzaId,
                participant: quotedContext.participant,
                fromMe: false
            },
            message: quotedContext.quotedMessage
        };
        // -----------------------------------------------------------

        // Context pour le re-upload si nécessaire
        const downloadContext = {
            reuploadRequest: sock.updateMediaMessage
        };

        // Télécharger le média
        const buffer = await downloadMediaMessage(
            quotedMessageForDownload, // Objet message complet
            'buffer',
            {},
            downloadContext
        );

        if (!buffer || buffer.length === 0) {
            throw new Error('Failed to download sticker (empty buffer).');
        }

        // Sauvegarder temporairement
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const tempWebpPath = join(__dirname, `temp_sticker_${Date.now()}.webp`);
        await writeFile(tempWebpPath, buffer);

        // ?? PLACEHOLDER POUR LA CONVERSION
        // Vous devez implémenter la logique de conversion ici
        console.log(`Sticker saved to: ${tempWebpPath}`);
        console.log('Conversion logic needs to be implemented!');

        // Message temporaire (à remplacer par l'envoi de la vidéo)
        await sock.sendMessage(from, {
            text: `? *SIGMA MDX DEPLOY*: Sticker downloaded successfully (${(buffer.length / 1024).toFixed(1)} KB).\n🎬 Video conversion is not yet implemented.`
        }, { quoted: sentMsg });

        // Nettoyer le fichier temporaire
        if (existsSync(tempWebpPath)) {
            unlinkSync(tempWebpPath);
            console.log(`Temporary file cleaned: ${tempWebpPath}`);
        }

    } catch (err) {
        console.error('? Tomp4 command error:', err);
        
        let errorMessage = '? *SIGMA MDX DEPLOY*: ';
        if (err.message.includes('No message present') || err.message.includes('must be defined')) {
            errorMessage += 'Could not process the quoted message structure.';
        } else if (err.message.includes('Failed to download')) {
            errorMessage += 'Failed to download media from the sticker.';
        } else {
            errorMessage += `Unexpected error: ${err.message}`;
        }

        await sock.sendMessage(from, {
            text: errorMessage
        }, { quoted: msg });
    }
}