import { NextRequest, NextResponse } from 'next/server';
import play from 'play-dl';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { query, token, userId } = await req.json();

    if (!query || !token || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    console.log(`[SHOMA] Processing: ${query}`);

    let title = 'Unknown Title';
    let artist = 'Unknown Artist';
    let streamUrl = '';

    // 1. Search & Get Info
    try {
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            const info = await play.video_info(query);
            title = info.video_details.title || 'Unknown';
            artist = info.video_details.channel?.name || 'Unknown';
            const stream = await play.stream(query);
            streamUrl = (stream as any).url;
        } else if (query.includes('soundcloud.com')) {
            const info = await play.soundcloud(query);
            title = (info as any).name || 'Unknown';
            artist = (info as any).user?.username || 'Unknown';
            const stream = await play.stream(query);
            streamUrl = (stream as any).url;
        } else {
            // General Search - Try YouTube first
            try {
                const results = await play.search(query, { limit: 1 });
                if (!results.length) throw new Error("No YouTube results");
                const video = results[0];
                title = video.title || 'Unknown';
                artist = video.channel?.name || 'Unknown';
                console.log(`[SHOMA] YouTube Found: ${title}`);
                const stream = await play.stream(video.url);
                streamUrl = (stream as any).url;
            } catch (ytError: any) {
                console.warn(`[SHOMA] YouTube Bot Blocked: ${ytError.message}. Switching to SoundCloud...`);
                // Fallback to SoundCloud Search
                const results = await play.search(query, { limit: 1, source: { soundcloud: 'tracks' } });
                if (!results.length) throw new Error("No results found on YouTube or SoundCloud");
                const track = results[0];
                title = (track as any).name || (track as any).title || 'Unknown';
                artist = (track as any).user?.username || (track as any).channel?.name || 'Unknown Artist';
                console.log(`[SHOMA] SoundCloud Found: ${title}`);
                const stream = await play.stream((track as any).url);
                streamUrl = (stream as any).url;
            }
        }
    } catch (error: any) {
        throw new Error(`Failed to find or stream song: ${error.message}`);
    }

    // Metadata Cleanup
    if (title.includes(' - ')) {
        const parts = title.split(' - ');
        artist = parts[0].trim();
        title = parts[1].trim();
    }

    console.log(`[SHOMA] Streaming: ${title} by ${artist}`);

    // 2. Fetch Stream into Buffer
    const streamRes = await fetch(streamUrl);
    if (!streamRes.ok) throw new Error(`Stream fetch failed: ${streamRes.statusText}`);
    
    const arrayBuffer = await streamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[SHOMA] Buffered ${buffer.length} bytes`);

    // 3. Upload to iBroadcast
    const boundary = `----shoma${Math.random().toString(36).substring(2)}`;
    const cleanFilename = `${artist} - ${title}.mp3`.replace(/[/\\?%*:|"<>]/g, '-');
    
    const bodyParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="user_id"\r\n\r\n${userId}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="token"\r\n\r\n${token}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="method"\r\n\r\nibroadcast.upload\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="client"\r\n\r\nshoma-music\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="version"\r\n\r\n1.4\r\n`,
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
    console.log("[SHOMA] iBroadcast response:", uploadResult);

    if (uploadResult.result === false) {
      throw new Error(uploadResult.message || 'iBroadcast rejected upload');
    }

    return NextResponse.json({ success: true, title, artist });
  } catch (error: any) {
    console.error('[SHOMA] ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
