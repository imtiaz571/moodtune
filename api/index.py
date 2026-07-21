from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
import os
import sys
import json
from datetime import timedelta
from dotenv import load_dotenv

# Fix path for Vercel serverless deployment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from llama_service import LlamaService
from spotify_service import SpotifyService
import firebase_admin
from firebase_admin import credentials, firestore, auth
import threading
import concurrent.futures
from functools import wraps
import spotipy

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev_secret_key")
if app.secret_key == "dev_secret_key":
    print("WARNING: Using default FLASK_SECRET_KEY. This is a security risk in production.")
app.permanent_session_lifetime = timedelta(days=30)
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = True
app.config["SESSION_COOKIE_HTTPONLY"] = True

# Allow requests from Vite dev server and production origins
CORS(app, supports_credentials=True, origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://moodtune-nine.vercel.app",
])

llama_service = LlamaService()
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

def verify_session(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        request.user = {'uid': user_id}
        return f(*args, **kwargs)
    return decorated_function

@app.route("/")
def index():
    return jsonify({"status": "MoodTunes API is running. The frontend is hosted separately."})

@app.route("/api/firebase_config")
def firebase_config():
    """Serves Firebase client config to the React frontend."""
    config = {
        "apiKey": os.getenv("FIREBASE_API_KEY", ""),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN", ""),
        "projectId": os.getenv("FIREBASE_PROJECT_ID", ""),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET", ""),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID", ""),
        "appId": os.getenv("FIREBASE_APP_ID", ""),
        "measurementId": os.getenv("FIREBASE_MEASUREMENT_ID", "")
    }
    return jsonify(config)

@app.route("/login")
def login():
    try:
        sp_oauth = spotify_service.get_oauth_manager(request.host_url)
        auth_url = sp_oauth.get_authorize_url()
        return redirect(auth_url)
    except Exception as e:
        print(f"Login route error: {e}")
        return jsonify({
            "error": "Failed to initiate login.",
            "details": str(e),
            "message": "Did you forget to add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to your environment variables?"
        }), 500

@app.route("/callback")
def callback():
    error = request.args.get('error')
    if error:
        print(f"Spotify callback error: {error}")
        return redirect(f"/?auth_error={error}")

    sp_oauth = spotify_service.get_oauth_manager(request.host_url)
    session.clear()
    code = request.args.get('code')
    if not code:
        return redirect("/?auth_error=no_code")

    try:
        token_info = sp_oauth.get_access_token(code)
        session.permanent = True
        session["token_info"] = token_info
        
        # Fetch user profile using the new token to establish identity
        sp_client = spotify_service.get_client(token_info)
        user_info = sp_client.current_user()
        session["user_id"] = user_info['id']
        session["user_name"] = user_info.get('display_name')
        if user_info.get('images') and len(user_info['images']) > 0:
            session["user_image"] = user_info['images'][0].get('url')
        else:
            session["user_image"] = None

        return redirect("/?login=success")
            
    except spotipy.exceptions.SpotifyException as e:
        print(f"SpotifyException in callback: {e}")
        if e.http_status == 403:
            return redirect("/?auth_error=User_email_not_registered_in_Spotify_Developer_Dashboard")
        safe_msg = str(e).replace(" ", "_").replace("'", "").replace('"', "")[:60]
        return redirect(f"/?auth_error={safe_msg or 'token_failed'}")
    except Exception as e:
        import traceback
        print(f"Error getting Spotify token: {e}")
        traceback.print_exc()
        safe_msg = str(e).replace(" ", "_").replace("'", "").replace('"', "")[:60]
        return redirect(f"/?auth_error={safe_msg or 'token_failed'}")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))

@app.route("/api/auth_status")
def auth_status():
    token_info = session.get("token_info")
    user_id = session.get("user_id")
    if token_info and user_id:
        return jsonify({
            "logged_in": True, 
            "user": {
                "id": user_id,
                "name": session.get("user_name"),
                "image": session.get("user_image")
            }
        })
    return jsonify({"logged_in": False, "user": None})

@app.route("/api/search_artist")
@verify_session
def search_artist():
    query = request.args.get("q", "")
    if not query:
        return jsonify({"artists": []})
        
    token_info = session.get("token_info")
    if not token_info:
        return jsonify({"error": "not_logged_in"}), 401
        
    sp_client = spotify_service.get_client(token_info)
    artists = spotify_service.search_artist(sp_client, query)
    return jsonify({"artists": artists})

# In-memory session history for non-logged-in guest users
guest_histories = {}

