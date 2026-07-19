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
        
        self.scopes = "playlist-modify-public playlist-modify-private user-modify-playback-state user-read-playback-state"
        
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
            # Use /me/playlists directly — the old /users/{id}/playlists
            # endpoint was deprecated by Spotify in Feb 2026 and returns 403.
            playlist = client._post('me/playlists', payload={
                "name": name,
                "description": description,
                "public": False
            })
            
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
