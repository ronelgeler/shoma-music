import { NextRequest, NextResponse } from 'next/server';
import scdl from 'soundcloud-downloader';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    console.log(`[SHOMA] Searching for: ${query}`);
    
    // We search on SoundCloud for tracks to provide a list
    const results = await scdl.search({ query, resourceType: 'tracks', limit: 20 });
    
    if (!results.collection || !results.collection.length) {
      return NextResponse.json({ results: [] });
    }
    
    const formattedResults = results.collection
      .filter((track: any) => track.duration >= 60000) // Exclude < 1 minute (previews)
      .slice(0, 10)
      .map((track: any) => {
        const totalSeconds = Math.floor(track.duration / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        return {
          id: track.id,
          title: track.title,
          artist: track.user?.username || 'Unknown',
          duration: durationStr,
          url: track.permalink_url,
          artwork: track.artwork_url || track.user?.avatar_url
        };
      });

    return NextResponse.json({ results: formattedResults });
  } catch (error: any) {
    console.error('[SHOMA] Search ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
