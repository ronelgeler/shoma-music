import { NextRequest, NextResponse } from 'next/server';
import play from 'play-dl';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    console.log(`[SHOMA] Searching for: ${query}`);
    
    // Search using play-dl (resilient to most blocks)
    const results = await play.search(query, { 
      limit: 20,
      source: { youtube: 'video' }
    });
    
    if (!results || !results.length) {
      return NextResponse.json({ results: [] });
    }
    
    const formattedResults = results.map((video: any) => {
      return {
        id: video.id,
        title: video.title,
        artist: video.channel?.name || 'Unknown Artist',
        duration: video.durationRaw || '0:00',
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
