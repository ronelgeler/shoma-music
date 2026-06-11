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
    const results = await scdl.search({ query, resourceType: 'tracks', limit: 10 });
    
    if (!results.collection || !results.collection.length) {
      return NextResponse.json({ results: [] });
    }
    
    const formattedResults = results.collection.map((track: any) => ({
      id: track.id,
      title: track.title,
      artist: track.user?.username || 'Unknown',
      duration: track.duration,
      url: track.permalink_url,
      artwork: track.artwork_url || track.user?.avatar_url
    }));

    return NextResponse.json({ results: formattedResults });
  } catch (error: any) {
    console.error('[SHOMA] Search ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
