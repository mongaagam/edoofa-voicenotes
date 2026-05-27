// =========================================================================
// EDOOFA VOICEFLOW AI - FRONTEND INTERACTION LOGIC
// =========================================================================

let socket;
let voiceNotes = [];
let currentAudio = null;
let currentPlayingBtn = null;
let currentPlayingBar = null;
let currentPlayingTimer = null;

// Initialize layout elements
const elWhatsappStatus = document.getElementById('whatsappStatusText');
const elWhatsappDot = document.querySelector('#whatsappStatusIndicator .status-dot');
const elSheetsStatus = document.querySelector('#sheetsSyncIndicator .status-label');
const elSheetsDot = document.querySelector('#sheetsSyncIndicator .status-dot');
const elQrModal = document.getElementById('qrModal');
const elQrImage = document.getElementById('qrImage');
const elQrLoader = document.getElementById('qrLoader');
const elFeedEmpty = document.getElementById('feedEmptyState');
const elFeedFeed = document.getElementById('voiceNotesFeed');
const elProcessingAlert = document.getElementById('processingAlert');
const elBtnBulkSync = document.getElementById('btnBulkSync');

// Metrics
const elStatTotal = document.getElementById('statTotalVNs');
const elStatStudents = document.getElementById('statStudents');
const elStatEdoofa = document.getElementById('statEdoofaVNs');
const elStatStudent = document.getElementById('statStudentVNs');

// Simulator elements
const elSimForm = document.getElementById('simulatorForm');
const elBtnSimulate = document.getElementById('btnSimulate');

// Connect to WebSockets for instant live feedback
function connectWS() {
  const BACKEND_DOMAIN = 'edoofa-voicenotes.onrender.com';
  const wsUrl = `wss://${BACKEND_DOMAIN}`;
  console.log(`Connecting to WebSocket: ${wsUrl}`);
  
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('WebSocket connection opened.');
  };

  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    console.log('WS Message Received:', payload.type, payload);

    switch (payload.type) {
      case 'INITIAL_STATE':
        updateWhatsAppStatus(payload.whatsapp);
        voiceNotes = payload.voiceNotes.reverse(); // Newest first
        renderFeed();
        calculateMetrics();
        break;

      case 'STATUS_UPDATE':
        updateWhatsAppStatus(payload);
        break;

      case 'PROCESSING_START':
        showProcessingAlert(payload.data);
        break;

      case 'VOICE_NOTE_PROCESSED':
        hideProcessingAlert();
        // Insert the newly processed voice note at the top of the local array
        voiceNotes.unshift(payload.data);
        renderFeed();
        calculateMetrics();
        // Light flash animation on the newly added card
        const firstCard = elFeedFeed.querySelector('.voice-note-card');
        if (firstCard) {
          firstCard.style.animation = 'pulseCard 1.5s ease-out';
          setTimeout(() => {
            firstCard.style.animation = '';
          }, 1500);
        }
        break;

      case 'BULK_SYNC_SUCCESS':
        voiceNotes = payload.voiceNotes.reverse();
        renderFeed();
        calculateMetrics();
        alert('Google Sheets Sync Successful! Synced status updated across all notes.');
        break;
    }
  };

  socket.onclose = () => {
    console.log('WebSocket connection closed. Retrying in 3 seconds...');
    setTimeout(connectWS, 3000);
  };

  socket.onerror = (err) => {
    console.error('WebSocket error:', err);
  };
}

