import { NextRequest, NextResponse } from 'next/server';
import youtube from 'youtube-ext';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    console.log(`[SHOMA] Searching for: ${query}`);
    
    // We search on YouTube
    const results = await youtube.search(query, { limit: 20 });
    
    if (!results.videos || !results.videos.length) {
      return NextResponse.json({ results: [] });
    }
    
    const formattedResults = results.videos
      .map((video: any) => {
        return {
          id: video.id,
          title: video.title,
          artist: video.channel?.name || 'Unknown Artist',
          duration: video.duration?.text || '0:00',
          url: video.url,
          artwork: video.thumbnails?.[0]?.url || ''
        };
      });

    return NextResponse.json({ results: formattedResults });
  } catch (error: any) {
    console.error('[SHOMA] Search ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
