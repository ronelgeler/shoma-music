import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';
import NodeID3 from 'node-id3';
// @ts-ignore
import ytdl from 'ytdl-core-enhanced';
import { Innertube } from 'youtubei.js';
import scdl from 'soundcloud-downloader';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { query, token, userId, youtubeCookie } = await req.json();

    if (!query || !token || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    console.log(`[SHOMA] Processing: ${query}`);

    let title = 'Unknown Title';
    let artist = 'Unknown Artist';
    let buffer: Buffer | null = null;
    let targetUrl = query;

    try {
        if (!targetUrl.includes('http')) {
             console.log(`[SHOMA] Text query detected, searching YouTube: ${targetUrl}`);
             const yt = await Innertube.create();
             const searchResults = await yt.search(targetUrl, { type: 'video' });
             if (!searchResults.videos.length) {
                 throw new Error("No videos found on YouTube");
             }
             targetUrl = `https://www.youtube.com/watch?v=${(searchResults.videos[0] as any).id}`;
        }

        if (targetUrl.includes('soundcloud.com')) {
            console.log(`[SHOMA] Extracting SoundCloud metadata for: ${targetUrl}`);
            const scInfo = await scdl.getInfo(targetUrl);
            title = scInfo.title || 'Unknown Title';
            artist = scInfo.user?.username || 'Unknown Artist';
            
            console.log(`[SHOMA] Downloading SoundCloud audio...`);
            const stream = await scdl.download(targetUrl);
            const chunks: any[] = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            buffer = Buffer.concat(chunks);
        } else {
            console.log(`[SHOMA] Extracting YouTube metadata via ytdl-core-enhanced for: ${targetUrl}`);
            
            // Use provided cookie or env variable
            const cookieStr = youtubeCookie || process.env.YOUTUBE_COOKIE;
            let agent;
            if (cookieStr) {
                const cookies = cookieStr.split(';').map((c: string) => {
                    const [name, ...value] = c.split('=');
                    return { name: name.trim(), value: value.join('=').trim() };
                }).filter((c: any) => c.name && c.value);
                agent = ytdl.createAgent(cookies);
                console.log(`[SHOMA] Using authenticated agent`);
            }

            const ytInfo = await ytdl.getInfo(targetUrl, { agent });
            title = ytInfo.videoDetails.title || 'Unknown Title';
            artist = ytInfo.videoDetails.author.name || 'Unknown Artist';
            console.log(`[SHOMA] YouTube Found: ${title} by ${artist}`);

            console.log(`[SHOMA] Downloading best audio via ytdl-core-enhanced...`);
            const stream = ytdl.downloadFromInfo(ytInfo, { 
                quality: 'highestaudio',
                agent
            });
            
            const chunks: Buffer[] = await new Promise((resolve, reject) => {
                const arr: Buffer[] = [];
                stream.on('data', (c: Buffer) => arr.push(c));
                stream.on('end', () => resolve(arr));
                stream.on('error', (err: any) => reject(err));
            });
            buffer = Buffer.concat(chunks);
        }
    } catch (error: any) {
        console.error(`[SHOMA] YouTube/SC Error:`, error);
        throw new Error(`Failed to find or stream song: ${error.message}`);
    }

    // Metadata Cleanup
    if (title.includes(' - ')) {
        const parts = title.split(' - ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
    }

    if (!buffer) throw new Error("Could not obtain audio buffer");
    console.log(`[SHOMA] Buffered ${buffer.length} bytes`);

    // Inject ID3 tags
    const tags = { title, artist };
    buffer = NodeID3.write(tags, buffer) || buffer;

    // 3. Upload to iBroadcast
    const cleanFilename = `${artist} - ${title}.mp3`.replace(/[/\\?%*:|"<>]/g, '-');
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');

    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('token', token);
    formData.append('method', 'ibroadcast.upload');
    formData.append('client', 'shoma-music');
    formData.append('version', '1.4');
    formData.append('client_id', process.env.IBROADCAST_CLIENT_ID || '1000');
    formData.append('client_secret', process.env.IBROADCAST_CLIENT_SECRET || '');
    formData.append('file_path', cleanFilename);
    formData.append('file_md5', md5);
    formData.append('title', title);
    formData.append('artist', artist);
    formData.append('file', buffer, { filename: cleanFilename, contentType: 'audio/mpeg' });

    console.log(`[SHOMA] Uploading to iBroadcast...`);
    
    let uploadResult;
    try {
      const uploadResponse = await axios.post('https://upload.ibroadcast.com', formData, {
        headers: {
          ...formData.getHeaders(),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });
      uploadResult = uploadResponse.data;
    } catch (e: any) {
      console.error("[SHOMA] iBroadcast axios error:", e.response?.data || e.message);
      throw new Error(`iBroadcast API error (Status: ${e.response?.status || 500})`);
    }

    if (uploadResult.result === false) {
      throw new Error(uploadResult.message || 'iBroadcast rejected upload');
    }

    return NextResponse.json({ success: true, title, artist });
  } catch (error: any) {
    console.error('[SHOMA] ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
