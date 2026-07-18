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

# Initialize Firebase Admin
firebase_creds_json = os.getenv("FIREBASE_ADMIN_CREDENTIALS_JSON")
db = None
if firebase_creds_json:
    try:
        cred_dict = json.loads(firebase_creds_json)
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase Admin initialized successfully.")
    except Exception as e:
        print(f"Failed to initialize Firebase Admin: {e}")
else:
    print("FIREBASE_ADMIN_CREDENTIALS_JSON not found. Firebase not initialized.")

def verify_firebase_token(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized'}), 401
        
        id_token = auth_header.split('Bearer ')[1]
        try:
            decoded_token = auth.verify_id_token(id_token)
            request.user = decoded_token
        except Exception as e:
            print(f"Token verification failed: {e}")
            return jsonify({'error': 'Invalid token'}), 401
            
        return f(*args, **kwargs)
    return decorated_function

@app.route("/")
def index():
    firebase_config = {
        "apiKey": os.getenv("FIREBASE_API_KEY", ""),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN", ""),
        "projectId": os.getenv("FIREBASE_PROJECT_ID", ""),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET", ""),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID", ""),
        "appId": os.getenv("FIREBASE_APP_ID", "")
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
@verify_firebase_token
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
        
        # Save to Firestore
        if db:
            try:
                uid = request.user.get('uid')
                chat_doc = {
                    "user_message": user_message,
                    "reply": response_data["reply"],
                    "mood": response_data["mood"],
                    "tracks": response_data["tracks"],
                    "timestamp": firestore.SERVER_TIMESTAMP
                }
                db.collection('users').document(uid).collection('chats').add(chat_doc)
            except Exception as e:
                print(f"Failed to save chat to Firestore: {e}")
                
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Chat route error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/history", methods=["GET"])
@verify_firebase_token
def get_history():
    if not db:
        return jsonify({"history": []})
        
    uid = request.user.get('uid')
    try:
        docs = db.collection('users').document(uid).collection('chats').order_by('timestamp').stream()
        history = []
        for doc in docs:
            data = doc.to_dict()
            if 'timestamp' in data and data['timestamp']:
                data['timestamp'] = data['timestamp'].isoformat()
            history.append(data)
        return jsonify({"history": history})
    except Exception as e:
        print(f"Failed to fetch history: {e}")
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
