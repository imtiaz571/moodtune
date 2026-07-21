export type Mood =
  | "happy" | "chill" | "sad" | "energetic" | "romantic"
  | "focus" | "angry" | "anxious" | "melancholic"
  | "nostalgic" | "hopeful" | "lonely" | "confident" | "neutral";

export type Track = {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  previewUrl: string | null;
  spotifyUrl: string | null;
  uri: string | null;
  reason: string;
};

export type BotMessage = {
  id: string;
  role: "bot";
  text: string;
  mood: Mood;
  tracks?: Track[];
  timestamp: Date;
};

export type UserMessage = {
  id: string;
  role: "user";
  text: string;
  timestamp: Date;
};

export type Message = UserMessage | BotMessage;

export type Conversation = {
  sessionId: string;
  title: string;
  mood: Mood;
  date: string;
};

export type SpotifyUser = {
  id: string;
  name: string;
  image: string | null;
};

export type ToastType = "success" | "error" | "info";
export type Toast = { id: number; msg: string; type: ToastType; link?: string; linkText?: string };
