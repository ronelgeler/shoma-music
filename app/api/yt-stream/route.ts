import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) {
        return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
    }

    try {
        console.log(`[SHOMA] Streaming YouTube audio for ID: ${videoId}`);
        const yt = await Innertube.create();
        
        // Try multiple clients if one fails, similar to download route
        const clients: ('YTMUSIC_ANDROID' | 'TV' | 'MWEB' | 'ANDROID_VR')[] = ['YTMUSIC_ANDROID', 'TV', 'MWEB', 'ANDROID_VR'];
        let lastError = '';
        
        for (const clientType of clients) {
            try {
                const info = await yt.getInfo(videoId, { client: clientType as any });
                const stream = await info.download({
                    type: 'audio',
                    quality: 'best',
                    format: 'mp4',
                    client: clientType as any
                });

                // Return a streaming response
                return new Response(stream as any, {
                    headers: {
                        'Content-Type': 'audio/mp4',
                        'Cache-Control': 'public, max-age=3600',
                    },
                });
            } catch (e: any) {
                console.warn(`[SHOMA] Stream client ${clientType} failed: ${e.message}`);
                lastError = e.message;
            }
        }

        throw new Error(`Failed to stream from any client: ${lastError}`);
    } catch (error: any) {
        console.error('[SHOMA] Stream API Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
