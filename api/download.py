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
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                if not query.startswith("http"):
                    query = f"ytsearch:{query}"
                info = ydl.extract_info(query, download=True)
                if 'entries' in info:
                    info = info['entries'][0]
                
                filename = ydl.prepare_filename(info)
                
            # Extract title and artist
            raw_title = info.get('title', 'Unknown Title')
            artist = info.get('uploader', 'Unknown Artist')
            title = raw_title
            
            if ' - ' in raw_title:
                parts = raw_title.split(' - ', 1)
                artist = parts[0].strip()
                title = parts[1].strip()

            # Add ID3 tags (m4a/mp4 uses different tag keys)
            try:
                audio = MP4(filename)
                if audio.tags is None:
                    audio.add_tags()
                audio.tags['\xa9nam'] = title  # Title
                audio.tags['\xa9ART'] = artist # Artist
                audio.tags['\xa9alb'] = "YouTube Download" # Album
                audio.save()
            except Exception as e:
                print("Failed to add tags:", e)
                
            # Upload to iBroadcast
            upload_url = "https://sync.ibroadcast.com"
            with open(filename, 'rb') as f:
                files = {'file': (f"{artist} - {title}.m4a", f, 'audio/mp4')}
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