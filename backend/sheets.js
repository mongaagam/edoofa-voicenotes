const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Local databases paths
const dbPath = path.join(__dirname, 'database.json');
const csvPath = path.join(__dirname, 'voice_notes.csv');

// Initialize local JSON DB if missing
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
}

// Initialize CSV header if missing
if (!fs.existsSync(csvPath)) {
  const headers = 'Date,Student Name,WhatsApp Group,Daily Voice Note #,Sender Type,Sender Name,Transcription,AI Summary,Action Items,Audio File,Sync Status\n';
  fs.writeFileSync(csvPath, headers);
}

/**
 * Appends a voice note record to the local JSON, CSV, and remote Google Sheets.
 * 
 * @param {Object} data - { studentName, groupName, senderType, senderName, transcript, summary, actionItems, audioFileName }
 * @returns {Promise<Object>} - The logged record with sequential voice note number
 */
const logVoiceNote = async (data) => {
  const { studentName, groupName, senderType, senderName, transcript, summary, actionItems, audioFileName } = data;
  
  // Format current date (YYYY-MM-DD)
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const fullTimestamp = now.toLocaleString();

  // Load existing database to calculate the daily sequential counter
  const dbContent = fs.readFileSync(dbPath, 'utf8');
  let records = [];
  try {
    records = JSON.parse(dbContent);
  } catch (e) {
    records = [];
  }

  // Count how many voice notes exist for THIS student on THIS date
  const todayStudentNotes = records.filter(
    (r) => r.studentName.toLowerCase() === studentName.toLowerCase() && r.date === dateStr
  );
  const vnNumber = todayStudentNotes.length + 1;

  // Formulate action items string
  const actionItemsStr = actionItems.join('; ');

  // Create new record
  const newRecord = {
    id: `vn_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: fullTimestamp,
    date: dateStr,
    studentName,
    groupName,
    vnNumber,
    senderType,
    senderName,
    transcript,
    summary,
    actionItems,
    audioFileName,
    syncStatus: 'Local Only'
  };

  // 1. Save to Local JSON DB
  records.push(newRecord);
  fs.writeFileSync(dbPath, JSON.stringify(records, null, 2));

  // 2. Save to Local CSV
  // Helper to escape CSV values
  const csvEscape = (val) => {
    if (val === null || val === undefined) return '';
    let stringVal = String(val);
    if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n') || stringVal.includes('\r')) {
      stringVal = stringVal.replace(/"/g, '""');
      return `"${stringVal}"`;
    }
    return stringVal;
  };

  const csvRow = [
    dateStr,
    studentName,
    groupName,
    `VN #${vnNumber}`,
    senderType,
    senderName,
    transcript,
    summary,
    actionItemsStr,
    audioFileName,
    'Local Only'
  ].map(csvEscape).join(',') + '\n';

  fs.appendFileSync(csvPath, csvRow);

  // 3. Sync to Google Sheets if configured
  const sheetSynced = await syncToGoogleSheets(newRecord);
  if (sheetSynced) {
    // Update local sync status
    newRecord.syncStatus = 'Synced';
    // Update in JSON DB
    const updatedRecords = records.map(r => r.id === newRecord.id ? { ...r, syncStatus: 'Synced' } : r);
    fs.writeFileSync(dbPath, JSON.stringify(updatedRecords, null, 2));
    
    // Note: Overwriting CSV to update status in deep prototype requires rewriting or leaving as is.
    // We will update the JSON database as the source of truth for the dashboard.
  }

  return newRecord;
};

/**
 * Handles syncing a record directly to a live Google Sheet.
 * Gracefully logs and skips if credentials are not present.
 * 
 * @param {Object} record - The Voice Note record object
 * @returns {Promise<boolean>} - True if successfully synced, false otherwise
 */
const syncToGoogleSheets = async (record) => {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId || !clientEmail || !privateKey) {
    console.log('SHEETS_ENGINE: Google Sheets integration credentials missing. Saved locally in CSV and dashboard database.');
    return false;
  }

  try {
    console.log(`SHEETS_ENGINE: Syncing Voice Note to Google Sheet (ID: ${spreadsheetId})...`);
    
    // Clean up private key formatting
    privateKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Structure of Google Sheets Row
    const rowValues = [
      record.date,
      record.studentName,
      record.groupName,
      `VN #${record.vnNumber}`,
      record.senderType,
      record.senderName,
      record.transcript,
      record.summary,
      record.actionItems.join('; '),
      `http://localhost:${process.env.PORT || 5002}/recordings/${record.audioFileName}`
    ];

    // Check if sheet headers need initialization (read first row)
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Sheet1!A1:J1',
      });
      
      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        // Sheet is completely empty, write headers first
        const headers = [
          'Date',
          'Student Name',
          'WhatsApp Group',
          'Daily Voice Note #',
          'Sender Type',
          'Sender Name',
          'AI Transcription',
          'AI Summary',
          'Action Items / Follow-ups',
          'Audio Link'
        ];
        
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Sheet1!A1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [headers]
          }
        });
        console.log('SHEETS_ENGINE: Initialized Google Sheet headers.');
      }
    } catch (headerErr) {
      console.warn('SHEETS_ENGINE: Could not check or initialize headers, attempting straight append...', headerErr.message);
    }

    // Append the new voice note row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:J',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowValues]
      }
    });

    console.log('SHEETS_ENGINE: Successfully appended row to Google Sheet!');
    return true;
  } catch (err) {
    console.error('SHEETS_ENGINE: Failed to sync with Google Sheets API:', err.message);
    return false;
  }
};

/**
 * Returns all logged voice notes.
 */
const getVoiceNotes = () => {
  if (!fs.existsSync(dbPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (e) {
    return [];
  }
};

/**
 * Triggers re-sync of all "Local Only" records to Google Sheet if credentials have been updated.
 */
const triggerBulkSync = async () => {
  console.log('SHEETS_ENGINE: Starting manual bulk sync for Local Only entries...');
  const notes = getVoiceNotes();
  const unsynced = notes.filter(n => n.syncStatus === 'Local Only');
  
  if (unsynced.length === 0) {
    console.log('SHEETS_ENGINE: No local-only notes need syncing.');
    return { success: true, message: 'All voice notes are already synced.' };
  }

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId || !clientEmail || !privateKey) {
    return { success: false, message: 'Google Sheet credentials are still missing in .env configuration.' };
  }

  let syncCount = 0;
  for (let note of unsynced) {
    const success = await syncToGoogleSheets(note);
    if (success) {
      note.syncStatus = 'Synced';
      syncCount++;
    }
  }

  // Save updated status back to JSON database
  if (syncCount > 0) {
    fs.writeFileSync(dbPath, JSON.stringify(notes, null, 2));
  }

  return {
    success: true,
    message: `Successfully synced ${syncCount} out of ${unsynced.length} pending voice notes to Google Sheets.`
  };
};

module.exports = {
  logVoiceNote,
  getVoiceNotes,
  triggerBulkSync
};
