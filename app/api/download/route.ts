import { NextRequest, NextResponse } from 'next/server';
import ytsr from 'ytsr';
import ytdl from '@distube/ytdl-core';
import axios from 'axios';
import FormData from 'form-data';

export const maxDuration = 60; // Max out Vercel timeout

export async function POST(req: NextRequest) {
  try {
    const { query, token, userId } = await req.json();

    if (!query || !token || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Search YouTube
    let videoUrl = query;
    let title = 'Unknown Title';
    let artist = 'Unknown Artist';

    if (!query.startsWith('http')) {
      const filters1 = await ytsr.getFilters(query);
      const filter1 = filters1.get('Type')?.get('Video');
      if (!filter1?.url) throw new Error('Search failed');
      const searchResults = await ytsr(filter1.url, { limit: 1 });
      const item = searchResults.items[0] as any;
      if (!item) throw new Error('No video found');
      videoUrl = item.url;
      title = item.title;
      artist = item.author?.name || 'Unknown Artist';
    } else {
      const info = await ytdl.getBasicInfo(videoUrl);
      title = info.videoDetails.title;
      artist = info.videoDetails.author.name;
    }

    // Clean metadata
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      title = parts[1].trim();
    }

    // 2. Download Stream
    // Note: We stream directly to memory to avoid Vercel filesystem issues
    const stream = ytdl(videoUrl, { 
        filter: 'audioonly',
        quality: 'highestaudio'
    });

    const chunks: any[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // 3. Upload to iBroadcast
    const formData = new FormData();
    formData.append('file', buffer, {
        filename: `${artist} - ${title}.mp3`,
        contentType: 'audio/mpeg',
    });
    formData.append('user_id', userId);
    formData.append('token', token);
    formData.append('method', 'ibroadcast.upload');
    formData.append('client', 'shoma-music');
    formData.append('version', '1.0');
    formData.append('client_id', process.env.IBROADCAST_CLIENT_ID);
    formData.append('client_secret', process.env.IBROADCAST_CLIENT_SECRET);

    const uploadRes = await axios.post('https://sync.ibroadcast.com', formData, {
        headers: {
            ...formData.getHeaders(),
        },
    });

    if (uploadRes.data.result === false) {
        return NextResponse.json({ error: uploadRes.data.message || 'Upload failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, title, artist });
  } catch (error: any) {
    console.error('Download/Upload Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
