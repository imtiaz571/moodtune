import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { Track } from "../../types";
import { SpotifyIcon } from "../ui/Icons";

export function TrackCard({ track, moodColor }: { track: Track; moodColor: string }) {
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
