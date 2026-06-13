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
        
        // Use ANDROID_MUSIC client as it's often most reliable for audio-only
        const info = await yt.getInfo(videoId, { client: 'ANDROID_MUSIC' });
        const format = info.chooseFormat({ type: 'audio', quality: 'best' });
        
        if (!format) throw new Error('No suitable audio format found');
        
        const stream = await info.download({
            type: 'audio',
            quality: 'best',
            format: 'mp4',
            client: 'ANDROID_MUSIC'
        });

        // Convert the ReadableStream to a Response
        return new Response(stream as any, {
            headers: {
                'Content-Type': 'audio/mp4',
                'Cache-Control': 'public, max-age=3600',
                'Accept-Ranges': 'bytes',
            },
        });
    } catch (error: any) {
        console.error('[SHOMA] Stream API Error:', error.message);
        ytInstance = null; // Reset on failure
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
