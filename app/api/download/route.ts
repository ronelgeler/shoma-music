import { NextRequest, NextResponse } from 'next/server';
import ytSearch from 'yt-search';
import ytdl from '@distube/ytdl-core';
import scdl from 'soundcloud-downloader';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { query, token, userId } = await req.json();

    if (!query || !token || !userId) {
      console.error("DEBUG: Missing parameters", { query: !!query, token: !!token, userId: !!userId });
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    console.log(`DEBUG: Start processing: "${query}"`);

    let stream: any = null;
    let title = 'Unknown Title';
    let artist = 'Unknown Artist';
    let source = 'None';

    // 1. Try YouTube
    try {
      console.log("DEBUG: Attempting YouTube search...");
      const searchResults = await ytSearch(query);
      const video = searchResults.videos[0];
      
      if (video) {
        console.log(`DEBUG: YouTube found: "${video.title}"`);
        title = video.title;
        artist = video.author.name || 'Unknown Artist';
        source = 'YouTube';
        
        stream = ytdl(video.url, { 
          filter: 'audioonly',
          quality: 'highestaudio',
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
          }
        });

        // Verify stream starts
        await new Promise((resolve, reject) => {
          stream.once('data', () => {
            console.log("DEBUG: YouTube stream data received");
            resolve(true);
          });
          stream.once('error', (err: any) => reject(err));
          setTimeout(() => reject(new Error('YouTube stream timeout')), 8000);
        });
      } else {
        throw new Error("No YouTube video results");
      }
    } catch (ytError: any) {
      console.warn(`DEBUG: YouTube failed: ${ytError.message}. Trying SoundCloud...`);
      
      try {
        source = 'SoundCloud';
        const scResults = await scdl.search({
          query: query,
          resourceType: 'tracks',
          limit: 1
        });
        
        const track = scResults.collection?.[0];
        if (!track) throw new Error("No SoundCloud results");

        console.log(`DEBUG: SoundCloud found: "${track.title}"`);
        title = track.title;
        artist = track.user?.username || 'Unknown Artist';
        stream = await scdl.download(track.permalink_url);
      } catch (scError: any) {
        console.error(`DEBUG: SoundCloud also failed: ${scError.message}`);
        throw new Error("Could not find or stream song from any source");
      }
    }

    // Metadata Cleanup
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      title = parts[1].trim();
    }
    console.log(`DEBUG: Final metadata: "${title}" by "${artist}"`);

    // 2. Buffer Stream
    console.log("DEBUG: Buffering stream...");
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    console.log(`DEBUG: Buffered ${buffer.length} bytes`);

    if (buffer.length < 1000) throw new Error("File too small, download failed");

    // 3. Upload to iBroadcast via Fetch (Native)
    console.log("DEBUG: Starting iBroadcast upload...");
    const boundary = `----shoma${Math.random().toString(36).substring(2)}`;
    const cleanFilename = `${artist} - ${title}.mp3`.replace(/[/\\?%*:|"<>]/g, '-');
    
    // Construct manual multipart form data for reliability
    const bodyParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="user_id"\r\n\r\n${userId}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="token"\r\n\r\n${token}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="method"\r\n\r\nibroadcast.upload\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="client"\r\n\r\nshoma-music\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="version"\r\n\r\n1.3\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n${process.env.IBROADCAST_CLIENT_ID}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="client_secret"\r\n\r\n${process.env.IBROADCAST_CLIENT_SECRET}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file_path"\r\n\r\n${cleanFilename}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${cleanFilename}"\r\nContent-Type: audio/mpeg\r\n\r\n`,
    ];

    const partBuffers = bodyParts.map(p => Buffer.from(p));
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const finalBody = Buffer.concat([...partBuffers, buffer, footer]);

    const uploadResponse = await fetch('https://sync.ibroadcast.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': finalBody.length.toString(),
      },
      body: finalBody
    });

    const uploadResult = await uploadResponse.json();
    console.log("DEBUG: iBroadcast response:", uploadResult);

    if (uploadResult.result === false) {
      throw new Error(uploadResult.message || 'iBroadcast rejected upload');
    }

    return NextResponse.json({ success: true, title, artist, source });
  } catch (error: any) {
    console.error('CRITICAL: Downloader Pipeline Failure:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
