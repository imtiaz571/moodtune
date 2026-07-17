document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');
    const typingIndicator = document.getElementById('typing-indicator');
    const sendBtn = document.getElementById('send-btn');
    const spotifyAuthContainer = document.getElementById('spotify-auth-container');
    
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

    function appendMessage(sender, text, isHtml = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message fade-in`;
        
        const avatar = document.createElement('div');
        avatar.className = `avatar ${sender}-avatar`;
        avatar.textContent = sender === 'bot' ? '🤖' : 'U';
        
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
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
        // Collect URIs from the current recommendation block
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

            // Create bot message container
            let botContent = `<p>${data.reply}</p>`;
            
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
                        card.style.opacity = '0.6'; // Dim if no match found
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
                    
                    const audioEl = clone.querySelector('.track-preview');
                    if (audioEl) {
                        if (track.preview_url) {
                            audioEl.src = track.preview_url;
                            audioEl.style.display = 'block';
                        } else {
                            audioEl.style.display = 'none';
                        }
                    }
                    
                    // We can't append Node directly to HTML string, so we construct the HTML
                    const tmp = document.createElement('div');
                    tmp.appendChild(clone);
                    botContent += tmp.innerHTML;
                });
                
                botContent += `<div class="playlist-controls"><button class="playlist-btn" onclick="createPlaylist(this)">Create Spotify Playlist</button></div>`;
                botContent += `</div>`;
            }

            appendMessage('bot', botContent, true);
            
        } catch (err) {
            hideTyping();
            appendMessage('bot', `<span class="error-text">Network error occurred.</span>`, true);
            console.error(err);
        }
        
        sendBtn.disabled = false;
        userInput.focus();
    });
});
