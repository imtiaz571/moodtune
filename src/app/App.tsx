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




export type SpotifyUser = {
  id: string;
  name: string;
  image: string | null;
};

// ─── Types ───────────────────────────────────────────────────────────────────


type Mood =
  | "happy" | "chill" | "sad" | "energetic" | "romantic"
  | "focus" | "angry" | "anxious" | "melancholic"
  | "nostalgic" | "hopeful" | "lonely" | "confident" | "neutral";

type Track = {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  previewUrl: string | null;
  spotifyUrl: string | null;
  uri: string | null;
  reason: string;
};

type BotMessage = {
  id: string;
  role: "bot";
  text: string;
  mood: Mood;
  tracks?: Track[];
  timestamp: Date;
};

type UserMessage = {
  id: string;
  role: "user";
  text: string;
  timestamp: Date;
};

type Message = UserMessage | BotMessage;

type Conversation = {
  sessionId: string;
  title: string;
  mood: Mood;
  date: string;
};

// ─── Mood config ─────────────────────────────────────────────────────────────

const MOOD_CONFIG: Record<string, { label: string; color: string; glow: string; bg: string; icon: React.ReactNode }> = {
  happy:      { label: "Happy",      color: "#fbbf24", glow: "rgba(251,191,36,0.18)",  bg: "rgba(251,191,36,0.12)",  icon: <Sun size={13} /> },
  chill:      { label: "Chill",      color: "#60a5fa", glow: "rgba(96,165,250,0.18)",  bg: "rgba(96,165,250,0.12)",  icon: <CloudRain size={13} /> },
  sad:        { label: "Melancholic",color: "#818cf8", glow: "rgba(129,140,248,0.18)", bg: "rgba(129,140,248,0.12)", icon: <Heart size={13} /> },
  melancholic:{ label: "Melancholic",color: "#818cf8", glow: "rgba(129,140,248,0.18)", bg: "rgba(129,140,248,0.12)", icon: <Heart size={13} /> },
  energetic:  { label: "Energetic",  color: "#f97316", glow: "rgba(249,115,22,0.22)",  bg: "rgba(249,115,22,0.12)",  icon: <Zap size={13} /> },
  romantic:   { label: "Romantic",   color: "#f43f5e", glow: "rgba(244,63,94,0.18)",   bg: "rgba(244,63,94,0.12)",   icon: <Flame size={13} /> },
  focus:      { label: "Focus",      color: "#34d399", glow: "rgba(52,211,153,0.18)",  bg: "rgba(52,211,153,0.12)",  icon: <Sparkles size={13} /> },
  angry:      { label: "Angry",      color: "#ef4444", glow: "rgba(239,68,68,0.22)",   bg: "rgba(239,68,68,0.12)",   icon: <Flame size={13} /> },
  anxious:    { label: "Anxious",    color: "#a78bfa", glow: "rgba(167,139,250,0.18)", bg: "rgba(167,139,250,0.12)", icon: <Zap size={13} /> },
  nostalgic:  { label: "Nostalgic",  color: "#fb923c", glow: "rgba(251,146,60,0.18)",  bg: "rgba(251,146,60,0.12)",  icon: <Clock size={13} /> },
  hopeful:    { label: "Hopeful",    color: "#4ade80", glow: "rgba(74,222,128,0.18)",  bg: "rgba(74,222,128,0.12)",  icon: <Sparkles size={13} /> },
  lonely:     { label: "Lonely",     color: "#94a3b8", glow: "rgba(148,163,184,0.18)", bg: "rgba(148,163,184,0.12)", icon: <Heart size={13} /> },
  confident:  { label: "Confident",  color: "#facc15", glow: "rgba(250,204,21,0.22)",  bg: "rgba(250,204,21,0.12)",  icon: <Sparkles size={13} /> },
  neutral:    { label: "Neutral",    color: "#64748b", glow: "rgba(100,116,139,0.15)", bg: "rgba(100,116,139,0.1)",  icon: <Music2 size={13} /> },
};

const DEFAULT_MOOD_CFG = MOOD_CONFIG["chill"];

const getMoodCfg = (mood: string) => MOOD_CONFIG[mood] ?? DEFAULT_MOOD_CFG;

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

// ─── WebGL Particle canvas ────────────────────────────────────────────────────

