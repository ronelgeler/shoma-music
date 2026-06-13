import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const maxDuration = 60;

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
        
        // Try multiple clients for stream extraction, not just one
        const clients: ('YTMUSIC_ANDROID' | 'TV' | 'ANDROID_VR' | 'MWEB' | 'IOS')[] = ['YTMUSIC_ANDROID', 'TV', 'ANDROID_VR', 'MWEB', 'IOS'];
        let lastError = '';

        for (const clientType of clients) {
            try {
                console.log(`[SHOMA] Stream attempt with client: ${clientType}`);
                const info = await yt.getInfo(videoId, { client: clientType as any });
                const stream = await info.download({
                    type: 'audio',
                    quality: 'best',
                    format: 'mp4',
                    client: clientType as any
                });

                console.log(`[SHOMA] Stream SUCCESS with client: ${clientType}`);

                return new Response(stream as any, {
                    headers: {
                        'Content-Type': 'audio/mp4',
                        'Accept-Ranges': 'bytes',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                    },
                });
            } catch (e: any) {
                console.error(`[SHOMA] Stream client ${clientType} FAILED:`, e.message);
                lastError = e.message;
            }
        }

        throw new Error(`All stream clients failed. Last error: ${lastError}`);
    } catch (error: any) {
        console.error('[SHOMA] Stream API Error:', error.message);
        ytInstance = null; // Reset on failure
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
