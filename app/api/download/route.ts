import { NextRequest, NextResponse } from 'next/server';
import ytSearch from 'yt-search';
import ytdl from '@distube/ytdl-core';
import scdl from 'soundcloud-downloader';
import axios from 'axios';
import FormData from 'form-data';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { query, token, userId } = await req.json();

    if (!query || !token || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    console.log(`Processing download request for: ${query}`);

    let stream: any = null;
    let title = 'Unknown Title';
    let artist = 'Unknown Artist';
    let source = 'YouTube';

    try {
      // 1. Try YouTube Search/Info
      let videoUrl = query;
      if (!query.startsWith('http')) {
        const searchResults = await ytSearch(query);
        const video = searchResults.videos[0];
        if (!video) throw new Error('No YouTube video found');
        videoUrl = video.url;
        title = video.title;
        artist = video.author.name || 'Unknown Artist';
      } else {
        const info = await ytdl.getBasicInfo(videoUrl);
        title = info.videoDetails.title;
        artist = info.videoDetails.author.name;
      }

      console.log(`Attempting YouTube download: ${title}`);
      
      // Attempt YouTube stream
      stream = ytdl(videoUrl, { 
        filter: 'audioonly',
        quality: 'highestaudio',
        requestOptions: {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
        }
      });
      
      // Test if stream starts
      await new Promise((resolve, reject) => {
          stream.once('data', () => resolve(true));
          stream.once('error', (err: any) => reject(err));
          setTimeout(() => reject(new Error('YouTube timeout')), 5000);
      });

    } catch (ytError: any) {
      console.warn(`YouTube failed: ${ytError.message}. Switching to SoundCloud...`);
      source = 'SoundCloud';
      
      // 2. Fallback to SoundCloud Search
      const scSearch = await axios.get(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=LBCP97S7mYp4SlszAsF82KvlF708nKsc`);
      const track = scSearch.data.collection?.[0];
      
      if (!track) throw new Error('Could not find song on YouTube or SoundCloud');
      
      title = track.title;
      artist = track.user?.username || 'Unknown Artist';
      console.log(`SoundCloud found: ${title}`);
      
      stream = await scdl.download(track.permalink_url);
    }

    // Clean metadata logic
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      title = parts[1].trim();
    }

    // 3. Collect Chunks into Buffer
    const chunks: any[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    console.log(`Successfully buffered ${buffer.length} bytes from ${source}`);

    // 4. Upload to iBroadcast
    const formData = new FormData();
    const cleanFilename = `${artist} - ${title}.mp3`.replace(/[/\\?%*:|"<>]/g, '-');
    
    formData.append('file', buffer, {
        filename: cleanFilename,
        contentType: 'audio/mpeg',
    });
    formData.append('user_id', userId);
    formData.append('token', token);
    formData.append('method', 'ibroadcast.upload');
    formData.append('client', 'shoma-music');
    formData.append('version', '1.2');
    formData.append('file_path', cleanFilename);
    formData.append('client_id', process.env.IBROADCAST_CLIENT_ID);
    formData.append('client_secret', process.env.IBROADCAST_CLIENT_SECRET);

    const uploadRes = await axios.post('https://sync.ibroadcast.com', formData, {
        headers: {
            ...formData.getHeaders(),
        },
    });

    if (uploadRes.data.result === false) {
        console.error('iBroadcast Upload Error:', uploadRes.data);
        return NextResponse.json({ error: uploadRes.data.message || 'Upload failed' }, { status: 500 });
    }

    console.log('Upload successful!');
    return NextResponse.json({ success: true, title, artist, source });
  } catch (error: any) {
    console.error('Download/Upload Overhaul Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
