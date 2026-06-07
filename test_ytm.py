import yt_dlp

ydl_opts = {
    'format': 'bestaudio/best',
    'noplaylist': True,
    'quiet': False,
    'extractor_args': {'youtube': ['player_client=android']}
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    try:
        info = ydl.extract_info("ytmusicsearch:adele hello", download=False)
        print("Success!")
        if 'entries' in info and len(info['entries']) > 0:
            entry = info['entries'][0]
            print(f"Found: {entry.get('title')} by {entry.get('uploader')}")
    except Exception as e:
        print("Error:", e)
