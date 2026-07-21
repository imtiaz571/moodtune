import { Play, ListPlus, Music2, Share2, Check } from "lucide-react";
import { Message, BotMessage } from "../../types";
import { MoodBadge } from "./MoodBadge";
import { TrackCard } from "../music/TrackCard";
import { useState } from "react";

export function MessageBubble({ msg, moodColor, onCreatePlaylist, onPlayAll }: { 
  msg: Message; 
  moodColor: string; 
  onCreatePlaylist: (uris: string[]) => Promise<string | undefined>;
  onPlayAll: (uris: string[], isDesktopClick: boolean) => void;
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
  const [playlistUrl, setPlaylistUrl] = useState<string | undefined>();
  const [isCreating, setIsCreating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleShare = async () => {
    if (!playlistUrl) return;
    const text = `MoodTunes just generated my playlist! 🎧\n${playlistUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "My MoodTunes Playlist", text });
      } catch (e) {
        console.error("Error sharing", e);
      }
    } else {
      navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="flex gap-3 max-w-[90%]">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
        style={{ background: moodColor + "22", border: `1px solid ${moodColor}44` }}>
        <Music2 size={13} style={{ color: moodColor }} />
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2">
          <MoodBadge mood={bot.mood} />
        </div>
        <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#e0e0f0" }}>
          {bot.text}
        </div>
        {tracks.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            {tracks.map((t) => <TrackCard key={t.id} track={t} moodColor={moodColor} />)}
            {typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onPlayAll(uris, false);
                }}
                className="flex w-full items-center justify-center gap-2 mt-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: `${moodColor}18`, color: moodColor, border: `1px solid ${moodColor}40` }}
                onMouseEnter={(e) => (e.currentTarget.style.background = `${moodColor}28`)}
                onMouseLeave={(e) => (e.currentTarget.style.background = `${moodColor}18`)}
              >
                <Play size={16} />
                Play all songs
              </button>
            ) : (
              <a
                href={uris.length > 0 ? `https://open.spotify.com/track/${uris[0].split(":")[2]}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (uris.length === 0) e.preventDefault();
                  onPlayAll(uris, true);
                }}
                className="flex w-full items-center justify-center gap-2 mt-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer block text-center"
                style={{ background: `${moodColor}18`, color: moodColor, border: `1px solid ${moodColor}40`, textDecoration: 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = `${moodColor}28`)}
                onMouseLeave={(e) => (e.currentTarget.style.background = `${moodColor}18`)}
              >
                <Play size={16} className="inline-block mr-1 -mt-0.5" />
                Play all songs
              </a>
            )}
            {!playlistUrl ? (
              <button
                onClick={async () => {
                  setIsCreating(true);
                  const url = await onCreatePlaylist(uris);
                  if (url) setPlaylistUrl(url);
                  setIsCreating(false);
                }}
                disabled={isCreating}
                className="flex items-center justify-center gap-2 mt-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "#1DB95418", color: "#1DB954", border: "1px solid #1DB95440" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1DB95428")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#1DB95418")}
              >
                <ListPlus size={16} />
                {isCreating ? "Creating..." : "Create Playlist on Spotify"}
              </button>
            ) : (
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 mt-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: "rgba(167,139,250,0.18)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.28)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(167,139,250,0.18)")}
              >
                {isCopied ? <Check size={16} /> : <Share2 size={16} />}
                {isCopied ? "Copied Link!" : "Share Playlist"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
