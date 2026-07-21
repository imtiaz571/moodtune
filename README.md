# MoodTunes

A chatbot web app that integrates Llama AI (for natural conversation and music recommendations) and Spotify (for searching tracks and creating playlists).

## Features
- **Conversational UI**: A sleek, dark-themed chat interface.
- **AI Recommendations**: Powered by NVIDIA's Llama 3.1 8B Instruct, it understands your mood and suggests tracks.
- **Spotify Integration**: Logs in using OAuth 2.0 to search for tracks and build a playlist directly on your Spotify account.

## Setup Instructions

### 1. Prerequisites
- Node.js & npm installed
- Python 3.10+ installed
- A [NVIDIA Developer](https://build.nvidia.com/) account for an NVIDIA API key.
- A [Spotify Developer](https://developer.spotify.com/dashboard) account.

### 2. Spotify App Configuration
1. Go to your Spotify Developer Dashboard and create an app.
2. Under the app's settings, add the following as a **Redirect URI**:
   `http://127.0.0.1:5000/callback`
   *(Ensure it is exactly this, not localhost).*
3. Note down your `Client ID` and `Client Secret`.

### 3. Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```
Update `.env` with:
- `NVIDIA_API_KEY`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

### 4. Install Dependencies

**Frontend (React/Vite)**
```bash
npm install
```

**Backend (Python)**
```bash
python -m venv venv
source venv/Scripts/activate  # On Windows PowerShell
pip install -r requirements.txt
```

### 5. Run the App

**Frontend**
```bash
npm run dev
```

**Backend**
```bash
python api/index.py
```