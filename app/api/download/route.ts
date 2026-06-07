import { NextRequest, NextResponse } from 'next/server';
import ytSearch from 'yt-search';
import ytdl from '@distube/ytdl-core';
import axios from 'axios';
import FormData from 'form-data';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { query, token, userId } = await req.json();

    if (!query || !token || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    let videoUrl = query;
    let title = 'Unknown Title';
    let artist = 'Unknown Artist';

    // 1. Search YouTube or Get Info
    if (!query.startsWith('http')) {
      const searchResults = await ytSearch(query);
      const video = searchResults.videos[0];
      if (!video) throw new Error('No video found');
      videoUrl = video.url;
      title = video.title;
      artist = video.author.name || 'Unknown Artist';
    } else {
      const info = await ytdl.getBasicInfo(videoUrl);
      title = info.videoDetails.title;
      artist = info.videoDetails.author.name;
    }

    // Clean metadata logic
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      title = parts[1].trim();
    } else if (title.includes(' by ')) {
        const parts = title.split(' by ');
        title = parts[0].trim();
        artist = parts[1].trim();
    }

    // 2. Download Stream (Memory)
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
    formData.append('version', '1.1');
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
