import { NextRequest, NextResponse } from 'next/server';
import { Innertube, UniversalCache } from 'youtubei.js';

export const maxDuration = 60;

let ytInstance: Innertube | null = null;
async function getYt() {
    if (!ytInstance) {
        ytInstance = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true
        });
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
        console.log(`[SHOMA] Stream request for: ${videoId}`);
        const yt = await getYt();
        
        // Use 'TV' or 'ANDROID_VR' as they often have fewer restrictions for direct streaming
        const clients: any[] = ['TV', 'ANDROID_VR', 'MWEB', 'YTMUSIC_ANDROID'];
        let lastError = '';

        for (const clientType of clients) {
            try {
                console.log(`[SHOMA] Attempting stream with client: ${clientType}`);
                const info = await yt.getInfo(videoId, clientType);
                
                // Specifically choose an audio-only format that is likely to be stable
                const format = info.chooseFormat({ 
                    type: 'audio', 
                    quality: 'best',
                    format: 'mp4' 
                });

                if (!format) {
                    console.warn(`[SHOMA] No audio format for ${clientType}`);
                    continue;
                }

                const stream = await info.download({
                    type: 'audio',
                    quality: 'best',
                    format: 'mp4',
                    client: clientType
                });

                console.log(`[SHOMA] Stream starting for ${videoId} via ${clientType}`);

                return new Response(stream as any, {
                    headers: {
                        'Content-Type': 'audio/mp4',
                        'Accept-Ranges': 'bytes',
                        'Cache-Control': 'public, max-age=3600',
                        'Content-Disposition': 'inline'
                    },
                });
            } catch (e: any) {
                console.error(`[SHOMA] Client ${clientType} error:`, e.message);
                lastError = e.message;
            }
        }

        throw new Error(`Stream failed. Last error: ${lastError}`);
    } catch (error: any) {
        console.error('[SHOMA] Stream API Global Error:', error.message);
        ytInstance = null; // Force recreation on next hit
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