function ParticleCanvas({ moodColor }: { moodColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let W = (canvas.width = canvas.offsetWidth);
    let H = (canvas.height = canvas.offsetHeight);
    const onResize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; };
    window.addEventListener("resize", onResize);
    const NUM = 70;
    type P = { x: number; y: number; vx: number; vy: number; r: number; o: number; pulse: number };
    const particles: P[] = Array.from({ length: NUM }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5, o: Math.random() * 0.5 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    }));
    const WAVE_POINTS = 120;
    let t = 0;
    const hexToRgb = (hex: string) => ({ r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) });
    const rgb = hexToRgb(moodColor.startsWith("#") ? moodColor : "#60a5fa");
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.008;
      ctx.beginPath();
      for (let i = 0; i <= WAVE_POINTS; i++) {
        const x = (i / WAVE_POINTS) * W;
        const y = H * 0.6 + Math.sin(i * 0.08 + t) * 30 + Math.sin(i * 0.05 + t * 1.3) * 20 + Math.sin(i * 0.12 + t * 0.7) * 12;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`; ctx.lineWidth = 1.5; ctx.stroke();
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.pulse += 0.02;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        const pf = 0.8 + Math.sin(p.pulse) * 0.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * pf, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${p.o * pf})`; ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.06 * (1 - dist / 100)})`; ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", onResize); };
  }, [moodColor]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.6 }} />;
}

// ─── Spotify icon ─────────────────────────────────────────────────────────────

function SpotifyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

// ─── Google icon ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─── Toast notification ───────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";
type Toast = { id: number; msg: string; type: ToastType; link?: string; linkText?: string };

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2" style={{ pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium animate-bounce"
          style={{
            pointerEvents: "auto",
            background: t.type === "success" ? "rgba(52,211,153,0.15)" : t.type === "error" ? "rgba(239,68,68,0.15)" : "rgba(96,165,250,0.15)",
            border: `1px solid ${t.type === "success" ? "#34d39940" : t.type === "error" ? "#ef444440" : "#60a5fa40"}`,
            color: t.type === "success" ? "#34d399" : t.type === "error" ? "#ef4444" : "#60a5fa",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <span>{t.msg}</span>
          {t.link && (
            <a href={t.link} target="_blank" rel="noreferrer" className="underline flex items-center gap-1">
              {t.linkText ?? "Open"} <ExternalLink size={12} />
            </a>
          )}
          <button onClick={() => onRemove(t.id)} style={{ opacity: 0.6 }}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Track card ───────────────────────────────────────────────────────────────

function TrackCard({ track, moodColor }: { track: Track; moodColor: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (track.previewUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(track.previewUrl);
        audioRef.current.onended = () => { setPlaying(false); setProgress(0); };
        audioRef.current.ontimeupdate = () => {
          const dur = audioRef.current?.duration || 30;
          const cur = audioRef.current?.currentTime || 0;
          setProgress((cur / dur) * 100);
        };
      }
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setPlaying(true);
          }).catch((err) => {
            console.error("Audio playback error:", err);
            setPlaying(false);
            // Optionally, we could show a toast here if we passed it down.
            // For now, we just fail gracefully.
            alert("Audio preview could not be played. It might be blocked or unavailable.");
          });
        } else {
          setPlaying(true);
        }
      }
    }
  };

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, []);

  return (
    <div
      className="flex gap-3 p-3 rounded-xl transition-all duration-200 group cursor-default"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
    >
      {/* Album art */}
      <div className="relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-muted" style={{ boxShadow: playing ? `0 0 14px ${moodColor}55` : "none" }}>
        <img src={track.albumArt} alt={track.title} className="w-full h-full object-cover" />
        {track.previewUrl && (
          <>
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center transition-opacity"
              style={{ background: "rgba(0,0,0,0.4)", opacity: playing ? 1 : 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => { if (!playing) e.currentTarget.style.opacity = "0"; }}
            >
              {playing ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white" fill="white" />}
            </button>
            {playing && (
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="26" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                <circle cx="28" cy="28" r="26" fill="none" stroke={moodColor} strokeWidth="2"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (1 - progress / 100)}`}
                  strokeLinecap="round" transform="rotate(-90 28 28)"
                  style={{ transition: "stroke-dashoffset 0.9s linear" }}
                />
              </svg>
            )}
          </>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{track.title}</p>
            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
          </div>
          {track.spotifyUrl && (
            <a href={track.spotifyUrl} target="_blank" rel="noreferrer"
              className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:opacity-80"
              style={{ color: "#1DB954" }} onClick={(e) => e.stopPropagation()}>
              <SpotifyIcon size={15} />
            </a>
          )}
        </div>
        <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: moodColor, opacity: 0.85 }}>{track.reason}</p>
        {playing && (
          <div className="mt-2 h-0.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: moodColor, transition: "width 0.9s linear" }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mood badge ───────────────────────────────────────────────────────────────

function MoodBadge({ mood }: { mood: string }) {
  const cfg = getMoodCfg(mood);
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-sm w-fit" style={{ background: "rgba(255,255,255,0.07)" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-2 h-2 rounded-full animate-bounce"
          style={{ background: "#a78bfa", animationDelay: `${i * 0.18}s`, animationDuration: "0.9s" }} />
      ))}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, moodColor, onCreatePlaylist, onPlayAll }: { 
  msg: Message; 
  moodColor: string; 
  onCreatePlaylist: (uris: string[]) => void;
  onPlayAll: (uris: string[]) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed"
          style={{ background: "rgba(167,139,250,0.18)", color: "#f0f0f8", border: "1px solid rgba(167,139,250,0.2)" }}>
          {msg.text}
        </div>
      </div>
    );
  }

  const bot = msg as BotMessage;
  const tracks = bot.tracks ?? [];
  const uris = tracks.map((t) => t.uri).filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-3 max-w-[90%]">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: moodColor + "22", border: `1px solid ${moodColor}44` }}>
          <Music2 size={13} style={{ color: moodColor }} />
        </div>
        <MoodBadge mood={bot.mood} />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#e0e0f0" }}>
        {bot.text}
      </div>
      {tracks.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          {tracks.map((t) => <TrackCard key={t.id} track={t} moodColor={moodColor} />)}
          <button
            onClick={() => onPlayAll(uris)}
            className="flex items-center justify-center gap-2 mt-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: `${moodColor}18`, color: moodColor, border: `1px solid ${moodColor}40` }}
            onMouseEnter={(e) => (e.currentTarget.style.background = `${moodColor}28`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = `${moodColor}18`)}
          >
            <Play size={16} />
            Play all songs
          </button>
          <button
            onClick={() => onCreatePlaylist(uris)}
            className="flex items-center justify-center gap-2 mt-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: "#1DB95418", color: "#1DB954", border: "1px solid #1DB95440" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1DB95428")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1DB95418")}
          >
            <ListPlus size={16} />
            Create Playlist on Spotify
          </button>
        </div>
      )}
    </div>
  );
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

  const handlePlayAll = (uris: string[]) => {
    if (!spotifyLoggedIn) {
      addToast("Connect Spotify first.", "error");
      window.location.href = "/login";
      return;
    }
    if (uris.length === 0) {
      addToast("No Spotify tracks available to play.", "error");
      return;
    }

    addToast("Opening Spotify Web Player...", "info");
    
    // Convert spotify:track:ID to https://open.spotify.com/track/ID
    const trackId = uris[0].split(":")[2];
    const webUrl = `https://open.spotify.com/track/${trackId}`;
    
    // Open Spotify Web in a new tab
    window.open(webUrl, '_blank');
    
    // Wait for the app to become the active device, then queue the rest
    let attempts = 0;
    const tryQueue = async () => {
      if (uris.length <= 1) return;
      attempts++;
      try {
        await playAllTracks(uris.slice(1), true);
        addToast("Remaining songs added to your queue!", "success");
      } catch (queueErr: any) {
        if (attempts < 10) {
          setTimeout(tryQueue, 3000); // Retry after 3 seconds
        } else {
          addToast(queueErr.message || "Failed to queue remaining songs.", "error");
        }
      }
    };
    setTimeout(tryQueue, 4000);
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
    <div className="flex h-screen w-screen overflow-hidden relative" style={{ fontFamily: "'Inter', sans-serif", background: "#08080f" }}>
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
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:bg-accent active:scale-95"
                style={{ background: "rgba(255,255,255,0.07)", color: "#f0f0f8", border: "1px solid rgba(255,255,255,0.1)" }}>
                <SpotifyIcon size={14} /> Log in with Spotify
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-2 px-2 py-1.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {currentUser.image && (
                  <img src={currentUser.image} alt={currentUser.name ?? "User"}
                    className="w-5 h-5 rounded-full object-cover" />
                )}
                <span className="text-xs text-foreground">{currentUser.name?.split(" ")[0]}</span>
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
