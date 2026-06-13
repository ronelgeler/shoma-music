import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';
import NodeID3 from 'node-id3';
import { Innertube } from 'youtubei.js';
import scdl from 'soundcloud-downloader';
import { Readable } from 'stream';

// @ts-ignore
import ytdl from 'ytdl-core-enhanced';

export const maxDuration = 300;

function parseCookies(str: string) {
  if (!str) return {};
  const cookies: Record<string, string> = {};
  if (str.includes('\t') || str.includes('# Netscape')) {
      str.split('\n').forEach(line => {
          const parts = line.trim().split('\t');
          if (parts.length >= 7) cookies[parts[5]] = parts[6];
      });
  } else {
      str.split(';').forEach(c => {
          const [k, v] = c.trim().split('=');
          if (k && v) cookies[k] = v;
      });
  }
  return cookies;
}

function cookiesToString(cookies: Record<string, string>) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function streamToBuffer(stream: any): Promise<Buffer> {
    if (stream.getReader) {
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        return Buffer.concat(chunks);
    }
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, token, userId, youtubeCookie, poToken, youtubeTokens } = body;

    console.log('[SHOMA] === NEW DOWNLOAD REQUEST ===');
    console.log('[SHOMA] Query:', query);

    if (!query || !token || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

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

    if (youtubeTokens) {
        try { await yt.session.signIn(youtubeTokens); } catch (e) {}
    }

    if (!targetUrl.includes('http')) {
         const searchResults = await yt.search(targetUrl, { type: 'video' });
         if (searchResults.videos.length) {
             targetUrl = `https://www.youtube.com/watch?v=${(searchResults.videos[0] as any).id}`;
         }
    }

    if (targetUrl.includes('soundcloud.com')) {
        const scInfo = await scdl.getInfo(targetUrl);
        title = scInfo.title || 'Unknown Title';
        artist = scInfo.user?.username || 'Unknown Artist';
        const stream = await scdl.download(targetUrl);
        buffer = await streamToBuffer(stream);
    } else {
        let videoId = targetUrl;
        if (targetUrl.includes('v=')) videoId = targetUrl.split('v=')[1].split('&')[0];
        else if (targetUrl.includes('youtu.be/')) videoId = targetUrl.split('youtu.be/')[1].split('?')[0];

        console.log(`[SHOMA] Target Video ID: ${videoId}`);

        // HYPER-RESILIENT EXTRACTION
        const clients: any[] = ['TV', 'ANDROID_VR', 'ANDROID_MUSIC', 'MWEB'];
        let lastError = '';

        for (const clientType of clients) {
            try {
                console.log(`[SHOMA] Trying Innertube (${clientType})...`);
                const info = await yt.getInfo(videoId, { client: clientType });
                title = info.basic_info.title || title;
                artist = info.basic_info.author || artist;
                const stream = await info.download({ type: 'audio', quality: 'best', client: clientType });
                buffer = await streamToBuffer(stream);
                if (buffer) break;
            } catch (e: any) {
                lastError = e.message;
            }
        }

        if (!buffer) {
            console.log('[SHOMA] Trying Cobalt buffer fetch...');
            try {
                const cobaltRes = await fetch("https://api.cobalt.tools/api/json", {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json" },
                    body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, isAudioOnly: true, aFormat: "mp3" })
                });
                const cobaltData = await cobaltRes.json();
                if (cobaltData.url) {
                    const audioRes = await fetch(cobaltData.url);
                    buffer = Buffer.from(await audioRes.arrayBuffer());
                    console.log('[SHOMA] Cobalt SUCCESS');
                }
            } catch (e) {}
        }

        if (!buffer) {
            console.log('[SHOMA] Trying Piped buffer fetch...');
            const instances = ["https://pipedapi.kavin.rocks", "https://api.piped.victr.me"];
            for (const instance of instances) {
                try {
                    const res = await fetch(`${instance}/streams/${videoId}`);
                    const data = await res.json();
                    const streamUrl = data.audioStreams?.find((s: any) => s.format === 'M4A')?.url || data.audioStreams?.[0]?.url;
                    if (streamUrl) {
                        const audioRes = await fetch(streamUrl);
                        buffer = Buffer.from(await audioRes.arrayBuffer());
                        console.log(`[SHOMA] Piped SUCCESS (${instance})`);
                        break;
                    }
                } catch (e) {}
            }
        }

        if (!buffer) {
            console.log('[SHOMA] Trying ytdl-core fallback...');
            try {
                const stream = ytdl(videoId, { filter: 'audioonly', quality: 'highestaudio' });
                buffer = await streamToBuffer(stream);
            } catch (e) {
                throw new Error(`All download methods failed: ${lastError}`);
            }
        }
    }

    if (title.includes(' - ')) {
        const parts = title.split(' - ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
    }

    if (!buffer) throw new Error("Could not obtain audio buffer");

    // Upload to iBroadcast
    const tags = { title, artist };
    const taggedBuffer = NodeID3.write(tags, buffer) || buffer;
    const cleanFilename = `${artist} - ${title}.mp3`.replace(/[/\\?%*:|"<>]/g, '-');
    const md5 = crypto.createHash('md5').update(taggedBuffer).digest('hex');

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
    formData.append('file', taggedBuffer, { filename: cleanFilename, contentType: 'audio/mpeg' });

    console.log(`[SHOMA] Uploading to iBroadcast...`);
    const uploadResponse = await axios.post('https://upload.ibroadcast.com', formData, {
        headers: { ...formData.getHeaders() }
    });

    if (uploadResponse.data.result === false) {
        throw new Error(uploadResponse.data.message || 'iBroadcast upload failed');
    }

    return NextResponse.json({ success: true, title, artist });
  } catch (error: any) {
    console.error('[SHOMA] ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
