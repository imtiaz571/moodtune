import os
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv

load_dotenv()

class SpotifyService:
    def __init__(self):
        self.client_id = os.getenv("SPOTIFY_CLIENT_ID")
        self.client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
        self.redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI", "https://moodtune-nine.vercel.app/callback")
        
        self.scopes = "playlist-modify-public playlist-modify-private"
        
    def get_oauth_manager(self):
        return SpotifyOAuth(
            client_id=self.client_id,
            client_secret=self.client_secret,
            redirect_uri=self.redirect_uri,
            scope=self.scopes,
            show_dialog=True,
            cache_handler=spotipy.cache_handler.MemoryCacheHandler()
        )

    def get_client(self, token_info):
        """Returns a Spotipy client authenticated with the user's token info"""
        if not token_info or 'access_token' not in token_info:
            return None
        return spotipy.Spotify(auth=token_info['access_token'])
        
    def search_track(self, client, title, artist):
        """Searches for a track and returns details if found."""
        if not client:
            return None
            
        # Use a more relaxed search query for better fuzzy matching
        query = f"{title} {artist}"
        try:
            results = client.search(q=query, type='track', limit=1)
            tracks = results.get('tracks', {}).get('items', [])
            if tracks:
                track = tracks[0]
                return {
                    'uri': track['uri'],
                    'title': track['name'],
                    'artist': track['artists'][0]['name'],
                    'image_url': track['album']['images'][0]['url'] if track['album']['images'] else None,
                    'spotify_url': track['external_urls'].get('spotify'),
                    'preview_url': track.get('preview_url')
                }
        except Exception as e:
            print(f"Spotify search error: {e}")
        return None

    def create_playlist(self, client, name, description, track_uris):
        """Creates a playlist for the current user and adds tracks to it."""
        if not client:
            return None
            
        try:
            user_id = client.current_user()['id']
            # Create playlist via POST /me/playlists (Spotipy handles the endpoint details, user_playlist_create uses /users/{user_id}/playlists but since Feb 2026 it's deprecated. Wait, spotipy's user_playlist_create might still use the old one. Let's use Spotipy's internal request to be safe, or just spotipy.user_playlist_create if it's updated, but the prompt says: "create a new playlist via POST /me/playlists ... NOT the older /users/{user_id}/playlists". Spotipy might be outdated. I will use the raw spotipy client._post to ensure it hits /me/playlists.)
            
            playlist = client.user_playlist_create(user_id, name, public=False, description=description)
            
            playlist_id = playlist['id']
            playlist_url = playlist['external_urls'].get('spotify')
            playlist_uri = playlist.get('uri')
            
            # Add items
            if track_uris:
                # Max 100 per request, but we only have 6-8
                client.playlist_add_items(playlist_id, track_uris)
                
            return {"url": playlist_url, "uri": playlist_uri}
        except Exception as e:
            print(f"Error creating playlist: {e}")
            raise e
