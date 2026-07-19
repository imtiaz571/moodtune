// Typed API wrappers for all MoodTunes backend endpoints.
// Each function attaches the Firebase ID token as a Bearer token.

import { getFirebaseAuth } from "./firebase";

async function getIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getIdToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

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
  const res = await authFetch("/api/chat", {
    method: "POST",
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
  const res = await authFetch("/api/history");
  if (!res.ok) return [];
  const data = await res.json();
  return data.history ?? [];
}

// ─── Delete chat ──────────────────────────────────────────────────────────────

export async function deleteChat(sessionId: string): Promise<void> {
  await authFetch(`/api/chat/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

// ─── Rename chat ──────────────────────────────────────────────────────────────

export async function renameChat(
  sessionId: string,
  newTitle: string
): Promise<void> {
  await authFetch(`/api/chat/${encodeURIComponent(sessionId)}/rename`, {
    method: "PUT",
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
  return res.json();
}

// ─── Spotify auth status ──────────────────────────────────────────────────────

export async function getAuthStatus(): Promise<{ logged_in: boolean }> {
  const res = await fetch("/api/auth_status");
  if (!res.ok) return { logged_in: false };
  return res.json();
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  age?: string;
  genre?: string;
  language?: string;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const res = await authFetch("/api/profile");
  if (!res.ok) return null;
  const data = await res.json();
  // Return null if empty object
  if (Object.keys(data).length === 0) return null;
  return data as UserProfile;
}

export async function updateUserProfile(profile: UserProfile): Promise<boolean> {
  const res = await authFetch("/api/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
  return res.ok;
}

export async function playAllTracks(uris: string[]): Promise<{ success: boolean; action?: string; error?: string }> {
  const res = await fetch(`${API_URL}/api/play_all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uris }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to play/queue tracks");
  }
  return data;
}
