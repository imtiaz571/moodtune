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
        
        self.scopes = "playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative user-modify-playback-state user-read-playback-state user-read-recently-played user-top-read user-library-read"
        
    def get_oauth_manager(self, request_host_url=None):
        redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI")
        if not redirect_uri:
            if request_host_url:
                redirect_uri = f"{request_host_url.rstrip('/')}/callback"
            else:
                redirect_uri = "https://moodtune-nine.vercel.app/callback"

        return SpotifyOAuth(
            client_id=self.client_id,
            client_secret=self.client_secret,
            redirect_uri=redirect_uri,
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

    def search_artist(self, client, query):
        """Searches for artists and returns a list of matching profiles."""
        if not client:
            return []
        try:
            results = client.search(q=query, type='artist', limit=5)
            artists = results.get('artists', {}).get('items', [])
            
            return [
                {
                    'id': a['id'],
                    'name': a['name'],
                    'image_url': a['images'][0]['url'] if a['images'] else None
                }
                for a in artists
            ]
        except Exception as e:
            print(f"Artist search error: {e}")
            return []

    def get_recently_played(self, client, limit=20):
        """Fetches the user's recently played tracks."""
        if not client:
            return []
        try:
            results = client.current_user_recently_played(limit=limit)
            tracks = results.get('items', [])
            return [
                {
                    'title': item['track']['name'],
                    'artist': item['track']['artists'][0]['name']
                }
                for item in tracks
            ]
        except Exception as e:
            print(f"Recently played fetch error: {e}")
            return []

    def get_top_artists(self, client, limit=5, time_range='short_term'):
        """Fetches the user's top artists (e.g., 'on repeat')."""
        if not client:
            return []
        try:
            results = client.current_user_top_artists(limit=limit, time_range=time_range)
            artists = results.get('items', [])
            return [artist['name'] for artist in artists]
        except Exception as e:
            print(f"Top artists fetch error: {e}")
            return []

    def get_liked_songs_sample(self, client, limit=50):
        """Fetches a sample of the user's recently liked songs."""
        if not client:
            return []
        try:
            results = client.current_user_saved_tracks(limit=limit)
            tracks = results.get('items', [])
            return [
                {
                    'title': item['track']['name'],
                    'artist': item['track']['artists'][0]['name']
                }
                for item in tracks if item.get('track')
            ]
        except Exception as e:
            print(f"Liked songs fetch error: {e}")
            return []

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

    def get_user_playlists(self, client, limit=50):
        """Fetches the user's playlists (owned or collaborative)."""
        if not client:
            return []
        try:
            user_info = client.current_user()
            user_id = user_info['id']
            results = client.current_user_playlists(limit=limit)
            playlists = results.get('items', [])
            
            valid_playlists = []
            for p in playlists:
                # User can only add tracks if they own it or it's collaborative
                if p['owner']['id'] == user_id or p.get('collaborative'):
                    image_url = p['images'][0]['url'] if p.get('images') and len(p['images']) > 0 else None
                    valid_playlists.append({
                        'id': p['id'],
                        'name': p['name'],
                        'image': image_url
                    })
            return valid_playlists
        except Exception as e:
            print(f"Error fetching user playlists: {e}")
            return []

    def add_track_to_playlist(self, client, playlist_id, track_uri):
        """Adds a single track to the specified playlist."""
        if not client:
            return False
        try:
            client.playlist_add_items(playlist_id, [track_uri])
            return True
        except Exception as e:
            print(f"Error adding track to playlist: {e}")
            raise e

