import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';
import NodeID3 from 'node-id3';
import { Innertube } from 'youtubei.js';
import scdl from 'soundcloud-downloader';
// @ts-ignore
import ytdl from 'ytdl-core-enhanced';

export const maxDuration = 60;

function parseCookies(str: string) {
    if (!str) return [];
    
    // Netscape format (tabs or comment header)
    if (str.includes('\t') || str.includes('# Netscape')) {
        return str.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                const parts = line.split('\t');
                if (parts.length >= 7) {
                    return { name: parts[5], value: parts[6] };
                }
                return null;
            })
            .filter((c): c is { name: string; value: string } => c !== null);
    }
    
    // JSON format
    if (str.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(str);
            return parsed.map((c: any) => ({ 
                name: c.name || c.key, 
                value: c.value 
            })).filter((c: any) => c.name && c.value);
        } catch (e) {}
    }

    // Key=Value format
    return str.split(';').map(c => {
        const [name, ...value] = c.split('=');
        if (!name || !value.length) return null;
        return { name: name.trim(), value: value.join('=').trim() };
    }).filter((c): c is { name: string; value: string } => c !== null);
}

function cookiesToString(cookies: { name: string; value: string }[]) {
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

async function streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: any[] = [];
    if (typeof stream.getReader === 'function') {
        const reader = stream.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
    } else {
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
    }
    return Buffer.concat(chunks);
}

export async function POST(req: NextRequest) {
  try {
    const { query, token, userId, youtubeCookie, poToken, youtubeTokens } = await req.json();

    if (!query || !token || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    console.log(`[SHOMA] Processing: ${query}`);

    let title = 'Unknown Title';
    let artist = 'Unknown Artist';
    let buffer: Buffer | null = null;
    let targetUrl = query;

    const cookieStr = youtubeCookie || process.env.YOUTUBE_COOKIE;
    const parsedCookies = parseCookies(cookieStr || '');
    const finalCookieHeader = cookiesToString(parsedCookies);

    const yt = await Innertube.create({ 
        cookie: finalCookieHeader || undefined,
        generate_session_locally: true,
        po_token: poToken || process.env.YOUTUBE_PO_TOKEN || undefined
    });

    // If we have OAuth tokens, sign in
    if (youtubeTokens) {
        console.log(`[SHOMA] Using YouTube OAuth tokens...`);
        try {
            await yt.session.signIn(youtubeTokens);
        } catch (authError: any) {
            console.warn(`[SHOMA] OAuth Sign-in failed: ${authError.message}`);
        }
    }

    if (!targetUrl.includes('http')) {
         console.log(`[SHOMA] Text query detected, searching YouTube: ${targetUrl}`);
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
        buffer = await streamToBuffer(stream);
    } else {
        // Extract the video ID from the URL
        let videoId = targetUrl;
        if (targetUrl.includes('v=')) {
            videoId = targetUrl.split('v=')[1].split('&')[0];
        } else if (targetUrl.includes('youtu.be/')) {
            videoId = targetUrl.split('youtu.be/')[1].split('?')[0];
        }

        console.log(`[SHOMA] Attempting download for ID: ${videoId}`);
        
        const clients: ('TV' | 'MWEB' | 'WEB' | 'IOS')[] = ['TV', 'MWEB', 'WEB', 'IOS'];
        let lastError = '';

        for (const clientType of clients) {
            try {
                console.log(`[SHOMA] Trying Innertube (${clientType} client)...`);
                
                // Get info first
                const info = await yt.getInfo(videoId, { 
                    client: clientType,
                    po_token: poToken || undefined
                });

                // If info works, try to download
                console.log(`[SHOMA] Info success with ${clientType}, starting stream...`);
                const stream = await info.download({
                    type: 'audio',
                    quality: 'best',
                    format: 'mp4',
                    client: clientType
                });

                buffer = await streamToBuffer(stream);
                console.log(`[SHOMA] Innertube success with ${clientType}!`);
                break; // We found a working client
            } catch (e: any) {
                console.warn(`[SHOMA] Innertube ${clientType} failed: ${e.message}`);
                lastError = e.message;
                // If it's a bot error, continue to next client. 
                // If it's something else (like 404), maybe we should stop?
                if (e.message.includes('bot') || e.message.includes('400')) {
                    continue;
                }
            }
        }

        // If Innertube failed all clients, try ytdl-core-enhanced
        if (!buffer) {
            console.warn(`[SHOMA] All Innertube clients failed. Falling back to ytdl-core-enhanced...`);
            try {
                const options: any = {
                    quality: 'highestaudio',
                    filter: 'audioonly'
                };
                
                const headers: any = {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
                };
                if (finalCookieHeader) headers.cookie = finalCookieHeader;
                options.requestOptions = { headers };
                if (poToken) options.poToken = poToken;

                const info = await ytdl.getInfo(videoId, options);
                title = info.videoDetails.title || title;
                artist = info.videoDetails.author.name || artist;

                const stream = ytdl(videoId, options);
                buffer = await streamToBuffer(stream);
                console.log(`[SHOMA] ytdl-core-enhanced success!`);
            } catch (ytdlError: any) {
                console.error(`[SHOMA] All download methods failed.`);
                throw new Error(`YouTube Stream Error: ${ytdlError.message} (Last Innertube Error: ${lastError})`);
            }
        }
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
