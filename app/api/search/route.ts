import { NextRequest, NextResponse } from 'next/server';
import yts from 'yt-search';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    console.log(`[SHOMA] Searching for: ${query}`);
    
    // We search on YouTube
    const results = await yts(query);
    
    if (!results.videos || !results.videos.length) {
      return NextResponse.json({ results: [] });
    }
    
    const formattedResults = results.videos
      .slice(0, 20)
      .map((video: any) => {
        return {
          id: video.videoId,
          title: video.title,
          artist: video.author?.name || 'Unknown Artist',
          duration: video.timestamp || '0:00',
          url: video.url,
          artwork: video.thumbnail || ''
        };
      });

    return NextResponse.json({ results: formattedResults });
  } catch (error: any) {
    console.error('[SHOMA] Search ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
