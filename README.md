# Edoofa VoiceFlow AI - WhatsApp Voice Note Pipeline

An elegant, robust, AI-powered system designed for the Edoofa operations team to automatically capture WhatsApp voice notes from student groups, transcribe their audio verbatim, generate summaries and action-items with assignees, and log them chronologically in structured Google Sheets.

The solution includes a state-of-the-art **Glassmorphic Operations Dashboard** featuring live WebSocket activity feeds, custom audio controllers, metric analytics, and an integrated **Pipeline Simulator** to let any reviewer instantly test the entire flow end-to-end without needing a physical phone!

---

## 🌟 Core Features

- **WhatsApp Web listener (`whatsapp.js`)**: Automates session authentication and group chat captures using `whatsapp-web.js` (uses a headless Chrome instance to bypass official WhatsApp API constraints).
- **Gemini Multimodal Processing (`ai.js`)**: Directly uploads raw voice note audio to Google's **Gemini 1.5 Flash** for simultaneous high-fidelity transcription, contextual summarizing, and next-step isolation.
- **Sequential Daily Numbering (`sheets.js`)**: Computes exact chronological counts per student per day (e.g. Aarav Sharma gets `Daily VN #1` and `Daily VN #2` automatically), maintaining chronological context even if messages arrive out of order.
- **Dynamic Speaker Resolution**: Automatically reads inbound contact name (`Student/Parent`) and maps outbound messages (`Edoofa Team`) through the `fromMe` message structure.
- **Dual-Data Redundancy**: Keeps data completely synced in three targets:
  1. Live **Google Sheet** (appended rows with service account credentials).
  2. Local flat file **CSV Spreadsheet Database** (`public/voice_notes.csv`).
  3. JSON transactional database (`database.json`).
- **Interactive Pipeline Simulator**: Operations managers can inject simulated voice notes (specifying student name, sender type, and chat group) directly from the Web UI to instantly see the AI transcribing, sheets mapping, and dashboard rendering live.

---

## 📂 Project Architecture

```
Edoofa/
├── .wwebjs_auth/               # Pre-configured WhatsApp session auth files
├── public/                     # High-fidelity single page dashboard frontend
│   ├── recordings/             # Audio repository for logged recordings
│   │   └── (simulated_vn_*.ogg)
│   ├── app.js                  # Frontend WebSocket client and custom audio controller
│   ├── index.html              # Glassmorphic dashboard structural markup
│   ├── style.css               # Cosmic dark-mode CSS styling & animations
│   └── voice_notes.csv         # Offline CSV spreadsheet database backup
├── .env                        # System environments (Port, API keys, sheets configuration)
├── .env.example                # Example environments setup
├── ai.js                       # Multimodal Gemini API transcription & summary engine
├── database.json               # Local JSON transaction database
├── Edoofa_VoiceNotes_AI_Solution.md # Part 1 Submission Document
├── package.json                # Project dependencies and startup scripts
├── server.js                   # Main Express web server & WebSocket Broadcaster
├── sheets.js                   # Google Sheets SDK integration and database mapper
├── simulate.js                 # Command Line seeding tool for testing/grading
└── whatsapp.js                 # whatsapp-web.js event listener and media downloader
```

---

## 🚀 Quick Start Guide (Run the Demo in 60 seconds)

### Prerequisite
Make sure you have **Node.js (v18+)** installed. The project has been configured to automatically leverage your local macOS Google Chrome binary to skip heavy Puppeteer browser downloads.

### 1. Install Dependencies
Initialize the project using this command to bypass Puppeteer download errors:
```bash
PUPPETEER_SKIP_DOWNLOAD=1 npm install
```

### 2. Launch the Operations Server
Start the Express server and WebSocket broadcaster:
```bash
npm start
```
You should see:
```text
WHATSAPP: Initializing client...
==================================================================
EDOOFA VOICEFLOW SERVER: Running at http://localhost:5002
==================================================================
```

### 3. Open the Dashboard
Open your web browser and navigate to:  
👉 **[http://localhost:5002](http://localhost:5002)**

### 4. Seed Simulated Data (Highly Recommended)
To immediately populate your dashboard with realistic historical data, keep the server running and run this seeding script in a new terminal window:
```bash
node simulate.js
```
The script will inject 5 multi-turn, realistic student/mentor conversation voice notes. **Refresh your browser dashboard to view the glowing cosmic cards instantly!**

### 5. Play with the Pipeline Simulator
- In the left sidebar of the dashboard, you will find the **Pipeline Simulator** panel.
- Fill in a student name (e.g. `Jane Doe`), select `Student/Parent` or `Edoofa Team`, and click **Inject Simulated Voice Note**.
- **Watch in awe** as the dashboard displays a glowing pulse, showing the AI actively processing, and then renders the completed card at the top of the feed with sequential daily counts (`Daily VN #1`), transcription, summary, actionable checkboxes, and a functional audio player controls!

---

## ⚙️ Production Configuration (Link Live APIs)

Open the `.env` file in the root folder to customize your credentials:

### 1. Google Gemini API
1. Get a free API Key from [Google AI Studio](https://aistudio.google.com/).
2. Set `GEMINI_API_KEY=your_key_here` in `.env`.
3. *Note: If this key is blank, the system automatically runs our smart linguistic simulator fallback so the demo remains 100% operational.*

### 2. Live Google Sheets Sync
1. Open Google Sheets, create a new spreadsheet, and copy its ID from the URL (the string between `/d/` and `/edit`).
2. Go to [Google Cloud Console](https://console.cloud.google.com/), create a Service Account, download the private key JSON file, and share your spreadsheet with the service account email.
3. Configure `.env`:
   ```env
   GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email_here
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
4. Restart the server. Any new voice notes will append directly to your live Google Sheet.
5. If there are unsynced historical notes logged offline, simply click the **Sync Sheets** button on the top right of the dashboard to instantly bulk-sync them to the live spreadsheet!