@app.route("/api/chat/clear", methods=["POST"])
def clear_chat_history():
    """Clears the in-memory AI conversation history to start a fresh chat."""
    llama_service.clear_history()
    guest_histories.clear()
    return jsonify({"success": True})

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data.get("message")
    
    if not user_message:
        return jsonify({"error": "Empty message"}), 400
        
    try:
        session_id = data.get("session_id", "default")
        user_prefs = None
        chat_history = []
        uid = session.get("user_id")
        
        if db and uid:
            try:
                # Fetch user preferences
                doc = db.collection('users').document(uid).get()
                if doc.exists:
                    user_prefs = doc.to_dict()
                    
                # Fetch chat history for this session to maintain context
                docs = db.collection('users').document(uid).collection('chats').where('session_id', '==', session_id).stream()
                
                # Sort in memory to avoid needing a composite index in Firestore
                history_list = []
                for doc in docs:
                    h_data = doc.to_dict()
                    history_list.append(h_data)
                    
                history_list.sort(key=lambda x: x.get('timestamp') or 0)
                
                for h_data in history_list:
                    if h_data.get('user_message'):
                        chat_history.append({'role': 'user', 'text': h_data['user_message']})
                    if h_data.get('reply'):
                        chat_history.append({'role': 'model', 'text': h_data['reply']})
            except Exception as e:
                print(f"Failed to fetch user profile or history: {e}")
        else:
            # For guest (non-logged-in) users, retrieve history from in-memory guest_histories
            chat_history = guest_histories.get(session_id, [])

        # Get Spotify client if logged in
        token_info = session.get("token_info")
        sp_client = None
        recent_tracks = None
        top_artists = None
        liked_songs = None
        
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
                # Fetch Spotify context data concurrently if needed, but sequentially is fine for now
                recent_tracks = spotify_service.get_recently_played(sp_client, limit=10)
                top_artists = spotify_service.get_top_artists(sp_client, limit=5)
                liked_songs = spotify_service.get_liked_songs_sample(sp_client, limit=30)

        # Get structured output from Llama
        mood_response = llama_service.get_mood_recommendation(user_message, user_prefs, chat_history, recent_tracks, top_artists, liked_songs)
        
        if not mood_response:
            return jsonify({"error": "Failed to get response from AI"}), 500
        
        tracks = []
        if mood_response.recommendations:
            def fetch_track(rec):
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
                return track_data

            # Use ThreadPoolExecutor for concurrent Spotify searches
            if sp_client:
                with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                    tracks = list(executor.map(fetch_track, mood_response.recommendations))
            else:
                for rec in mood_response.recommendations:
                    tracks.append(fetch_track(rec))
            
        response_data = {
            "reply": mood_response.reply,
            "mood": mood_response.detected_mood,
            "chat_title": mood_response.chat_title,
            "tracks": tracks
        }
        
        # Save to Firestore if user is logged in, else record in guest_histories
        if db and uid:
            try:
                session_id = data.get("session_id", "default")
                chat_doc = {
                    "session_id": session_id,
                    "user_message": user_message,
                    "reply": response_data["reply"],
                    "mood": response_data["mood"],
                    "chat_title": response_data["chat_title"],
                    "tracks": response_data["tracks"],
                    "timestamp": firestore.SERVER_TIMESTAMP
                }
                
                def save_to_firestore(uid, chat_doc):
                    try:
                        db.collection('users').document(uid).collection('chats').add(chat_doc)
                    except Exception as e:
                        print(f"Failed to save chat to Firestore (background): {e}")
                
                threading.Thread(target=save_to_firestore, args=(uid, chat_doc)).start()
            except Exception as e:
                print(f"Failed to prepare chat for Firestore: {e}")
        else:
            if session_id not in guest_histories:
                guest_histories[session_id] = []
            guest_histories[session_id].append({'role': 'user', 'text': user_message})
            guest_histories[session_id].append({'role': 'model', 'text': response_data["reply"]})
            if len(guest_histories[session_id]) > 30:
                guest_histories[session_id] = guest_histories[session_id][-30:]
                
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Chat route error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/history", methods=["GET"])
def get_history():
    uid = session.get("user_id")
    if not uid or not db:
        return jsonify({"history": []})
        
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

@app.route("/api/chat/<session_id>", methods=["DELETE"])
def delete_chat(session_id):
    guest_histories.pop(session_id, None)
    uid = session.get("user_id")
    if not uid or not db:
        return jsonify({"success": True, "deleted": 0})
        
    try:
        # Get all documents for this session
        docs = db.collection('users').document(uid).collection('chats').where('session_id', '==', session_id).stream()
        batch = db.batch()
        count = 0
        for doc in docs:
            batch.delete(doc.reference)
            count += 1
            
        if count > 0:
            batch.commit()
            
        return jsonify({"success": True, "deleted": count})
    except Exception as e:
        print(f"Failed to delete chat: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/chat/<session_id>/rename", methods=["PUT"])
