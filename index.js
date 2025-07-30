const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Crear cliente
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

// === Mostrar QR por consola
client.on('qr', qr => {
  console.log('🔁 Escanea el siguiente código QR:');
  qrcode.generate(qr, { small: true });
});

// === Logs
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

// === Iniciar cliente
client.initialize();
