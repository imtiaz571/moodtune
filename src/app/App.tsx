import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus, Search, Music2, Send, Mic,
  PanelLeftClose, PanelLeftOpen, Menu,
  Play, Pause, ListPlus, Sparkles, Clock, Heart,
  Zap, CloudRain, Sun, Flame, Trash2, Pencil, Check, X,
  ExternalLink, LogOut, Settings,
} from "lucide-react";
import {
  sendChat,
  fetchHistory,
  deleteChat,
  renameChat,
  createPlaylist,
  getAuthStatus,
  BackendTrack,
  HistoryDoc,
  getUserProfile,
  updateUserProfile,
  UserProfile,
  playAllTracks,
} from "../lib/api";




import { SpotifyUser, Mood, Track, BotMessage, UserMessage, Message, Conversation, ToastType, Toast } from "../types";
import { getMoodCfg, MOOD_CONFIG } from "../components/chat/MoodBadge";
import { GoogleIcon, SpotifyIcon } from "../components/ui/Icons";
import { ToastContainer } from "../components/ui/ToastContainer";
import { ParticleCanvas } from "../components/music/ParticleCanvas";
import { TypingDots } from "../components/chat/TypingDots";
import { MessageBubble } from "../components/chat/MessageBubble";

const MOOD_PRESETS = [
  { mood: "happy",    prompt: "I'm feeling happy and upbeat today!",     emoji: "☀️" },
  { mood: "chill",    prompt: "I want something calm and relaxed.",       emoji: "🌊" },
  { mood: "energetic",prompt: "Pump me up with high-energy tracks!",     emoji: "⚡" },
  { mood: "sad",      prompt: "I'm in a melancholic, reflective mood.",   emoji: "🌙" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapBackendTracks(backendTracks: BackendTrack[] | null): Track[] {
  if (!backendTracks) return [];
  return backendTracks.map((t, i) => ({
    id: `${t.title}-${i}`,
    title: t.title,
    artist: t.artist,
    albumArt: t.image_url ?? `https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop&auto=format`,
    previewUrl: t.preview_url,
    spotifyUrl: t.spotify_url,
    uri: t.uri,
    reason: t.reason,
  }));
}

function groupHistoryBySession(docs: HistoryDoc[]): Conversation[] {
  const seen = new Map<string, Conversation>();
  // Iterate in order so the first-seen title for each session is kept
  docs.forEach((doc) => {
    if (!seen.has(doc.session_id) && doc.chat_title) {
      seen.set(doc.session_id, {
        sessionId: doc.session_id,
        title: doc.chat_title,
        mood: (doc.mood as Mood) || "neutral",
        date: doc.timestamp
          ? new Date(doc.timestamp).toLocaleDateString()
          : "Unknown",
      });
    }
  });
  return Array.from(seen.values()).reverse();
}

function buildMessagesFromHistory(docs: HistoryDoc[], sessionId: string): Message[] {
  const filtered = docs.filter((d) => d.session_id === sessionId);
  const msgs: Message[] = [];
  filtered.forEach((doc, i) => {
    msgs.push({
      id: `user-${i}`,
      role: "user",
      text: doc.user_message,
      timestamp: doc.timestamp ? new Date(doc.timestamp) : new Date(),
    });
    msgs.push({
      id: `bot-${i}`,
      role: "bot",
      text: doc.reply,
      mood: (doc.mood as Mood) || "neutral",
      tracks: mapBackendTracks(doc.tracks ?? []),
      timestamp: doc.timestamp ? new Date(doc.timestamp) : new Date(),
    });
  });
  return msgs;
}



// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  // Auth state
  
  const [currentUser, setCurrentUser] = useState<SpotifyUser | null>(null);
  const [spotifyLoggedIn, setSpotifyLoggedIn] = useState(false);

  // Chat state
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentMood, setCurrentMood] = useState("chill");
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [isSending, setIsSending] = useState(false);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [historyDocs, setHistoryDocs] = useState<HistoryDoc[]>([]);

  // Profile state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempProfile, setTempProfile] = useState<UserProfile>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounterRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const moodCfg = getMoodCfg(currentMood);

  // ─── Toast helpers ────────────────────────────────────────────────────────

  const addToast = useCallback((msg: string, type: ToastType = "info", link?: string, linkText?: string) => {
    const id = ++toastCounterRef.current;
    setToasts((prev) => [...prev, { id, msg, type, link, linkText }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Init Auth ─────────────────────────────────────────────────

  useEffect(() => {
    getAuthStatus().then((status) => {
      setSpotifyLoggedIn(status.logged_in);
      if (status.logged_in && status.user) {
        setCurrentUser(status.user);
        loadHistory();
        getUserProfile().then(profile => {
          setUserProfile(profile);
          if (!profile || Object.keys(profile).length === 0) {
            setTempProfile({});
            setShowSettingsModal(true);
          }
        }).catch(e => console.error("Failed to load profile:", e));
      } else {
        setCurrentUser(null);
        setConversations([]);
        setHistoryDocs([]);
        setUserProfile(null);
      }
    });
  }, []);

  // ─── Scroll to bottom ─────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ─── Load history ─────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    try {
      const docs = await fetchHistory();
      setHistoryDocs(docs);
      setConversations(groupHistoryBySession(docs));
    } catch (e) {
      console.error("History load failed:", e);
    }
  }, []);

  // ─── Sign in / out ────────────────────────────────────────────────────────

  const handleSpotifySignIn = () => {
    window.location.href = "/login";
  };

  const handleSignOut = () => {
    window.location.href = "/logout";
  };

  // ─── Send message ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isSending) return;

    if (!currentUser) {
      addToast("Please sign in with Google to chat.", "error");
      return;
    }

    if (!chatStarted) setChatStarted(true);
    setMobileSidebarOpen(false);
    setIsSending(true);

    const userMsg: UserMessage = { id: Date.now().toString(), role: "user", text: text.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsTyping(true);

    try {
      const data = await sendChat(text.trim(), sessionId);

      const mood = data.mood || "neutral";
      setCurrentMood(mood);

      const botMsg: BotMessage = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        text: data.reply,
        mood: mood as Mood,
        tracks: mapBackendTracks(data.tracks),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);

      // Update sidebar if a title was returned
      if (data.chat_title) {
        await loadHistory();
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      addToast(`Error: ${errorMsg}`, "error");
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "bot",
        text: "Sorry, I ran into an error. Please try again.",
        mood: "neutral" as Mood,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
      setIsSending(false);
    }
  }, [chatStarted, isSending, currentUser, sessionId, addToast, loadHistory]);

  // ─── New chat ─────────────────────────────────────────────────────────────

  const startNewChat = useCallback(async () => {
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    setMessages([]);
    setChatStarted(false);
    setActiveSessionId(null);
    setCurrentMood("chill");
    setMobileSidebarOpen(false);

    // Clear Gemini history on server
    if (currentUser) {
      fetch("/api/chat/clear", { method: "POST" }).catch(() => {});
    }
  }, [currentUser]);

  // ─── Load chat session ────────────────────────────────────────────────────

  const loadChatSession = (sid: string) => {
    setActiveSessionId(sid);
    setSessionId(sid);
    const msgs = buildMessagesFromHistory(historyDocs, sid);
    setMessages(msgs);
    setChatStarted(msgs.length > 0);
    setMobileSidebarOpen(false);
    if (msgs.length > 0) {
      const lastBot = [...msgs].reverse().find((m) => m.role === "bot") as BotMessage | undefined;
      if (lastBot) setCurrentMood(lastBot.mood);
    }
  };

  // ─── Delete chat ──────────────────────────────────────────────────────────

  const handleDeleteChat = async (sid: string) => {
    try {
      await deleteChat(sid);
      setConversations((prev) => prev.filter((c) => c.sessionId !== sid));
      setHistoryDocs((prev) => prev.filter((d) => d.session_id !== sid));
      if (activeSessionId === sid) startNewChat();
      addToast("Chat deleted.", "info");
    } catch {
      addToast("Failed to delete chat.", "error");
    }
  };

  // ─── Rename chat ──────────────────────────────────────────────────────────

  const handleRenameConfirm = async (sid: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    try {
      await renameChat(sid, renameValue.trim());
      setConversations((prev) =>
        prev.map((c) => c.sessionId === sid ? { ...c, title: renameValue.trim() } : c)
      );
      addToast("Chat renamed.", "success");
    } catch {
      addToast("Failed to rename chat.", "error");
    } finally {
      setRenamingId(null);
      setRenameValue("");
    }
  };

  // ─── Create playlist ──────────────────────────────────────────────────────

  const handleCreatePlaylist = async (uris: string[]) => {
    if (!spotifyLoggedIn) {
      addToast("Connect Spotify first to create a playlist.", "error");
      window.location.href = "/login";
      return;
    }
    if (uris.length === 0) {
      addToast("No Spotify tracks available for this playlist.", "error");
      return;
    }
    try {
      addToast("Creating playlist…", "info");
      const result = await createPlaylist(uris);
      if (result.success && result.url) {
        addToast("Playlist created!", "success", result.url, "Open in Spotify");
      } else if (result.error === "not_logged_in") {
        addToast("Connect Spotify first.", "error");
        window.location.href = "/login";
      } else {
        addToast("Failed to create playlist.", "error");
      }
    } catch {
      addToast("Failed to create playlist.", "error");
    }
  };

  const handlePlayAll = async (uris: string[], isDesktopClick: boolean) => {
    if (!spotifyLoggedIn) {
      addToast("Connect Spotify first.", "error");
      window.location.href = "/login";
      return;
    }
    if (uris.length === 0) {
      addToast("No Spotify tracks available to play.", "error");
      return;
    }

    if (isDesktopClick) {
      addToast("Opening Spotify Web Player...", "info");
      let attempts = 0;
      const tryQueue = async () => {
        if (uris.length <= 1) return;
        attempts++;
        try {
          await playAllTracks(uris.slice(1), true);
          addToast("Remaining songs added to your queue!", "success");
        } catch (queueErr: any) {
          if (attempts < 10) {
            setTimeout(tryQueue, 3000);
          } else {
            addToast("Failed to queue remaining songs.", "error");
          }
        }
      };
      setTimeout(tryQueue, 4000);
      return;
    }

    try {
      addToast("Starting playback...", "info");
      await playAllTracks(uris, false);
      addToast("Playing on your active device!", "success");
    } catch (err: any) {
      if (err.name === "NO_ACTIVE_DEVICE" || err.message === "NO_ACTIVE_DEVICE") {
        addToast("Opening Spotify to wake up device...", "info");
        window.location.href = `spotify:track:${uris[0].split(":")[2]}`;
        
        let attempts = 0;
        const retryPlayback = async () => {
          attempts++;
          try {
            await playAllTracks(uris, false);
            addToast("Playing on your active device!", "success");
          } catch (retryErr: any) {
            if (attempts < 6) {
              setTimeout(retryPlayback, 2500);
            } else {
              addToast("Could not find active Spotify device. Try pressing play manually.", "error");
            }
          }
        };
        setTimeout(retryPlayback, 3000);
      } else {
        addToast(err.message || "Failed to start playback.", "error");
      }
    }
  };

  // ─── Keyboard handler ─────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  // ─── Sidebar content ──────────────────────────────────────────────────────

  const filteredConvs = conversations.filter(
    (c) => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Actions */}
      <div className="px-3 pt-4 pb-3 flex items-center justify-end flex-shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={startNewChat} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="New chat">
            <Plus size={16} />
          </button>
          <button onClick={() => { setSidebarOpen(false); setMobileSidebarOpen(false); }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Search size={13} className="text-muted-foreground flex-shrink-0" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..." className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground text-xs" />
        </div>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto px-2 pb-4" style={{ scrollbarWidth: "none" }}>
        {!currentUser ? (
          <p className="text-[11px] text-muted-foreground text-center mt-6 px-4">Sign in to see your chat history</p>
        ) : filteredConvs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center mt-6 px-4">No chats yet. Start a conversation!</p>
        ) : (
          filteredConvs.map((c) => {
            const cfg = getMoodCfg(c.mood);
            const isActive = activeSessionId === c.sessionId;
            const isRenaming = renamingId === c.sessionId;

            return (
              <div key={c.sessionId} className="group flex items-center gap-1 mb-0.5">
                {isRenaming ? (
                  <div className="flex-1 flex items-center gap-1 px-2 py-1.5">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRenameConfirm(c.sessionId); if (e.key === "Escape") setRenamingId(null); }}
                      className="flex-1 bg-transparent outline-none text-xs text-foreground border-b border-white/20"
                    />
                    <button onClick={() => handleRenameConfirm(c.sessionId)} className="p-1 text-green-400 hover:text-green-300"><Check size={13} /></button>
                    <button onClick={() => setRenamingId(null)} className="p-1 text-muted-foreground hover:text-foreground"><X size={13} /></button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => loadChatSession(c.sessionId)}
                      className="flex-1 flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-all"
                      style={{ background: isActive ? "rgba(255,255,255,0.08)" : "transparent" }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate flex-1">{c.title}</span>
                    </button>
                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                      <button onClick={() => { setRenamingId(c.sessionId); setRenameValue(c.title); }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDeleteChat(c.sessionId)}
                        className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>


    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden relative" style={{ fontFamily: "'Inter', sans-serif", background: "#08080f" }}>
      {/* Animated canvas background */}
      <ParticleCanvas moodColor={moodCfg.color} />

      {/* Mood glow blob */}
      <div className="absolute pointer-events-none transition-all duration-1000" style={{
        width: 600, height: 600, borderRadius: "50%",
        background: `radial-gradient(circle, ${moodCfg.glow} 0%, transparent 70%)`,
        top: "50%", left: "50%", transform: "translate(-50%, -50%)", filter: "blur(60px)",
      }} />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden relative z-10"
        style={{
          width: sidebarOpen ? 240 : 0,
          background: "rgba(13,13,24,0.92)",
          borderRight: sidebarOpen ? "1px solid rgba(255,255,255,0.06)" : "none",
          backdropFilter: "blur(20px)",
        }}>
        <div style={{ width: 240 }}><SidebarContent /></div>
      </aside>

      {/* Mobile Sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 flex flex-col"
            style={{ width: 260, background: "rgba(13,13,24,0.98)", backdropFilter: "blur(20px)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: "rgba(8,8,15,0.7)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors mr-1">
              <Menu size={18} />
            </button>
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="hidden md:flex p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors mr-1">
                <PanelLeftOpen size={18} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: moodCfg.color + "22", border: `1px solid ${moodCfg.color}44`, transition: "all 0.5s" }}>
                <Music2 size={14} style={{ color: moodCfg.color }} />
              </div>
              <span className="font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>MoodTunes</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!currentUser ? (
              <button onClick={handleSpotifySignIn}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:bg-accent active:scale-95"
                style={{ background: "rgba(255,255,255,0.07)", color: "#f0f0f8", border: "1px solid rgba(255,255,255,0.1)" }}>
                <SpotifyIcon size={14} /> <span className="hidden sm:inline">Log in with Spotify</span><span className="sm:hidden">Log in</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {currentUser.image && (
                  <img src={currentUser.image} alt={currentUser.name ?? "User"}
                    className="w-5 h-5 rounded-full object-cover" />
                )}
                <span className="text-xs text-foreground hidden sm:inline">{currentUser.name?.split(" ")[0]}</span>
                <button onClick={() => { setTempProfile(userProfile || {}); setShowSettingsModal(true); }} className="p-0.5 ml-1 text-muted-foreground hover:text-foreground transition-colors" title="Settings">
                  <Settings size={13} />
                </button>
                <button onClick={handleSignOut} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors" title="Sign out">
                  <LogOut size={13} />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Chat / Landing */}
        <main className="flex-1 overflow-y-auto relative" style={{ scrollbarWidth: "none" }}>
          {!chatStarted ? (
            /* Landing */
            <div className="flex flex-col items-center justify-center min-h-full px-4 py-12">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: moodCfg.color + "18", border: `1px solid ${moodCfg.color}44`, boxShadow: `0 0 40px ${moodCfg.color}22` }}>
                <Music2 size={28} style={{ color: moodCfg.color }} />
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-3 leading-tight"
                style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.02em", color: "#f0f0f8" }}>
                What's your mood<br />
                <span style={{ color: moodCfg.color }}>right now?</span>
              </h1>
              <p className="text-muted-foreground text-center text-sm mb-10 max-w-sm">
                Tell me how you feel and I'll find the perfect soundtrack for this moment.
              </p>
              {!currentUser && (
                <div className="mb-8 px-5 py-3 rounded-2xl text-sm text-center"
                  style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa", maxWidth: 360 }}>
                  💡 <button onClick={handleSpotifySignIn} className="underline font-semibold">Log in with Spotify</button> to save your chat history and get personalized recommendations.
                </div>
              )}
              {/* Mood presets */}
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {MOOD_PRESETS.map((p) => {
                  const cfg = getMoodCfg(p.mood);
                  return (
                    <button key={p.mood} onClick={() => sendMessage(p.prompt)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33`, boxShadow: `0 0 20px ${cfg.color}11` }}>
                      <span>{p.emoji}</span> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Chat */
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} moodColor={moodCfg.color} onCreatePlaylist={handleCreatePlaylist} onPlayAll={handlePlayAll} />
              ))}
              {isTyping && (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: moodCfg.color + "22", border: `1px solid ${moodCfg.color}44` }}>
                    <Music2 size={13} style={{ color: moodCfg.color }} />
                  </div>
                  <TypingDots />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input bar */}
        <div className="flex-shrink-0 px-4 pb-5 pt-3"
          style={{ background: "rgba(8,8,15,0.7)", borderTop: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}>
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-3 px-4 py-3 rounded-2xl transition-all duration-300"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${input ? moodCfg.color + "44" : "rgba(255,255,255,0.09)"}`,
                boxShadow: input ? `0 0 20px ${moodCfg.color}18` : "none",
              }}>
              <textarea ref={textareaRef} value={input} onChange={handleTextareaChange} onKeyDown={handleKeyDown}
                placeholder={currentUser ? (chatStarted ? "How are you feeling now?" : "Describe your mood or ask for music...") : "Sign in to start chatting..."}
                disabled={!currentUser || isSending}
                rows={1}
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder-muted-foreground resize-none leading-relaxed disabled:opacity-50"
                style={{ maxHeight: 160, minHeight: 24 }}
              />
              <div className="flex items-center gap-2 flex-shrink-0 pb-0.5">
                <button className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <Mic size={16} />
                </button>
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || !currentUser || isSending}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
                  style={{
                    background: input.trim() && currentUser ? moodCfg.color : "rgba(255,255,255,0.1)",
                    color: input.trim() && currentUser ? "#08080f" : "#6b6b8a",
                    boxShadow: input.trim() && currentUser ? `0 0 16px ${moodCfg.color}55` : "none",
                  }}>
                  <Send size={14} />
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-2">
              MoodTunes uses Gemini AI to match your emotions to music. Preview tracks before adding to Spotify.
            </p>
          </div>
        </div>
      </div>
      
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 relative" style={{ background: "rgba(13,13,24,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <button onClick={() => { if(userProfile) setShowSettingsModal(false); }} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-white/5">
              <X size={18} />
            </button>
            <h2 className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Your Profile</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">Tell us about yourself so we can personalize your mood recommendations without having to ask you every time.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Age</label>
                <input type="text" placeholder="e.g. 24" value={tempProfile.age || ""} onChange={e => setTempProfile({...tempProfile, age: e.target.value})} className="w-full px-3 py-2.5 rounded-xl text-sm bg-black/40 border border-white/10 text-foreground outline-none focus:border-white/20 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Preferred Language</label>
                <input type="text" placeholder="e.g. English, Spanish, Hindi" value={tempProfile.language || ""} onChange={e => setTempProfile({...tempProfile, language: e.target.value})} className="w-full px-3 py-2.5 rounded-xl text-sm bg-black/40 border border-white/10 text-foreground outline-none focus:border-white/20 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Music Taste / Genres</label>
                <input type="text" placeholder="e.g. Pop, Lofi, Rock" value={tempProfile.genre || ""} onChange={e => setTempProfile({...tempProfile, genre: e.target.value})} className="w-full px-3 py-2.5 rounded-xl text-sm bg-black/40 border border-white/10 text-foreground outline-none focus:border-white/20 transition-colors" />
              </div>
            </div>

            <button 
              onClick={async () => {
                setIsSavingProfile(true);
                const success = await updateUserProfile(tempProfile);
                setIsSavingProfile(false);
                if (success) {
                  setUserProfile(tempProfile);
                  setShowSettingsModal(false);
                  addToast("Profile saved!", "success");
                } else {
                  addToast("Failed to save profile.", "error");
                }
              }}
              disabled={isSavingProfile}
              className="w-full mt-7 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: moodCfg.color, color: "#000" }}
            >
              {isSavingProfile ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
