document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');
    const typingIndicator = document.getElementById('typing-indicator');
    const sendBtn = document.getElementById('send-btn');
    const spotifyAuthContainer = document.getElementById('spotify-auth-container');

    // ─── Audio Preview Player (Instagram-style) ───
    let currentAudio = null;
    let currentCard = null;
    let progressInterval = null;

    function stopCurrentPreview() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
        if (currentCard) {
            currentCard.classList.remove('playing');
            const playIcon = currentCard.querySelector('.play-icon');
            const pauseIcon = currentCard.querySelector('.pause-icon');
            if (playIcon) playIcon.style.display = '';
            if (pauseIcon) pauseIcon.style.display = 'none';
            const bar = currentCard.querySelector('.preview-progress-bar');
            if (bar) bar.style.width = '0%';
            currentCard = null;
        }
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    window.togglePreview = function(btnElement) {
        const card = btnElement.closest('.track-card');
        const previewUrl = card.dataset.previewUrl;
        if (!previewUrl) return;

        // If clicking the same card that's playing → pause it
        if (currentCard === card && currentAudio && !currentAudio.paused) {
            stopCurrentPreview();
            return;
        }

        // Stop any existing preview
        stopCurrentPreview();

        // Start new preview
        const audio = new Audio(previewUrl);
        currentAudio = audio;
        currentCard = card;

        card.classList.add('playing');
        const playIcon = card.querySelector('.play-icon');
        const pauseIcon = card.querySelector('.pause-icon');
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = '';

        const bar = card.querySelector('.preview-progress-bar');

        audio.play().catch(err => {
            console.error('Preview playback error:', err);
            stopCurrentPreview();
        });

        // Update progress bar
        progressInterval = setInterval(() => {
            if (audio.duration && bar) {
                const pct = (audio.currentTime / audio.duration) * 100;
                bar.style.width = pct + '%';
            }
        }, 50);

        // When preview ends
        audio.addEventListener('ended', () => {
            stopCurrentPreview();
        });
    };

    // Mood → visual theme mapping
    const moodThemes = {
        happy:      { emoji: '😄', color: '#FFD700', label: 'Happy',       glow: 'rgba(255, 215, 0, 0.15)' },
        sad:        { emoji: '😢', color: '#6B8DD6', label: 'Sad',         glow: 'rgba(107, 141, 214, 0.15)' },
        angry:      { emoji: '🔥', color: '#FF4444', label: 'Angry',       glow: 'rgba(255, 68, 68, 0.15)' },
        anxious:    { emoji: '😰', color: '#A78BFA', label: 'Anxious',     glow: 'rgba(167, 139, 250, 0.15)' },
        chill:      { emoji: '😎', color: '#34D399', label: 'Chill',       glow: 'rgba(52, 211, 153, 0.15)' },
        romantic:   { emoji: '💕', color: '#F472B6', label: 'Romantic',    glow: 'rgba(244, 114, 182, 0.15)' },
        energetic:  { emoji: '⚡', color: '#FBBF24', label: 'Energetic',   glow: 'rgba(251, 191, 36, 0.15)' },
        melancholic:{ emoji: '🌧️', color: '#93C5FD', label: 'Melancholic', glow: 'rgba(147, 197, 253, 0.15)' },
        nostalgic:  { emoji: '🌅', color: '#FCA5A5', label: 'Nostalgic',   glow: 'rgba(252, 165, 165, 0.15)' },
        hopeful:    { emoji: '✨', color: '#6EE7B7', label: 'Hopeful',     glow: 'rgba(110, 231, 183, 0.15)' },
        lonely:     { emoji: '🌙', color: '#A5B4FC', label: 'Lonely',     glow: 'rgba(165, 180, 252, 0.15)' },
        confident:  { emoji: '💪', color: '#F59E0B', label: 'Confident',   glow: 'rgba(245, 158, 11, 0.15)' },
        neutral:    { emoji: '🤖', color: '#9CA3AF', label: 'Neutral',     glow: 'rgba(156, 163, 175, 0.1)' },
    };

    function getMoodTheme(mood) {
        return moodThemes[(mood || '').toLowerCase()] || moodThemes.neutral;
    }

    // Check Spotify Auth Status
    fetch('/api/auth_status')
        .then(res => res.json())
        .then(data => {
            if (data.logged_in) {
                spotifyAuthContainer.innerHTML = `<span style="color: var(--text-dim); font-size: 0.85rem; margin-right: 12px;">Logged in to Spotify</span>
                                                  <a href="/logout" class="auth-btn" style="background: transparent; border: 1px solid var(--text-dim); color: var(--text-dim);">Logout</a>`;
            } else {
                spotifyAuthContainer.innerHTML = `<a href="/login" class="auth-btn">Connect Spotify</a>`;
            }
        })
        .catch(err => console.error("Error fetching auth status", err));

    function appendMessage(sender, text, isHtml = false, mood = null) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message fade-in`;

        const theme = getMoodTheme(mood);

        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        // Apply mood-colored left border accent for bot messages
        if (sender === 'bot' && mood && mood !== 'neutral') {
            bubble.style.borderLeft = `3px solid ${theme.color}`;
        }

        if (isHtml) {
            bubble.innerHTML = text;
        } else {
            bubble.textContent = text;
        }

        msgDiv.appendChild(bubble);

        chatBox.insertBefore(msgDiv, typingIndicator);
        scrollToBottom();
        return msgDiv;
    }

    function applyMoodGlow(mood) {
        const theme = getMoodTheme(mood);
        const glowColor = theme.glow.replace('0.15', '0.2').replace('0.1', '0.2'); // slightly stronger for the radial background
        document.body.style.background = `radial-gradient(circle at 50% 50%, ${glowColor} 0%, var(--bg-dark) 60%)`;
    }

    function scrollToBottom() {
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function showTyping() {
        chatBox.appendChild(typingIndicator);
        typingIndicator.classList.remove('hidden');
        scrollToBottom();
    }

    function hideTyping() {
        typingIndicator.classList.add('hidden');
    }

    // Handle creating playlist
    window.createPlaylist = async function(btnElement) {
        const container = btnElement.closest('.recommendations-wrapper');
        const cards = container.querySelectorAll('.track-card');
        const uris = Array.from(cards).map(card => card.dataset.uri).filter(uri => uri);

        if (uris.length === 0) return;

        btnElement.disabled = true;
        btnElement.textContent = "Creating...";

        try {
            const res = await fetch('/api/create_playlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uris: uris })
            });
            const data = await res.json();

            if (data.success) {
                btnElement.outerHTML = `<a href="${data.url}" target="_blank" class="playlist-btn" style="background: var(--spotify-green);">Playing on Spotify 🎵</a>`;
                window.open(data.url, '_blank');
            } else {
                if (data.error === "not_logged_in") {
                    btnElement.textContent = "Login to Spotify first!";
                } else {
                    btnElement.textContent = "Failed to create";
                }
                setTimeout(() => { btnElement.disabled = false; btnElement.textContent = "Save as Playlist 📝"; }, 3000);
            }
        } catch (e) {
            console.error(e);
            btnElement.textContent = "Error";
            setTimeout(() => { btnElement.disabled = false; btnElement.textContent = "Save as Playlist 📝"; }, 3000);
        }
    };

    let isFirstMessage = true;

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;

        if (isFirstMessage) {
            document.body.classList.remove('landing-mode');
            document.body.classList.add('chat-mode');
            document.getElementById('chat-area').classList.remove('hidden');
            isFirstMessage = false;
        }

        // Add user message
        appendMessage('user', text);
        userInput.value = '';
        sendBtn.disabled = true;

        // Show typing
        showTyping();

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const data = await res.json();
            hideTyping();

            if (data.error) {
                appendMessage('bot', `<span class="error-text">Error: ${data.error}</span>`, true);
                sendBtn.disabled = false;
                return;
            }

            const mood = data.mood || 'neutral';
            const theme = getMoodTheme(mood);

            // Apply mood glow to container
            applyMoodGlow(mood);

            // Build bot message content with mood badge
            let botContent = `<p>${data.reply}</p>`;

            // Add a mood badge pill
            if (mood !== 'neutral') {
                botContent += `<span class="mood-badge" style="background: ${theme.color}22; color: ${theme.color}; border: 1px solid ${theme.color}44;">${theme.emoji} ${theme.label}</span>`;
            }

            // If recommendations exist, append them
            if (data.tracks && data.tracks.length > 0) {
                botContent += `<div class="recommendations-wrapper">`;
                const template = document.getElementById('track-card-template');

                data.tracks.forEach(track => {
                    const clone = template.content.cloneNode(true);
                    const card = clone.querySelector('.track-card');

                    if (track.uri) {
                        card.dataset.uri = track.uri;
                    } else {
                        card.style.opacity = '0.6';
                    }

                    // Store preview URL as data attribute
                    if (track.preview_url) {
                        card.dataset.previewUrl = track.preview_url;
                        const previewBtn = clone.querySelector('.preview-btn');
                        if (previewBtn) {
                            previewBtn.style.display = '';
                            previewBtn.setAttribute('onclick', 'togglePreview(this)');
                        }
                    }

                    clone.querySelector('.track-title').textContent = track.title;
                    clone.querySelector('.track-artist').textContent = track.artist;
                    clone.querySelector('.track-reason').textContent = track.reason;

                    if (track.image_url) {
                        clone.querySelector('.track-img').src = track.image_url;
                    }

                    if (track.spotify_url) {
                        clone.querySelector('.spotify-link').href = track.spotify_url;
                    } else {
                        clone.querySelector('.spotify-link').style.display = 'none';
                    }

                    const tmp = document.createElement('div');
                    tmp.appendChild(clone);
                    botContent += tmp.innerHTML;
                });

                let controlsHtml = `<div class="playlist-controls" style="display: flex; gap: 10px;">`;
                
                const playableTrack = data.tracks.find(t => t.spotify_url);
                if (playableTrack) {
                    controlsHtml += `<a href="${playableTrack.spotify_url}" target="_blank" class="playlist-btn" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">Listen on Spotify 🎧</a>`;
                }
                
                const hasUris = data.tracks.some(t => t.uri);
                if (hasUris) {
                    controlsHtml += `<button class="playlist-btn secondary" onclick="createPlaylist(this)">Save as Playlist 📝</button>`;
                }
                
                controlsHtml += `</div>`;
                botContent += controlsHtml;
                botContent += `</div>`;
            }

            appendMessage('bot', botContent, true, mood);

        } catch (err) {
            hideTyping();
            appendMessage('bot', `<span class="error-text">Network error occurred.</span>`, true);
            console.error(err);
        }

        sendBtn.disabled = false;
        userInput.focus();
    });
});
