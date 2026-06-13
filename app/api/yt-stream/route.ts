import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const maxDuration = 60;

// Cache the Innertube instance for faster subsequent requests
let ytInstance: Innertube | null = null;
async function getYt() {
    if (!ytInstance) {
        ytInstance = await Innertube.create();
    }
    return ytInstance;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) {
        return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
    }

    try {
        console.log(`[SHOMA] Streaming YouTube audio for ID: ${videoId}`);
        const yt = await getYt();
        
        // Use multiple clients for robustness
        const clients: ('YTMUSIC_ANDROID' | 'TV' | 'ANDROID_VR' | 'MWEB')[] = ['YTMUSIC_ANDROID', 'TV', 'ANDROID_VR', 'MWEB'];
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

                console.log(`[SHOMA] Successfully started stream with client: ${clientType}`);

                // Return a streaming response with proper headers
                return new Response(stream as any, {
                    headers: {
                        'Content-Type': 'audio/mp4',
                        'Accept-Ranges': 'bytes',
                        'Cache-Control': 'public, max-age=3600',
                        'Content-Disposition': `attachment; filename="${videoId}.mp4"`
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
        // If the cached instance failed, try resetting it for the next request
        ytInstance = null;
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
