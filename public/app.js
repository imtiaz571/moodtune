/* ==========================================================================
   MoodTunes Application Logic - Vanilla JavaScript
   ========================================================================== */

// ─── Global State ───────────────────────────────────────────────────────────
const state = {
  currentSessionId: 'session-' + Date.now(),
  conversations: [],
  messages: [],
  currentMood: 'neutral',
  currentTrack: null,
  isPlaying: false,
  isSpotifyAuthenticated: false,
  userProfile: null,
};

// API Base URL (connects to Flask API)
const API_BASE = 'http://127.0.0.1:5000';

// ─── Particle Canvas Background Renderer ─────────────────────────────────────
function initParticleCanvas() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = Array.from({ length: 45 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 2 + 1,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    alpha: Math.random() * 0.5 + 0.2,
  }));

  function animate() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(168, 85, 247, ${p.alpha})`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#a855f7';
      ctx.fill();
    });

    requestAnimationFrame(animate);
  }

  animate();
}

// ─── Audio Player Controls ──────────────────────────────────────────────────
const audioPlayer = new Audio();

audioPlayer.addEventListener('timeupdate', () => {
  const fill = document.getElementById('playerProgressFill');
  if (fill && audioPlayer.duration) {
    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    fill.style.width = `${percent}%`;
  }
});

audioPlayer.addEventListener('ended', () => {
  state.isPlaying = false;
  updatePlayerUI();
});

function playTrack(track) {
  if (!track || !track.previewUrl) {
    showToast('No audio preview available for this track', 'error');
    return;
  }
  state.currentTrack = track;
  audioPlayer.src = track.previewUrl;
  audioPlayer.play();
  state.isPlaying = true;
  updatePlayerUI();
}

function togglePlayPause() {
  if (!state.currentTrack) return;
  if (state.isPlaying) {
    audioPlayer.pause();
    state.isPlaying = false;
  } else {
    audioPlayer.play();
    state.isPlaying = true;
  }
  updatePlayerUI();
}

function updatePlayerUI() {
  const titleEl = document.getElementById('playerTrackTitle');
  const artistEl = document.getElementById('playerTrackArtist');
  const artEl = document.getElementById('playerTrackArt');
  const playBtn = document.getElementById('playPauseBtn');

  if (state.currentTrack) {
    if (titleEl) titleEl.textContent = state.currentTrack.title;
    if (artistEl) artistEl.textContent = state.currentTrack.artist;
    if (artEl) artEl.src = state.currentTrack.albumArt || 'https://via.placeholder.com/48';
  }

  if (playBtn) {
    playBtn.innerHTML = state.isPlaying
      ? `<svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
      : `<svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  }
}

// ─── DOM Message Renderer ───────────────────────────────────────────────────
function renderMessages() {
  const container = document.getElementById('chatContainer');
  if (!container) return;

  if (state.messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h1 class="empty-title">How are you feeling right now?</h1>
        <p class="empty-subtitle">Talk to MoodTunes AI to get music recommendations tailored to your exact mood.</p>
        <div class="icebreakers-grid">
          <div class="icebreaker-card" onclick="sendPrompt('Need upbeat jazz for my morning coffee ☕')">
            <span class="icebreaker-emoji">☕</span>
            <span class="icebreaker-text">Upbeat morning jazz</span>
          </div>
          <div class="icebreaker-card" onclick="sendPrompt('Need high-energy workout music! ⚡')">
            <span class="icebreaker-emoji">⚡</span>
            <span class="icebreaker-text">High-energy workout</span>
          </div>
          <div class="icebreaker-card" onclick="sendPrompt('Give me ambient music to relax 🌙')">
            <span class="icebreaker-emoji">🌙</span>
            <span class="icebreaker-text">Chill ambient vibes</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = state.messages.map((msg) => {
    const isUser = msg.sender === 'user';
    const avatarContent = isUser ? 'U' : '🎵';
    
    let tracksHTML = '';
    if (!isUser && msg.tracks && msg.tracks.length > 0) {
      tracksHTML = `
        <div class="tracks-grid">
          ${msg.tracks.map((t, idx) => `
            <div class="track-card" onclick='playTrack(${JSON.stringify(t)})'>
              <img src="${t.albumArt || 'https://via.placeholder.com/48'}" class="track-art" />
              <div class="track-info">
                <div class="track-title">${t.title}</div>
                <div class="track-artist">${t.artist}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="message-row ${isUser ? 'user' : 'bot'}">
        <div class="avatar">${avatarContent}</div>
        <div class="message-bubble">
          <div>${msg.text}</div>
          ${tracksHTML}
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

// ─── Chat Actions ───────────────────────────────────────────────────────────
async function handleSendMessage() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  // Add User Message
  state.messages.push({ id: Date.now().toString(), sender: 'user', text });
  input.value = '';
  renderMessages();

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        session_id: state.currentSessionId,
      }),
    });

    const data = await res.json();
    if (data.reply) {
      state.messages.push({
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: data.reply,
        tracks: data.tracks || [],
      });
      if (data.mood) {
        state.currentMood = data.mood;
        updateMoodBadge(data.mood);
      }
      renderMessages();
    }
  } catch (err) {
    showToast('Failed to get response from MoodTunes AI', 'error');
  }
}

function sendPrompt(promptText) {
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = promptText;
    handleSendMessage();
  }
}

function updateMoodBadge(mood) {
  const badge = document.getElementById('moodBadge');
  if (badge) {
    badge.textContent = `Mood: ${mood.toUpperCase()}`;
  }
}

// ─── Toast System ───────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ─── Initialization ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticleCanvas();
  renderMessages();

  // Sidebar Toggle
  const toggleBtn = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // Send Message on Enter Key
  const input = document.getElementById('chatInput');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSendMessage();
    });
  }
});
