document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');
    const typingIndicator = document.getElementById('typing-indicator');
    const sendBtn = document.getElementById('send-btn');
    const spotifyAuthContainer = document.getElementById('spotify-auth-container');

    // Sidebar Elements
    const sidebar = document.getElementById('sidebar');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenuClose = document.getElementById('mobile-menu-close');
    const newChatBtn = document.getElementById('new-chat-btn');
    const searchChats = document.getElementById('search-chats');
    const chatHistoryList = document.getElementById('chat-history-list');

    let currentSessionId = generateSessionId();
    let allSessions = {}; // Map of sessionId -> chats array

    function generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => sidebar.classList.add('open'));
    if (mobileMenuClose) mobileMenuClose.addEventListener('click', () => sidebar.classList.remove('open'));

    const sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
    if (sidebarCollapseBtn) {
        sidebarCollapseBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            if (sidebar.classList.contains('collapsed')) {
                sidebarCollapseBtn.title = "Open sidebar";
            } else {
                sidebarCollapseBtn.title = "Close sidebar";
            }
        });
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            currentSessionId = generateSessionId();
            localStorage.removeItem('activeSessionId');
            chatBox.innerHTML = '';
            chatBox.appendChild(typingIndicator);
            document.body.classList.remove('chat-mode');
            document.body.classList.add('landing-mode');
            document.getElementById('chat-area').classList.add('hidden');
            isFirstMessage = true;
            renderSidebar();
            if (window.innerWidth <= 768) sidebar.classList.remove('open');
        });
    }

    if (searchChats) {
        searchChats.addEventListener('input', (e) => {
            renderSidebar(e.target.value);
        });
    }

    // ─── Visual Viewport Fix for Mobile Keyboards ───
    if (window.visualViewport) {
        const updateViewportHeight = () => {
            document.body.style.height = window.visualViewport.height + 'px';
            // Scroll to the bottom of the chat when the keyboard pops up
            if (document.body.classList.contains('chat-mode') && chatBox) {
                setTimeout(() => {
                    chatBox.scrollTop = chatBox.scrollHeight;
                }, 100); // small delay to let the layout recalculate
            }
        };
        window.visualViewport.addEventListener('resize', updateViewportHeight);
        updateViewportHeight();
    }

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

    let isSpotifyLoggedIn = false;
    let firebaseIdToken = null;

    // --- Firebase Auth Setup ---
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) {
        firebase.initializeApp(window.FIREBASE_CONFIG);
        
        // Initialize Analytics if supported
        if (typeof firebase.analytics === 'function') {
            firebase.analytics();
        }
    }
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const auth = firebase.auth();
        const googleProvider = new firebase.auth.GoogleAuthProvider();
        
        const firebaseLoginBtn = document.getElementById('firebase-login-btn');
        const firebaseLogoutBtn = document.getElementById('firebase-logout-btn');
        
        if (firebaseLoginBtn) {
            firebaseLoginBtn.addEventListener('click', () => auth.signInWithPopup(googleProvider));
        }
        if (firebaseLogoutBtn) {
            firebaseLogoutBtn.addEventListener('click', () => auth.signOut());
        }

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                firebaseIdToken = await user.getIdToken();
                if (firebaseLoginBtn) firebaseLoginBtn.style.display = 'none';
                if (firebaseLogoutBtn) firebaseLogoutBtn.style.display = 'block';
                if (spotifyAuthContainer) spotifyAuthContainer.style.display = 'block';
                
                userInput.disabled = false;
                sendBtn.disabled = false;
                userInput.placeholder = "Message MoodTunes...";
                
                checkSpotifyAuth();
                fetchHistory();
            } else {
                firebaseIdToken = null;
                if (firebaseLoginBtn) firebaseLoginBtn.style.display = 'block';
                if (firebaseLogoutBtn) firebaseLogoutBtn.style.display = 'none';
                if (spotifyAuthContainer) spotifyAuthContainer.style.display = 'none';
                
                userInput.disabled = true;
                sendBtn.disabled = true;
                userInput.placeholder = "Please sign in to start chatting...";
            }
        });
    }

    function checkSpotifyAuth() {
        fetch('/api/auth_status')
            .then(res => res.json())
            .then(data => {
                isSpotifyLoggedIn = data.logged_in;
                if (data.logged_in) {
                    spotifyAuthContainer.innerHTML = `<span style="color: var(--text-dim); font-size: 0.85rem; margin-right: 12px;">Spotify Connected</span>
                                                      <a href="/logout" class="auth-btn" style="background: transparent; border: 1px solid var(--text-dim); color: var(--text-dim);">Disconnect</a>`;
                } else {
                    spotifyAuthContainer.innerHTML = `<a href="/login" class="auth-btn">Connect Spotify</a>`;
                }
            })
            .catch(err => console.error("Error fetching auth status", err));
    }

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
                btnElement.outerHTML = `<a href="${data.uri}:play" class="playlist-btn" style="background: var(--spotify-green); color: #000; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">Listen to Playlist 🎧</a>`;
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

    // Handle preset chips
    const presetChips = document.querySelectorAll('.preset-chip');
    presetChips.forEach(chip => {
        chip.addEventListener('click', () => {
            userInput.value = chip.textContent;
            chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
        });
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!isSpotifyLoggedIn) {
            alert("Please connect your Spotify account first to start chatting!");
            return;
        }

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
            const headers = { 'Content-Type': 'application/json' };
            if (firebaseIdToken) headers['Authorization'] = `Bearer ${firebaseIdToken}`;
            
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ message: text, session_id: currentSessionId })
            });

            const data = await res.json();
            hideTyping();

            if (data.error) {
                appendMessage('bot', `<span class="error-text">Error: ${data.error}</span>`, true);
                sendBtn.disabled = false;
                return;
            }

            const mood = data.mood || 'neutral';
            applyMoodGlow(mood);

            const botContent = buildBotContentHTML(data);
            const msgDiv = appendMessage('bot', botContent, true, mood);
            bindPlaylistButton(msgDiv, data);

            if (!allSessions[currentSessionId]) allSessions[currentSessionId] = [];
            allSessions[currentSessionId].push({
                session_id: currentSessionId,
                user_message: text,
                reply: data.reply,
                mood: data.mood,
                chat_title: data.chat_title,
                tracks: data.tracks,
                timestamp: new Date().toISOString()
            });
            renderSidebar();

        } catch (err) {
            hideTyping();
            appendMessage('bot', `<span class="error-text">Network error occurred.</span>`, true);
            console.error(err);
        }

        sendBtn.disabled = false;
        userInput.focus();
    });

    // --- Render Bot Message Function ---
    function buildBotContentHTML(data) {
        const mood = data.mood || 'neutral';
        const theme = getMoodTheme(mood);
        let botContent = `<p>${data.reply}</p>`;

        if (mood !== 'neutral') {
            botContent += `<span class="mood-badge" style="background: ${theme.color}22; color: ${theme.color}; border: 1px solid ${theme.color}44;">${theme.emoji} ${theme.label}</span>`;
        }

        if (data.tracks && data.tracks.length > 0) {
            botContent += `<div class="recommendations-wrapper">`;
            const template = document.getElementById('track-card-template');

            data.tracks.forEach(track => {
                const clone = template.content.cloneNode(true);
                const card = clone.querySelector('.track-card');
                if (track.uri) card.dataset.uri = track.uri;
                else card.style.opacity = '0.6';
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
                if (track.image_url) clone.querySelector('.track-img').src = track.image_url;
                if (track.spotify_url) clone.querySelector('.spotify-link').href = track.spotify_url;
                else clone.querySelector('.spotify-link').style.display = 'none';

                const tmp = document.createElement('div');
                tmp.appendChild(clone);
                botContent += tmp.innerHTML;
            });

            let controlsHtml = `<div class="playlist-controls" style="display: flex; gap: 10px;">`;
            if (isSpotifyLoggedIn && data.tracks.some(t => t.uri)) {
                controlsHtml += `<button class="playlist-btn create-playlist-btn" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">Create a Playlist 🎵</button>`;
            }
            controlsHtml += `</div>`;
            botContent += controlsHtml;
            botContent += `</div>`;
        }
        return botContent;
    }

    function bindPlaylistButton(msgDiv, data) {
        const createBtn = msgDiv.querySelector('.create-playlist-btn');
        if (createBtn) {
            createBtn.addEventListener('click', async () => {
                createBtn.textContent = 'Creating...';
                createBtn.disabled = true;

                const uris = data.tracks.filter(t => t.uri).map(t => t.uri);
                const headers = { 'Content-Type': 'application/json' };
                if (firebaseIdToken) headers['Authorization'] = `Bearer ${firebaseIdToken}`;

                try {
                    const pres = await fetch('/api/create_playlist', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({ uris })
                    });
                    const pdata = await pres.json();
                    if (pdata.success) {
                        createBtn.outerHTML = `<a href="${pdata.uri}:play" class="playlist-btn create-playlist-btn" style="background: var(--spotify-green); color: #000; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">Listen to Playlist 🎧</a>`;
                    } else {
                        if (pdata.error === "not_logged_in") {
                            alert("Your Spotify session expired. Please connect Spotify again.");
                            window.location.href = "/login";
                        } else {
                            createBtn.textContent = 'Failed';
                            console.error(pdata.error);
                        }
                    }
                } catch(e) {
                    createBtn.textContent = 'Error';
                    console.error(e);
                }
            });
        }
    }

    function getTimeAgo(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays === 1) return 'Yesterday';
        if (diffInDays < 7) return `${diffInDays}d ago`;
        return date.toLocaleDateString();
    }

    function renderSidebar(filterText = '') {
        chatHistoryList.innerHTML = '';
        const sessions = Object.keys(allSessions)
            .map(id => {
                const chats = allSessions[id];
                // Sort chats by timestamp
                chats.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
                const firstChat = chats[0];
                // Find the latest non-empty chat_title in this session
                let sessionTitle = '';
                for (let i = chats.length - 1; i >= 0; i--) {
                    if (chats[i].chat_title && chats[i].chat_title.trim() !== '') {
                        sessionTitle = chats[i].chat_title;
                        break;
                    }
                }
                return {
                    id,
                    chats,
                    title: sessionTitle,
                    mood: firstChat ? firstChat.mood : 'neutral',
                    timestamp: firstChat ? firstChat.timestamp : null
                };
            })
            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)); // Newest first

        sessions.forEach(session => {
            if (filterText && !session.title.toLowerCase().includes(filterText.toLowerCase())) return;

            const theme = getMoodTheme(session.mood);
            const hasTitle = session.title && session.title.trim() !== '';
            const titleSnippet = hasTitle
                ? (session.title.split(' ').slice(0, 5).join(' ') + (session.title.split(' ').length > 5 ? '...' : ''))
                : '• • •';

            const div = document.createElement('div');
            div.className = `chat-item ${session.id === currentSessionId ? 'active' : ''}`;
            div.innerHTML = `
                <div class="chat-icon">${theme.emoji}</div>
                <div class="chat-item-content">
                    <div class="chat-title" ${!hasTitle ? 'style="opacity: 0.4; font-style: italic;"' : ''}>${titleSnippet}</div>
                    <div class="chat-time">${getTimeAgo(session.timestamp)}</div>
                </div>
                <button class="chat-item-menu-btn" title="Options">⋮</button>
            `;
            
            div.addEventListener('click', (e) => {
                if (e.target.closest('.chat-item-menu-btn')) return; // handled separately if we add menu
                loadSession(session.id);
                if (window.innerWidth <= 768) sidebar.classList.remove('open');
            });

            chatHistoryList.appendChild(div);
        });
    }

    function loadSession(sessionId) {
        currentSessionId = sessionId;
        localStorage.setItem('activeSessionId', currentSessionId);
        const chats = allSessions[sessionId] || [];
        
        chatBox.innerHTML = '';
        chatBox.appendChild(typingIndicator);
        
        if (chats.length > 0) {
            document.body.classList.remove('landing-mode');
            document.body.classList.add('chat-mode');
            document.getElementById('chat-area').classList.remove('hidden');
            isFirstMessage = false;
            
            chats.forEach(chat => {
                appendMessage('user', chat.user_message);
                const html = buildBotContentHTML(chat);
                const msgDiv = appendMessage('bot', html, true, chat.mood || 'neutral');
                bindPlaylistButton(msgDiv, chat);
            });
        }
        renderSidebar(); // Update active state
    }

    async function fetchHistory() {
        if (!firebaseIdToken) return;
        try {
            const res = await fetch('/api/history', {
                headers: { 'Authorization': `Bearer ${firebaseIdToken}` }
            });
            const data = await res.json();
            
            allSessions = {}; // reset
            if (data.history && data.history.length > 0) {
                data.history.forEach(chat => {
                    const sid = chat.session_id || 'Legacy Chat';
                    if (!allSessions[sid]) allSessions[sid] = [];
                    allSessions[sid].push(chat);
                });

                const savedSessionId = localStorage.getItem('activeSessionId');
                if (savedSessionId && allSessions[savedSessionId]) {
                    loadSession(savedSessionId);
                } else {
                    renderSidebar();
                }
            } else {
                renderSidebar();
            }
        } catch(e) {
            console.error("Failed to load history", e);
        }
    }
});
