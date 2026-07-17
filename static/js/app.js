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

    // Mood → visual theme mapping (pastel palette)
    const moodThemes = {
        happy:      { emoji: '🌻', color: '#E8DC5C', label: 'Happy',       glow: 'rgba(232, 220, 92, 0.2)' },
        sad:        { emoji: '🌧️', color: '#93A8D6', label: 'Sad',         glow: 'rgba(147, 168, 214, 0.2)' },
        angry:      { emoji: '🌶️', color: '#E87461', label: 'Angry',       glow: 'rgba(232, 116, 97, 0.2)' },
        anxious:    { emoji: '🫧', color: '#C5C3E8', label: 'Anxious',     glow: 'rgba(197, 195, 232, 0.2)' },
        chill:      { emoji: '🍃', color: '#A8C686', label: 'Chill',       glow: 'rgba(168, 198, 134, 0.2)' },
        romantic:   { emoji: '🌸', color: '#F2B8D1', label: 'Romantic',    glow: 'rgba(242, 184, 209, 0.2)' },
        energetic:  { emoji: '⚡', color: '#F5C9A8', label: 'Energetic',   glow: 'rgba(245, 201, 168, 0.2)' },
        melancholic:{ emoji: '🌊', color: '#B8D4E8', label: 'Melancholic', glow: 'rgba(184, 212, 232, 0.2)' },
        nostalgic:  { emoji: '🌅', color: '#F5C9A8', label: 'Nostalgic',   glow: 'rgba(245, 201, 168, 0.2)' },
        hopeful:    { emoji: '✨', color: '#D1E4BC', label: 'Hopeful',     glow: 'rgba(209, 228, 188, 0.2)' },
        lonely:     { emoji: '🌙', color: '#C5C3E8', label: 'Lonely',     glow: 'rgba(197, 195, 232, 0.2)' },
        confident:  { emoji: '🔥', color: '#E8DC5C', label: 'Confident',   glow: 'rgba(232, 220, 92, 0.2)' },
        neutral:    { emoji: '🎧', color: '#B0B0B0', label: 'Neutral',     glow: 'rgba(176, 176, 176, 0.1)' },
    };

    function getMoodTheme(mood) {
        return moodThemes[(mood || '').toLowerCase()] || moodThemes.neutral;
    }

    // Check Spotify Auth Status
    fetch('/api/auth_status')
        .then(res => res.json())
        .then(data => {
            if (data.logged_in) {
                spotifyAuthContainer.innerHTML = `<a href="/logout" class="auth-btn" style="background: transparent; border: 1.5px solid var(--text-dim); color: var(--text-medium);">Logout</a>`;
            } else {
                spotifyAuthContainer.innerHTML = `<a href="/login" class="auth-btn">🎵 Connect Spotify</a>`;
            }
        })
        .catch(err => console.error("Error fetching auth status", err));

    function appendMessage(sender, text, isHtml = false, mood = null) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message fade-in`;

        const theme = getMoodTheme(mood);

        const avatar = document.createElement('div');
        avatar.className = `avatar ${sender}-avatar`;
        avatar.textContent = sender === 'bot' ? theme.emoji : 'U';

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

        msgDiv.appendChild(avatar);
        msgDiv.appendChild(bubble);

        chatBox.appendChild(msgDiv);
        scrollToBottom();
        return msgDiv;
    }

    function applyMoodGlow(mood) {
        const theme = getMoodTheme(mood);
        const container = document.querySelector('.app-container');
        if (!container) return;
        container.style.transition = 'box-shadow 0.6s ease';
        container.style.boxShadow = `0 0 50px ${theme.glow}, 0 20px 60px rgba(0,0,0,0.08)`;
    }

    function scrollToBottom() {
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function showTyping() {
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
                btnElement.outerHTML = `<a href="${data.url}" target="_blank" class="playlist-btn" style="background: var(--spotify-green);">Open Playlist 🎵</a>`;
            } else {
                if (data.error === "not_logged_in") {
                    btnElement.textContent = "Login to Spotify first!";
                } else {
                    btnElement.textContent = "Failed to create";
                }
                setTimeout(() => { btnElement.disabled = false; btnElement.textContent = "Create Spotify Playlist"; }, 3000);
            }
        } catch (e) {
            console.error(e);
            btnElement.textContent = "Error";
            setTimeout(() => { btnElement.disabled = false; btnElement.textContent = "Create Spotify Playlist"; }, 3000);
        }
    };

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;

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

                botContent += `<div class="playlist-controls"><button class="playlist-btn" onclick="createPlaylist(this)">Create Spotify Playlist</button></div>`;
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