def rename_chat(session_id):
    uid = session.get("user_id")
    if not uid or not db:
        return jsonify({"success": True, "updated": 0})
        
    data = request.get_json(silent=True) or {}
    new_title = data.get('title')
    print(f"DEBUG: Renaming session {session_id} to '{new_title}', request.json was {request.json}")
    if not new_title:
        return jsonify({"error": "New title required"}), 400
        
    uid = request.user.get('uid')
    try:
        # Get all documents for this session
        docs = db.collection('users').document(uid).collection('chats').where('session_id', '==', session_id).stream()
        batch = db.batch()
        count = 0
        for doc in docs:
            batch.update(doc.reference, {'chat_title': new_title})
            count += 1
            
        if count > 0:
            batch.commit()
            
        return jsonify({"success": True, "updated": count})
    except Exception as e:
        print(f"Failed to rename chat: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/play_all", methods=["POST"])
def play_all():
    token_info = session.get("token_info")
    if not token_info:
        return jsonify({"error": "not_logged_in", "success": False}), 401
        
    data = request.json
    uris = data.get("uris", [])
    
    if not uris:
        return jsonify({"error": "No tracks to play", "success": False}), 400
        
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
        queue_only = data.get("queue_only", False)
        
        if queue_only:
            # Fallback: if no active device, try to use any available device
            device_id = None
            try:
                devices = sp_client.devices().get('devices', [])
                if devices:
                    active_device = next((d for d in devices if d['is_active']), None)
                    if not active_device:
                        device_id = devices[0]['id']
            except Exception as d_err:
                print(f"Error fetching devices for queue: {d_err}")
                
            for uri in uris:
                sp_client.add_to_queue(uri, device_id=device_id)
            return jsonify({"success": True, "action": "queued"})

        # Always start playing the tracks (plays first, queues the rest)
        sp_client.start_playback(uris=uris)
        return jsonify({"success": True, "action": "played"})
            
    except spotipy.exceptions.SpotifyException as e:
        if e.http_status == 404 and "NO_ACTIVE_DEVICE" in str(e):
            return jsonify({"error": "NO_ACTIVE_DEVICE", "message": "No active Spotify device found. Please open Spotify on your device first.", "success": False}), 404
        elif e.http_status == 403:
            return jsonify({"error": "Missing Spotify Premium or permissions. Re-login might be required.", "success": False}), 403
        else:
            return jsonify({"error": str(e), "success": False}), 500
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

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
        # Generate a cool name using AI based on recent history
        # (For simplicity here, we can just ask the AI for a quick name)
        # But to avoid another long request, let's use a static or basic dynamic name
        # A better way would be using a quick LLM call, let's do it:
        name = "MoodTunes Mix"
        description = "Created by MoodTunes AI."
        
        playlist_data = spotify_service.create_playlist(sp_client, name, description, uris)
        return jsonify({"success": True, "url": playlist_data["url"], "uri": playlist_data["uri"]})
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Playlist creation error: {error_trace}")
        return jsonify({"error": error_trace, "success": False}), 500

@app.route("/api/playlists", methods=["GET"])
def get_playlists():
    token_info = session.get("token_info")
    if not token_info:
        return jsonify({"error": "not_logged_in", "success": False}), 401
        
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
        playlists = spotify_service.get_user_playlists(sp_client)
        return jsonify({"success": True, "playlists": playlists})
    except Exception as e:
        print(f"Playlists fetch error: {e}")
        return jsonify({"error": str(e), "success": False}), 500

@app.route("/api/playlists/add", methods=["POST"])
def add_to_playlist():
    token_info = session.get("token_info")
    if not token_info:
        return jsonify({"error": "not_logged_in", "success": False}), 401
        
    data = request.json
    playlist_id = data.get("playlist_id")
    track_uri = data.get("track_uri")
    
    if not playlist_id or not track_uri:
        return jsonify({"error": "Missing playlist_id or track_uri", "success": False}), 400
        
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
        success = spotify_service.add_track_to_playlist(sp_client, playlist_id, track_uri)
        return jsonify({"success": success})
    except Exception as e:
        print(f"Add to playlist error: {e}")
        return jsonify({"error": str(e), "success": False}), 500

@app.route("/api/profile", methods=["GET", "PUT"])
@verify_session
def profile():
    if not db:
        return jsonify({"error": "Database not initialized"}), 500
        
    uid = request.user.get('uid')
    doc_ref = db.collection('users').document(uid)
    
    if request.method == "GET":
        try:
            doc = doc_ref.get()
            if doc.exists:
                return jsonify(doc.to_dict())
            return jsonify({})
        except Exception as e:
            print(f"Failed to fetch profile: {e}")
            return jsonify({"error": str(e)}), 500
            
    if request.method == "PUT":
        data = request.get_json()
        try:
            doc_ref.set(data, merge=True)
            return jsonify({"success": True})
        except Exception as e:
            print(f"Failed to update profile: {e}")
            return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
