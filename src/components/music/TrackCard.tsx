import { useState, useRef, useEffect } from "react";
import { Play, Pause, ListPlus, Loader2, Check } from "lucide-react";
import { Track } from "../../types";
import { SpotifyIcon } from "../ui/Icons";
import { getUserPlaylists, addTrackToPlaylist, Playlist } from "../../lib/api";

export function TrackCard({ track, moodColor }: { track: Track; moodColor: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPlaylists(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPlaylists(!showPlaylists);
    if (!showPlaylists && playlists.length === 0) {
      setLoadingPlaylists(true);
      try {
        const data = await getUserPlaylists();
        setPlaylists(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPlaylists(false);
      }
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!track.uri) return;
    setAddingTo(playlistId);
    try {
      const res = await addTrackToPlaylist(playlistId, track.uri);
      if (res.success) {
        setAddedTo(playlistId);
        setTimeout(() => {
          setAddedTo(null);
          setShowPlaylists(false);
        }, 2000);
      } else {
        alert(res.error || "Failed to add track");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingTo(null);
    }
  };

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
          <div className="flex items-center gap-1 relative" ref={dropdownRef}>
            {track.uri && (
              <button
                onClick={handleAddClick}
                className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white/10 text-muted-foreground hover:text-white relative"
                title="Add to Playlist"
              >
                <ListPlus size={16} />
              </button>
            )}
            
            {showPlaylists && (
              <div className="absolute right-0 top-full mt-2 w-56 max-h-64 overflow-y-auto bg-card border border-white/10 rounded-xl shadow-2xl z-50 p-2 text-sm flex flex-col gap-1 custom-scrollbar">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Add to Playlist
                </div>
                {loadingPlaylists ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  </div>
                ) : playlists.length > 0 ? (
                  playlists.map(p => (
                    <button
                      key={p.id}
                      onClick={(e) => { e.stopPropagation(); handleAddToPlaylist(p.id); }}
                      disabled={addingTo === p.id || addedTo === p.id}
                      className="flex items-center gap-2 w-full text-left p-1.5 rounded-md hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      {p.image ? (
                        <img src={p.image} alt="" className="w-8 h-8 rounded bg-muted flex-shrink-0 object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex-shrink-0" />
                      )}
                      <span className="truncate flex-1">{p.name}</span>
                      {addingTo === p.id && <Loader2 size={14} className="animate-spin text-muted-foreground flex-shrink-0" />}
                      {addedTo === p.id && <Check size={14} className="text-green-500 flex-shrink-0" />}
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-muted-foreground text-xs">
                    No editable playlists found.
                  </div>
                )}
              </div>
            )}

            {track.spotifyUrl && (
              <a href={track.spotifyUrl} target="_blank" rel="noreferrer"
                className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white/10"
                style={{ color: "#1DB954" }} onClick={(e) => e.stopPropagation()}>
                <SpotifyIcon size={16} />
              </a>
            )}
          </div>
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
