# 🎵 MoodTunes

**MoodTunes** is an AI-powered music companion application that generates personalized music recommendations and creates Spotify playlists based on your mood, emotions, and natural conversations.

---

## ✨ Features

- 💬 **AI Conversational Interface**: Interactive chat powered by Google Gemini AI to analyze your mood, feelings, and musical preferences.
- 🎧 **Spotify Integration**: Full OAuth 2.0 integration with Spotify to search tracks, preview audio, and seamlessly save custom playlists directly to your Spotify account.
- 🔥 **Firebase Support**: Secure user management and session cloud storage.
- 🎨 **Modern Dark UI**: Fluid animations and sleek design built with React, Vite, Tailwind CSS, and Radix UI components.
- ⚡ **Full-Stack Vercel Ready**: Optimized for deployment with a Python Flask API backend and Vite frontend.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Radix UI, Lucide Icons, Framer Motion / Motion.
- **Backend**: Python 3.10+, Flask, Flask-CORS, Spotipy, Google GenAI SDK.
- **Database / Auth**: Firebase Admin SDK & Firestore.
- **APIs**: Google Gemini API, Spotify Web API.

---

## 🚀 Getting Started

### 1. Prerequisites

Make sure you have installed:
- [Node.js](https://nodejs.org/) (v18 or higher) & `npm` / `pnpm`
- [Python](https://www.python.org/) (v3.10 or higher)
- A [Spotify Developer Account](https://developer.spotify.com/dashboard)
- A [Google AI Studio API Key](https://aistudio.google.com/) (Gemini)

---

### 2. Spotify App Setup

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create a new application.
2. Under **Edit Settings**, add your Redirect URI:
   ```text
   http://127.0.0.1:5000/callback
   ```
3. Copy your **Client ID** and **Client Secret**.

---

### 3. Environment Configuration

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Fill in your variables in `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5000/callback
FLASK_SECRET_KEY=your_random_secret_key
FIREBASE_ADMIN_CREDENTIALS_JSON=optional_firebase_service_account_json
```

---

### 4. Installation

#### 📦 Frontend Dependencies
```bash
npm install
```

#### 🐍 Backend Dependencies
```bash
# Create virtual environment (optional but recommended)
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

# Install Python requirements
pip install -r requirements.txt
```

---

### 5. Running Locally

Start the backend and frontend dev servers in separate terminal tabs:

**Terminal 1 (Backend API):**
```bash
python api/index.py
```
*(Runs on `http://127.0.0.1:5000`)*

**Terminal 2 (Frontend UI):**
```bash
npm run dev
```
*(Runs on `http://localhost:5173`)*

Open your browser and navigate to `http://localhost:5173`.

---

## 📁 Project Structure

```text
MoodTunes/
├── api/                  # Python Flask API endpoints & services
│   ├── index.py          # Main Flask application entry point
│   ├── llama_service.py  # Gemini AI service integration logic
│   └── spotify_service.py# Spotify API OAuth & playlist logic
├── src/                  # React frontend codebase
│   ├── components/       # UI Components & Chat interfaces
│   ├── app/              # Main App components & routes
│   └── ...
├── public/               # Static assets
├── package.json          # Node dependencies and scripts
├── requirements.txt      # Python dependencies
├── vercel.json           # Vercel deployment configuration
└── README.md             # Project documentation
```

---

## 🌐 Deployment

This project is configured for deployment on **Vercel**.
- **Frontend**: Built via Vite (`npm run build`).
- **Backend**: Handled as a Python serverless function via `api/index.py` (configured in `vercel.json`).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).