// Update WhatsApp Connection Status Pill & QR Modal
function updateWhatsAppStatus(data) {
  const status = data.status;
  elWhatsappStatus.textContent = formatStatusText(status);
  
  // Set appropriate colors
  elWhatsappDot.className = 'status-dot';
  if (status === 'CONNECTED') {
    elWhatsappDot.classList.add('success');
    elQrModal.classList.add('hidden');
  } else if (status === 'SCANNING_REQUIRED') {
    elWhatsappDot.classList.add('warning');
    // Load QR Code inside browser modal!
    if (data.qr) {
      elQrLoader.classList.add('hidden');
      elQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.qr)}`;
      elQrModal.classList.remove('hidden');
    }
  } else if (status === 'AUTHENTICATING' || status === 'INITIALIZATION_FAILED') {
    elWhatsappDot.classList.add('info');
    elQrModal.classList.add('hidden');
  } else {
    elWhatsappDot.classList.add('danger');
    elQrModal.classList.add('hidden');
  }
}

function formatStatusText(status) {
  switch (status) {
    case 'CONNECTED': return 'WhatsApp: Active Listener';
    case 'SCANNING_REQUIRED': return 'WhatsApp: Setup Required';
    case 'AUTHENTICATING': return 'WhatsApp: Authenticating...';
    case 'INITIALIZATION_FAILED': return 'WhatsApp: Init Failed';
    case 'DISCONNECTED': return 'WhatsApp: Offline';
    default: return `WhatsApp: ${status}`;
  }
}

// Show neon active processing alert
function showProcessingAlert(data) {
  document.getElementById('tickerStudent').textContent = data.studentName;
  document.getElementById('tickerSender').textContent = data.senderName;
  document.getElementById('tickerGroup').textContent = data.groupName;
  
  elProcessingAlert.classList.remove('hidden');
  // Scroll content feed to top
  elFeedFeed.scrollTop = 0;
}

function hideProcessingAlert() {
  elProcessingAlert.classList.add('hidden');
}

// Render feed of voice note cards
function renderFeed() {
  // Clear past dynamic cards
  const existingCards = elFeedFeed.querySelectorAll('.voice-note-card');
  existingCards.forEach(card => card.remove());

  if (voiceNotes.length === 0) {
    elFeedEmpty.classList.remove('hidden');
    return;
  }

  elFeedEmpty.classList.add('hidden');

  // Check Google sheets configuration details based on cards sync status
  let totalLocalOnly = 0;
  voiceNotes.forEach(note => {
    if (note.syncStatus === 'Local Only') totalLocalOnly++;
  });

  if (totalLocalOnly > 0) {
    elSheetsStatus.textContent = `Sheets: ${totalLocalOnly} Pending`;
    elSheetsDot.className = 'status-dot warning';
  } else {
    elSheetsStatus.textContent = 'Sheets: Fully Synced';
    elSheetsDot.className = 'status-dot success';
  }

  // Create cards
  voiceNotes.forEach((note) => {
    const card = document.createElement('div');
    card.className = `glass-card voice-note-card ${note.senderType === 'Edoofa Team' ? 'outgoing' : 'incoming'}`;
    
    // Checkboxes list rendering
    const actionItemsHtml = note.actionItems && note.actionItems.length > 0
      ? note.actionItems.map(item => `
          <li class="action-item-check">
            <input type="checkbox">
            <span>${escapeHTML(item)}</span>
          </li>
        `).join('')
      : '<li class="action-item-check"><span>No clear action items identified.</span></li>';

    // Set Sync icon
    const syncClass = note.syncStatus === 'Synced' ? 'synced' : 'local';
    const syncIcon = note.syncStatus === 'Synced' ? 'cloud-check' : 'cloud-off';
    const syncLabel = note.syncStatus === 'Synced' ? 'Synced to Google Sheets' : 'Local spreadsheet only';

    card.innerHTML = `
      <div class="card-top">
        <div class="card-meta-left">
          <h3>
            <span class="student-tag">${escapeHTML(note.studentName)}</span>
            <span class="vn-seq-badge">Daily VN #${note.vnNumber}</span>
          </h3>
          <div class="group-pill">
            <i data-lucide="users" style="width:13px;height:13px;"></i>
            <span>${escapeHTML(note.groupName)}</span>
          </div>
        </div>
        <div class="card-meta-right">
          <div class="time-stamp">
            <i data-lucide="clock" style="width:13px;height:13px;"></i>
            <span>${note.timestamp}</span>
          </div>
          <span class="speaker-pill ${note.senderType === 'Edoofa Team' ? 'mentor' : 'student'}">
            <i data-lucide="${note.senderType === 'Edoofa Team' ? 'user-check' : 'user'}" style="width:11px;height:11px;"></i>
            <span>${escapeHTML(note.senderName)}</span>
          </span>
        </div>
      </div>

      <!-- Player controls -->
      <div class="player-container">
        <button class="btn-play-pause" data-file="${note.audioFileName}" title="Listen to Voice Note">
          <i data-lucide="play" style="width:18px;height:18px;fill:#fff;"></i>
        </button>
        <div class="audio-seeker-bar">
          <div class="audio-progress"></div>
        </div>
        <span class="player-timer">0:00</span>
      </div>

      <!-- AI Collapsible analytics -->
      <div class="ai-report-box">
        <div class="ai-block">
          <h4 class="trans-title"><i data-lucide="align-left"></i> Verbatim AI Transcript</h4>
          <p class="transcription-text">"${escapeHTML(note.transcript)}"</p>
        </div>

        <div class="ai-block">
          <h4 class="summary-title"><i data-lucide="sparkles"></i> AI Summary</h4>
          <p class="summary-text">${escapeHTML(note.summary)}</p>
        </div>
      </div>

      <div class="ai-block" style="margin-top: 15px;">
        <h4 class="action-title"><i data-lucide="check-square"></i> Isolated Action Items & Next Steps</h4>
        <ul class="action-items-list">
          ${actionItemsHtml}
        </ul>
      </div>

      <div class="card-footer">
        <div class="sync-status-badge ${syncClass}">
          <i data-lucide="${syncIcon}" style="width:14px;height:14px;"></i>
          <span>${syncLabel}</span>
        </div>
        <div style="color:var(--text-tertiary);">
          ID: ${note.id}
        </div>
      </div>
    `;

    elFeedFeed.appendChild(card);
  });

  // Re-instantiate Lucide Icons on newly created items
  lucide.createIcons();

  // Attach player click handlers
  setupAudioPlayers();
}

// Player audio operations
function setupAudioPlayers() {
  const playButtons = elFeedFeed.querySelectorAll('.btn-play-pause');
  
  playButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const filename = btn.getAttribute('data-file');
      const audioUrl = `https://edoofa-voicenotes.onrender.com/api/audio/${filename}`;
      const parent = btn.closest('.player-container');
      const progressBar = parent.querySelector('.audio-progress');
      const timer = parent.querySelector('.player-timer');

      // If clicked current playing audio -> Toggle
      if (currentAudio && currentAudio.src.includes(filename)) {
        if (currentAudio.paused) {
          currentAudio.play();
          btn.innerHTML = `<i data-lucide="pause" style="width:18px;height:18px;fill:#fff;"></i>`;
        } else {
          currentAudio.pause();
          btn.innerHTML = `<i data-lucide="play" style="width:18px;height:18px;fill:#fff;"></i>`;
        }
        lucide.createIcons();
        return;
      }

      // Stop old playing instances
      resetActiveAudio();

      // Launch new play session
      currentAudio = new Audio(audioUrl);
      currentPlayingBtn = btn;
      currentPlayingBar = progressBar;
      currentPlayingTimer = timer;

      currentAudio.play().then(() => {
        btn.innerHTML = `<i data-lucide="pause" style="width:18px;height:18px;fill:#fff;"></i>`;
        lucide.createIcons();
      }).catch(err => {
        console.warn('Audio play failed (maybe mock ogg is empty placeholder):', err.message);
        // Simulate playing for 3 seconds anyway if it's the empty mock placeholder file
        // so the dashboard demo works gracefully out of the box!
        simulateAudioPlayerPlayback();
      });

      if (currentAudio) {
        currentAudio.addEventListener('timeupdate', () => {
          if (!currentAudio) return;
          const ratio = (currentAudio.currentTime / currentAudio.duration) * 100;
          progressBar.style.width = `${ratio}%`;
          timer.textContent = formatTime(currentAudio.currentTime);
        });

        currentAudio.addEventListener('ended', () => {
          resetActiveAudio();
        });
      }
    });
  });
}

