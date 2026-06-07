import yt_dlp

ydl_opts = {
    'format': 'bestaudio/best',
    'noplaylist': True,
    'quiet': False,
    'extractor_args': {'youtube': ['player_client=android']}
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    try:
        ydl.extract_info("cWc7vYjgnTs", download=False)
        print("Success!")
    except Exception as e:
        print("Error:", e)
