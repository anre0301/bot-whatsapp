const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const QRCode = require('qrcode');
const app = express();
const port = process.env.PORT || 3000;

let qrCodeData = '';

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'bot_julio' }),
    puppeteer: { headless: true, args: ['--no-sandbox'] }
});

client.on('qr', qr => {
    console.log(`🔁 Escanea el QR en: http://localhost:${port}`);
    qrCodeData = qr;
});

client.on('ready', () => console.log('✅ Bot conectado correctamente'));
client.on('authenticated', () => console.log('🔐 Sesión autenticada.'));
client.on('auth_failure', msg => console.error('❌ Falló la autenticación:', msg));
client.on('disconnected', reason => console.log('🔌 Cliente desconectado:', reason));

// === COMANDOS
client.on('message_create', async msg => {
    const chat = await msg.getChat();

    if (msg.body.toLowerCase() === '/start') {
        return msg.reply('✅ ACTIVO en este chat');
    }

    if (msg.body.toLowerCase() === '/reglas') {
        if (chat.isGroup) {
            const description = chat.description || '📭 Este grupo no tiene una descripción configurada.';
            return chat.sendMessage(`📜 *Reglas del grupo ${chat.name}:*\n\n${description}`);
        } else {
            return msg.reply('❌ Este comando solo se puede usar en grupos.');
        }
    }

    if (msg.body === '/exit' && msg.from.endsWith('@g.us')) {
        const sender = await msg.getContact();
        const participants = await chat.participants;
        const isAdmin = participants.find(p => p.id._serialized === sender.id._serialized && p.isAdmin);
        if (isAdmin) {
            await msg.reply('👋 Apagando el bot en este grupo...');
            process.exit();
        } else {
            return msg.reply('❌ Solo los administradores pueden apagar el bot.');
        }
    }

    // BAN
    if (msg.body.toLowerCase() === '/ban' && msg.hasQuotedMsg && chat.isGroup) {
        try {
            const quoted = await msg.getQuotedMessage();
            const userToBan = quoted.author || quoted.from;
            if (!userToBan) return msg.reply("❌ No se pudo identificar al usuario.");
            if (userToBan === msg.from) return msg.reply("🚫 No puedes banearte a ti mismo.");

            await chat.removeParticipants([userToBan.toString()]);
            return msg.reply('✅ Usuario eliminado del grupo.');
        } catch (err) {
            console.error('❌ Error al expulsar:', err);
            return msg.reply('❌ No se pudo expulsar al usuario. ¿Es el bot admin?');
        }
    }
});

// === ANTI LINKS
client.on('message', async msg => {
    try {
        const chat = await msg.getChat();
        if (!chat.isGroup) return;

        const linkDetected = msg.body.includes('https://') || msg.body.includes('http://');
        if (linkDetected) {
            const author = msg.author || msg.from;
            const isBotAdmin = chat.participants.some(p =>
                p.id._serialized === client.info.wid._serialized && p.isAdmin
            );

            if (isBotAdmin && author) {
                await chat.removeParticipants([author]);
                const contact = await client.getContactById(author);
                await chat.sendMessage(`🚫 @${author.split('@')[0]} fue expulsado por enviar enlaces.`, {
                    mentions: [contact]
                });
            }
        }
    } catch (err) {
        console.error('❌ Error al expulsar por enlace:', err);
    }
});

// === RUTA QR
app.get('/', (req, res) => {
    if (!qrCodeData) return res.send('⏳ QR no generado aún. Espera unos segundos...');
    QRCode.toDataURL(qrCodeData, (err, url) => {
        if (err) return res.send('❌ Error al generar el QR');
        res.send(`
            <h2>📲 Escanea este código QR con tu WhatsApp</h2>
            <img src="${url}" />
            <p>Actualiza la página si no carga bien.</p>
        `);
    });
});

// === RUTA STATUS
app.get('/status', (req, res) => {
    res.send('✅ Bot activo');
});

app.listen(port, () => {
    console.log(`🌐 Abre en tu navegador: http://localhost:${port}`);
});

client.initialize();