function simulateAudioPlayerPlayback() {
  let elapsed = 0;
  const total = 5; // 5 seconds dummy duration
  currentPlayingBtn.innerHTML = `<i data-lucide="pause" style="width:18px;height:18px;fill:#fff;"></i>`;
  lucide.createIcons();
  
  const timerInterval = setInterval(() => {
    if (!currentPlayingBtn || currentPlayingBtn.innerHTML.includes('play')) {
      clearInterval(timerInterval);
      return;
    }
    elapsed += 0.25;
    const ratio = (elapsed / total) * 100;
    currentPlayingBar.style.width = `${ratio}%`;
    currentPlayingTimer.textContent = formatTime(elapsed);

    if (elapsed >= total) {
      clearInterval(timerInterval);
      resetActiveAudio();
    }
  }, 250);
}

function resetActiveAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentPlayingBtn) {
    currentPlayingBtn.innerHTML = `<i data-lucide="play" style="width:18px;height:18px;fill:#fff;"></i>`;
    lucide.createIcons();
    currentPlayingBtn = null;
  }
  if (currentPlayingBar) {
    currentPlayingBar.style.width = '0%';
    currentPlayingBar = null;
  }
  if (currentPlayingTimer) {
    currentPlayingTimer.textContent = '0:00';
    currentPlayingTimer = null;
  }
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Calculate summary metrics
function calculateMetrics() {
  elStatTotal.textContent = voiceNotes.length;
  
  // Count unique student names
  const students = new Set(voiceNotes.map(note => note.studentName.toLowerCase()));
  elStatStudents.textContent = students.size;

  const countEdoofa = voiceNotes.filter(note => note.senderType === 'Edoofa Team').length;
  elStatEdoofa.textContent = countEdoofa;
  
  const countStudent = voiceNotes.filter(note => note.senderType === 'Student/Parent').length;
  elStatStudent.textContent = countStudent;
}

