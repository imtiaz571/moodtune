from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import os
from dotenv import load_dotenv
from gemini_service import GeminiService
from spotify_service import SpotifyService

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev_secret_key")

gemini_service = GeminiService()
spotify_service = SpotifyService()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/login")
def login():
    sp_oauth = spotify_service.get_oauth_manager()
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@app.route("/callback")
def callback():
    sp_oauth = spotify_service.get_oauth_manager()
    session.clear()
    code = request.args.get('code')
    try:
        token_info = sp_oauth.get_access_token(code)
        session["token_info"] = token_info
    except Exception as e:
        print("Error getting token:", e)
    return redirect(url_for("index"))

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))

@app.route("/api/auth_status")
def auth_status():
    token_info = session.get("token_info")
    return jsonify({"logged_in": token_info is not None})

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data.get("message")
    
    if not user_message:
        return jsonify({"error": "Empty message"}), 400
        
    try:
        # Get structured output from Gemini
        mood_response = gemini_service.get_mood_recommendation(user_message)
        
        if not mood_response:
            return jsonify({"error": "Failed to get response from Gemini"}), 500
            
        # Get Spotify client if logged in
        token_info = session.get("token_info")
        sp_client = spotify_service.get_client(token_info)
        
        tracks = []
        for rec in mood_response.recommendations:
            track_data = {
                "title": rec.title,
                "artist": rec.artist,
                "reason": rec.reason,
                "uri": None,
                "image_url": None,
                "spotify_url": None
            }
            
            # If logged in, search Spotify for the track
            if sp_client:
                sp_match = spotify_service.search_track(sp_client, rec.title, rec.artist)
                if sp_match:
                    track_data.update(sp_match)
                    
            tracks.append(track_data)
            
        return jsonify({
            "reply": mood_response.reply,
            "tracks": tracks
        })
        
    except Exception as e:
        print(f"Chat route error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/create_playlist", methods=["POST"])
def create_playlist():
    token_info = session.get("token_info")
    if not token_info:
        return jsonify({"error": "not_logged_in", "success": False}), 401
        
    data = request.json
    uris = data.get("uris", [])
    
    if not uris:
        return jsonify({"error": "No tracks to add", "success": False}), 400
        
    sp_client = spotify_service.get_client(token_info)
    
    try:
        # Generate a cool name using Gemini based on recent history
        # (For simplicity here, we can just ask Gemini for a quick name)
        # But to avoid another long request, let's use a static or basic dynamic name
        # A better way would be using a quick LLM call, let's do it:
        name = "MoodTunes Mix"
        description = "Created by MoodTunes AI."
        
        playlist_url = spotify_service.create_playlist(sp_client, name, description, uris)
        return jsonify({"success": True, "url": playlist_url})
        
    except Exception as e:
        print(f"Playlist creation error: {e}")
        return jsonify({"error": str(e), "success": False}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
