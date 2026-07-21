// Typed API wrappers for all MoodTunes backend endpoints.

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface BackendTrack {
  title: string;
  artist: string;
  reason: string;
  uri: string | null;
  image_url: string | null;
  spotify_url: string | null;
  preview_url: string | null;
}

export interface ChatResponse {
  reply: string;
  mood: string;
  chat_title: string;
  tracks: BackendTrack[] | null;
}

export async function sendChat(
  message: string,
  sessionId: string
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistoryDoc {
  session_id: string;
  chat_title: string;
  mood: string;
  user_message: string;
  reply: string;
  tracks: BackendTrack[];
  timestamp: string | null;
}

export async function fetchHistory(): Promise<HistoryDoc[]> {
  const res = await fetch("/api/history");
  if (!res.ok) return [];
  const data = await res.json();
  return data.history ?? [];
}

// ─── Delete chat ──────────────────────────────────────────────────────────────

export async function deleteChat(sessionId: string): Promise<void> {
  await fetch(`/api/chat/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

// ─── Rename chat ──────────────────────────────────────────────────────────────

export async function renameChat(
  sessionId: string,
  newTitle: string
): Promise<void> {
  await fetch(`/api/chat/${encodeURIComponent(sessionId)}/rename`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: newTitle }),
  });
}

// ─── Create playlist ──────────────────────────────────────────────────────────

export interface PlaylistResult {
  success: boolean;
  url?: string;
  uri?: string;
  error?: string;
}

export async function createPlaylist(uris: string[]): Promise<PlaylistResult> {
  const res = await fetch("/api/create_playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uris }),
  });
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`Server error (${res.status}). If running locally, ensure Python backend is running.`);
  }
}

// ─── Spotify auth status ──────────────────────────────────────────────────────

export async function getAuthStatus(): Promise<{ logged_in: boolean, user?: { id: string, name: string, image: string | null } }> {
  const res = await fetch("/api/auth_status");
  if (!res.ok) return { logged_in: false };
  return res.json();
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface Artist {
  id: string;
  name: string;
  image_url: string | null;
}

export interface UserProfile {
  age?: string;
  genre?: string;
  language?: string;
  favorite_artists?: Artist[];
  obscurity?: string;
  era?: string;
}

export async function searchArtist(query: string): Promise<Artist[]> {
  const res = await fetch(`/api/search_artist?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.artists || [];
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const res = await fetch("/api/profile");
  if (!res.ok) return null;
  const data = await res.json();
  // Return null if empty object
  if (Object.keys(data).length === 0) return null;
  return data as UserProfile;
}

export async function updateUserProfile(profile: UserProfile): Promise<boolean> {
  const res = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  return res.ok;
}

export async function playAllTracks(uris: string[], queueOnly = false): Promise<{ success: boolean; action?: string; error?: string; message?: string }> {
  const res = await fetch(`/api/play_all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uris, queue_only: queueOnly }),
  });
  
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`Server error (${res.status}). If running locally, ensure Python backend is running.`);
  }

  if (!res.ok) {
    const errorMsg = data.error || "Failed to play/queue tracks";
    // We construct a specific error so the frontend can catch "NO_ACTIVE_DEVICE" exactly.
    const err = new Error(errorMsg);
    err.name = data.error; 
    throw err;
  }
  return data;
}

// ─── Playlists ────────────────────────────────────────────────────────────────

export interface Playlist {
  id: string;
  name: string;
  image: string | null;
}

export async function getUserPlaylists(): Promise<Playlist[]> {
  const res = await fetch("/api/playlists");
  if (!res.ok) return [];
  const data = await res.json();
  return data.playlists || [];
}

export async function addTrackToPlaylist(playlistId: string, trackUri: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/playlists/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playlist_id: playlistId, track_uri: trackUri }),
  });
  
  let data;
  try {
    data = await res.json();
  } catch (e) {
    return { success: false, error: `Server error (${res.status})` };
  }
  return data;
}
