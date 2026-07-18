from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import os
import json
from dotenv import load_dotenv
from gemini_service import GeminiService
from spotify_service import SpotifyService
import firebase_admin
from firebase_admin import credentials, firestore, auth
from functools import wraps

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev_secret_key")

gemini_service = GeminiService()
spotify_service = SpotifyService()

# Removed Firebase Admin initialization because user requested frontend-only Firebase

@app.route("/")
def index():
    firebase_config = {
        "apiKey": "AIzaSyDn2o1586RY3VfWUqXmgBlvDjUdAfU10DM",
        "authDomain": "moodtune-8257b.firebaseapp.com",
        "projectId": "moodtune-8257b",
        "storageBucket": "moodtune-8257b.firebasestorage.app",
        "messagingSenderId": "267972221517",
        "appId": "1:267972221517:web:038d5d614514918878da04",
        "measurementId": "G-QBK0KW116M"
    }
    return render_template("index.html", firebase_config=firebase_config)

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
        sp_client = None
        
        if token_info:
            sp_oauth = spotify_service.get_oauth_manager()
            if sp_oauth.is_token_expired(token_info):
                try:
                    token_info = sp_oauth.refresh_access_token(token_info['refresh_token'])
                    session["token_info"] = token_info
                except Exception as e:
                    print(f"Failed to refresh token: {e}")
                    session.pop("token_info", None)
                    token_info = None
                    
            if token_info:
                sp_client = spotify_service.get_client(token_info)
        
        tracks = []
        if mood_response.recommendations:
            for rec in mood_response.recommendations:
                track_data = {
                    "title": rec.title,
                    "artist": rec.artist,
                    "reason": rec.reason,
                    "uri": None,
                    "image_url": None,
                    "spotify_url": None,
                    "preview_url": None
                }
                
                # If logged in, search Spotify for the track
                if sp_client:
                    sp_match = spotify_service.search_track(sp_client, rec.title, rec.artist)
                    if sp_match:
                        track_data.update(sp_match)
                        
                tracks.append(track_data)
            
        response_data = {
            "reply": mood_response.reply,
            "mood": mood_response.detected_mood,
            "tracks": tracks
        }
        
        # Firestore saving removed (Frontend-only Firebase setup)
                
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Chat route error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/history", methods=["GET"])
def get_history():
    # History disabled because Firebase Admin is not set up
    return jsonify({"history": []})

@app.route("/api/create_playlist", methods=["POST"])
def create_playlist():
    token_info = session.get("token_info")
    if not token_info:
        return jsonify({"error": "not_logged_in", "success": False}), 401
        
    data = request.json
    uris = data.get("uris", [])
    
    if not uris:
        return jsonify({"error": "No tracks to add", "success": False}), 400
        
    if token_info:
        sp_oauth = spotify_service.get_oauth_manager()
        if sp_oauth.is_token_expired(token_info):
            try:
                token_info = sp_oauth.refresh_access_token(token_info['refresh_token'])
                session["token_info"] = token_info
            except Exception as e:
                print(f"Failed to refresh token: {e}")
                session.pop("token_info", None)
                return jsonify({"error": "not_logged_in", "success": False}), 401
                
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