// Google Sheets Bulk Sync Trigger Button
elBtnBulkSync.addEventListener('click', async () => {
  elBtnBulkSync.disabled = true;
  elBtnBulkSync.querySelector('span').textContent = 'Syncing...';
  
  try {
    const response = await fetch('https://edoofa-voicenotes.onrender.com/api/sync', { method: 'POST' });
    const data = await response.json();
    if (!response.ok) {
      alert(`Sync Failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Fetch sync error:', err);
    alert('Failed to contact server for sync trigger.');
  } finally {
    elBtnBulkSync.disabled = false;
    elBtnBulkSync.querySelector('span').textContent = 'Sync Sheets';
  }
});

// Operations Simulator Form injection trigger
elSimForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  elBtnSimulate.disabled = true;
  const origBtnContent = elBtnSimulate.innerHTML;
  elBtnSimulate.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin:0;"></div> <span style="margin-left:8px;">Transcribing...</span>`;

  const payload = {
    studentName: document.getElementById('simStudentName').value,
    groupName: document.getElementById('simGroupName').value,
    senderType: document.getElementById('simSenderType').value,
    senderName: document.getElementById('simSenderName').value
  };

  try {
    const response = await fetch('https://edoofa-voicenotes.onrender.com/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      // Clear form inputs
      document.getElementById('simStudentName').value = '';
      document.getElementById('simGroupName').value = '';
      document.getElementById('simSenderName').value = '';
    } else {
      const errData = await response.json();
      alert(`Simulation Error: ${errData.message}`);
    }
  } catch (err) {
    console.error('Simulation post error:', err);
    alert('Failed to connect to simulation server.');
  } finally {
    elBtnSimulate.disabled = false;
    elBtnSimulate.innerHTML = origBtnContent;
  }
});

// HTML escaping helper
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Connect on mount
connectWS();
