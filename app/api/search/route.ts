import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    console.log(`[SHOMA] Searching for: ${query}`);
    
    // Search using youtubei.js (resilient to most blocks)
    const yt = await Innertube.create();
    const search = await yt.search(query, { type: 'video' });
    
    const results = search.videos;
    
    if (!results || !results.length) {
      return NextResponse.json({ results: [] });
    }
    
    const formattedResults = results.slice(0, 20).map((video: any) => {
      let durationStr = '0:00';
      if (video.duration) {
        durationStr = video.duration.text || video.duration.toString();
      }
      return {
        uid: `yt-${video.id}`,
        ytId: video.id,
        title: video.title?.text || video.title || 'Unknown Title',
        artist: video.author?.name || 'Unknown Artist',
        album: 'YouTube',
        duration: durationStr,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        artwork: video.thumbnails?.[0]?.url || '',
        source: 'youtube'
      };
    });

    return NextResponse.json({ results: formattedResults });
  } catch (error: any) {
    console.error('[SHOMA] Search ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
