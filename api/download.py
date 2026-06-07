import os
import json
from http.server import BaseHTTPRequestHandler
import yt_dlp
import requests
from mutagen.mp4 import MP4, MP4Tags

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            query = data.get('query')
            token = data.get('token')
            
            if not query or not token:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "Missing query or token"}')
                return
                
            # Download audio
            ydl_opts = {
                'format': 'bestaudio[ext=m4a]/bestaudio/best',
                'outtmpl': '/tmp/%(id)s.%(ext)s',
                'noplaylist': True,
                'quiet': True,
                'extractor_args': {'youtube': ['player_client=android']}
            }
            
            info = None
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    search_query = query
                    if not search_query.startswith("http"):
                        search_query = f"ytsearch:{query}"
                    info = ydl.extract_info(search_query, download=True)
            except Exception as e:
                print(f"YouTube download failed: {e}. Falling back to SoundCloud...")
                # Fallback to SoundCloud
                ydl_opts_sc = {
                    'format': 'bestaudio[ext=m4a]/bestaudio/best',
                    'outtmpl': '/tmp/%(id)s.%(ext)s',
                    'noplaylist': True,
                    'quiet': True,
                }
                with yt_dlp.YoutubeDL(ydl_opts_sc) as ydl:
                    search_query = query
                    if not search_query.startswith("http"):
                        search_query = f"scsearch:{query}"
                    info = ydl.extract_info(search_query, download=True)

            if 'entries' in info:
                info = info['entries'][0]
            
            # Extract title and artist more robustly
            # Use 'title' or 'track' for the song name
            # Use 'artist', 'uploader', or 'creator' for the artist name
            raw_title = info.get('title') or info.get('track') or 'Unknown Title'
            raw_artist = info.get('artist') or info.get('uploader') or info.get('creator') or 'Unknown Artist'
            
            title = raw_title
            artist = raw_artist
            
            # If the title looks like "Artist - Title", split it
            if ' - ' in raw_title:
                parts = raw_title.split(' - ', 1)
                artist = parts[0].strip()
                title = parts[1].strip()
            elif 'by' in raw_title.lower():
                # Handle SoundCloud style "Title by Artist" if necessary
                pass

            # Final check to avoid empty strings
            title = title or 'Unknown Title'
            artist = artist or 'Unknown Artist'

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                filename = ydl.prepare_filename(info)
                
            # Add ID3 tags (m4a/mp4 uses different tag keys)
            try:
                audio = MP4(filename)
                if audio.tags is None:
                    audio.add_tags()
                audio.tags['\xa9nam'] = title  # Title
                audio.tags['\xa9ART'] = artist # Artist
                audio.tags['\xa9alb'] = "Cloud Library" # Album
                audio.save()
            except Exception as e:
                print("Failed to add tags:", e)
                
            # Upload to iBroadcast
            upload_url = "https://sync.ibroadcast.com"
            with open(filename, 'rb') as f:
                # Use a clean display name for the file being uploaded
                display_filename = f"{artist} - {title}.m4a".replace("/", "_").replace("\\", "_")
                files = {'file': (display_filename, f, 'audio/mp4')}
                user_id = data.get('userId', token)
                payload = {
                    'user_id': user_id,
                    'token': token,
                    'method': 'ibroadcast.upload'
                }
                
                res = requests.post(upload_url, data=payload, files=files)
                
            # Cleanup
            try:
                os.remove(filename)
            except:
                pass
                
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            if res.status_code == 200:
                self.wfile.write(b'{"success": True}')
            else:
                self.wfile.write(json.dumps({"error": res.text}).encode('utf-8'))
                
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))