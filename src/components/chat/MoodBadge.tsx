import { Sun, CloudRain, Heart, Zap, Flame, Sparkles, Clock, Music2 } from "lucide-react";
import React from "react";

export const MOOD_CONFIG: Record<string, { label: string; color: string; glow: string; bg: string; icon: React.ReactNode }> = {
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

export const DEFAULT_MOOD_CFG = MOOD_CONFIG["chill"];

export const getMoodCfg = (mood: string) => MOOD_CONFIG[mood] ?? DEFAULT_MOOD_CFG;

export function MoodBadge({ mood }: { mood: string }) {
  const cfg = getMoodCfg(mood);
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}
