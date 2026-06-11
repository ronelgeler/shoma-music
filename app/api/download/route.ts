import { NextRequest, NextResponse } from 'next/server';
import scdl from 'soundcloud-downloader';
import axios from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';
import NodeID3 from 'node-id3';

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
    let buffer: Buffer | null = null;
    let actualQuery = query;

    // 1. Process Input Query
    try {
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            console.log(`[SHOMA] Detected YouTube URL. Extracting metadata via OEmbed...`);
            let ytUrl = query;
            if (!ytUrl.startsWith('http')) ytUrl = `https://${ytUrl}`;
            
            const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(ytUrl)}&format=json`);
            if (oembedRes.ok) {
              const info = await oembedRes.json();
              actualQuery = `${info.author_name || ''} ${info.title}`.trim();
              console.log(`[SHOMA] Converted to query: ${actualQuery}`);
            } else {
              console.log(`[SHOMA] OEmbed failed, using original url as query`);
            }
        } else if (query.includes('soundcloud.com')) {
            console.log(`[SHOMA] Detected SoundCloud URL.`);
            const info = await scdl.getInfo(query);
            title = info.title || 'Unknown';
            artist = info.user?.username || 'Unknown';
            const stream = await scdl.download(query);
            const chunks: any[] = [];
            for await (const chunk of stream) chunks.push(chunk);
            buffer = Buffer.concat(chunks);
            actualQuery = ''; // Flag as already downloaded
        }
        
        // 2. Perform SoundCloud Search if not already downloaded
        if (actualQuery) {
            console.log(`[SHOMA] Searching SoundCloud for: ${actualQuery}`);
            const results = await scdl.search({ query: actualQuery, resourceType: 'tracks', limit: 1 });
            if (!results.collection || !results.collection.length) throw new Error("No results found on SoundCloud");
            
            const track = results.collection[0] as any;
            title = track.title || 'Unknown';
            artist = track.user?.username || 'Unknown Artist';
            console.log(`[SHOMA] SoundCloud Found: ${title} by ${artist}`);
            
            const stream = await scdl.download(track.permalink_url);
            const chunks: any[] = [];
            for await (const streamChunk of stream) chunks.push(streamChunk);
            buffer = Buffer.concat(chunks);
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

    if (!buffer) throw new Error("Could not obtain audio buffer");
    console.log(`[SHOMA] Buffered ${buffer.length} bytes`);

    // Inject ID3 tags so iBroadcast reads the correct metadata
    const tags = {
      title: title,
      artist: artist,
    };
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

    console.log(`[SHOMA] Uploading to iBroadcast via Axios (to upload.ibroadcast.com)...`);
    
    let uploadResult;
    try {
      // sync.ibroadcast.com was deprecated in May 2026. Switching to upload.ibroadcast.com
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
      // Try sync as fallback just in case
      if (e.response?.status === 404 || e.response?.status === 403) {
          console.log(`[SHOMA] ${e.response?.status} on upload.ibroadcast.com, trying sync.ibroadcast.com as fallback...`);
          try {
            const uploadResponse = await axios.post('https://sync.ibroadcast.com/', formData, {
                headers: {
                  ...formData.getHeaders(),
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity
              });
              uploadResult = uploadResponse.data;
          } catch (e2: any) {
            console.error("[SHOMA] iBroadcast fallback axios error:", e2.response?.data || e2.message);
            throw new Error(`iBroadcast API error (Status: ${e2.response?.status || 500}). ${e2.response?.data?.message || ''}`);
          }
      } else {
        throw new Error(`iBroadcast API error (Status: ${e.response?.status || 500}). ${e.response?.data?.message || ''}`);
      }
    }

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

