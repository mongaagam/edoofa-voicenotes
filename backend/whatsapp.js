const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { processVoiceNote } = require('./ai');
const { logVoiceNote } = require('./sheets');

// Global state
let clientStatus = 'DISCONNECTED';
let lastQr = null;
let broadcastCallback = null;

// Ensure audio directory exists for local player fallback
const recordingsDir = path.join(__dirname, 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'edoofa',
    dataPath: path.join(__dirname, '.wwebjs_auth')
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-web-security'
    ]
  }
});

// Setup event listeners
client.on('qr', (qr) => {
  clientStatus = 'SCANNING_REQUIRED';
  lastQr = qr;
  console.log('==================================================================');
  console.log('WHATSAPP: Scan the QR code below to authenticate the session:');
  console.log('==================================================================');
  qrcode.generate(qr, { small: true });
  
  if (broadcastCallback) {
    broadcastCallback({ type: 'STATUS_UPDATE', status: clientStatus, qr });
  }
});

client.on('authenticated', () => {
  clientStatus = 'AUTHENTICATING';
  lastQr = null;
  console.log('WHATSAPP: Session authenticated successfully!');
  if (broadcastCallback) {
    broadcastCallback({ type: 'STATUS_UPDATE', status: clientStatus });
  }
});

client.on('ready', () => {
  clientStatus = 'CONNECTED';
  lastQr = null;
  console.log('WHATSAPP: Client is ready and listening for voice notes!');
  if (broadcastCallback) {
    broadcastCallback({ type: 'STATUS_UPDATE', status: clientStatus });
  }
});

client.on('auth_failure', (msg) => {
  clientStatus = 'AUTH_FAILURE';
  console.error('WHATSAPP: Authentication failure:', msg);
  if (broadcastCallback) {
    broadcastCallback({ type: 'STATUS_UPDATE', status: clientStatus, error: msg });
  }
});

client.on('disconnected', (reason) => {
  clientStatus = 'DISCONNECTED';
  console.log('WHATSAPP: Client was disconnected:', reason);
  if (broadcastCallback) {
    broadcastCallback({ type: 'STATUS_UPDATE', status: clientStatus });
  }
  // Try to re-initialize after a short delay
  setTimeout(() => {
    client.initialize().catch(err => console.error('Error re-initializing WhatsApp client:', err));
  }, 5000);
});

// Listen for incoming/outgoing messages
client.on('message_create', async (msg) => {
  try {
    // Only capture voice notes or audio messages
    const isVoice = msg.type === 'voice' || msg.type === 'audio' || msg.type === 'ptt';
    if (!isVoice) return;

    console.log(`\n--- NEW WHATSAPP VOICE NOTE DETECTED ---`);
    console.log(`Sender ID: ${msg.from}`);
    console.log(`Is Outgoing (Edoofa Team): ${msg.fromMe}`);

    // Fetch contact details for naming
    const contact = await msg.getContact();
    const chat = await msg.getChat();
    
    const senderName = contact.pushname || contact.name || msg.from.split('@')[0];
    const groupName = chat.name || 'Individual Chat';
    
    // Extract Student Name from Group format: "Edoofa - Student Name" or "Student Name - Edoofa" or defaults
    let studentName = groupName;
    if (chat.isGroup) {
      // Robust cleaning of group name to extract student name
      studentName = groupName
        .replace(/edoofa/gi, '')
        .replace(/team/gi, '')
        .replace(/group/gi, '')
        .replace(/[-|:+]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!studentName || studentName.length < 2) {
        studentName = groupName;
      }
    } else {
      // For direct messages, the student name is the contact's name
      studentName = senderName;
    }

    console.log(`Mapped Student: ${studentName}`);
    console.log(`WhatsApp Group: ${groupName}`);

    // Download Voice Note Audio File
    let base64Audio = null;
    let localPath = null;
    let filename = `vn_${Date.now()}.ogg`;
    
    try {
      console.log('Downloading audio media...');
      const media = await msg.downloadMedia();
      if (media && media.data) {
        base64Audio = media.data;
        localPath = path.join(recordingsDir, filename);
        fs.writeFileSync(localPath, Buffer.from(media.data, 'base64'));
        console.log(`Audio successfully downloaded and saved to: ${localPath}`);
      } else {
        console.warn('Failed to download media. Empty payload received.');
      }
    } catch (downloadErr) {
      console.error('Error downloading media from WhatsApp:', downloadErr.message);
    }

    // Determine Sender Type (Student/Parent vs Edoofa Team)
    const senderType = msg.fromMe ? 'Edoofa Team' : 'Student/Parent';

    // Broadcast "processing" status to UI
    if (broadcastCallback) {
      broadcastCallback({
        type: 'PROCESSING_START',
        data: {
          timestamp: new Date().toISOString(),
          studentName,
          groupName,
          senderType,
          senderName,
          filename
        }
      });
    }

    // Process transcription and AI summary
    const { transcript, summary, actionItems } = await processVoiceNote(base64Audio, localPath);

    // Save into Sheets / CSV database
    const loggedRecord = await logVoiceNote({
      studentName,
      groupName,
      senderType,
      senderName,
      transcript,
      summary,
      actionItems,
      audioFileName: filename,
      audioData: base64Audio
    });

    console.log(`Voice Note successfully captured and logged as VN #${loggedRecord.vnNumber}!`);

    // Broadcast success to UI
    if (broadcastCallback) {
      broadcastCallback({
        type: 'VOICE_NOTE_PROCESSED',
        data: loggedRecord
      });
    }

  } catch (error) {
    console.error('Error processing WhatsApp message create event:', error);
  }
});

// Start the client
const startWhatsApp = (onBroadcast) => {
  broadcastCallback = onBroadcast;
  console.log('WHATSAPP: Initializing client...');
  client.initialize().catch(err => {
    console.error('Failed to initialize WhatsApp client:', err);
    clientStatus = 'INITIALIZATION_FAILED';
    if (broadcastCallback) {
      broadcastCallback({ type: 'STATUS_UPDATE', status: clientStatus, error: err.message });
    }
  });
};

const getStatus = () => {
  return {
    status: clientStatus,
    qr: lastQr
  };
};

module.exports = {
  startWhatsApp,
  getStatus,
  client
};
