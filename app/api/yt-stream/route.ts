import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) {
        return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        console.log(`[SHOMA] Direct-Link Request: ${videoId}`);

        // 1. Try Cobalt (Fastest and very stable)
        try {
            const res = await fetch("https://api.cobalt.tools/api/json", {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ url: videoUrl, isAudioOnly: true, aFormat: "mp3" })
            });
            const data = await res.json();
            if (data.url) {
                console.log(`[SHOMA] Cobalt Redirect SUCCESS`);
                return NextResponse.redirect(data.url);
            }
        } catch (e) {}

        // 2. Try Piped API (Most reliable fallback)
        const pipedInstances = [
            "https://pipedapi.kavin.rocks",
            "https://api.piped.victr.me",
            "https://piped-api.garudalinux.org"
        ];

        for (const instance of pipedInstances) {
            try {
                const res = await fetch(`${instance}/streams/${videoId}`);
                const data = await res.json();
                const audioStream = data.audioStreams?.find((s: any) => s.format === 'M4A' || s.format === 'WEBM_OPUS') || data.audioStreams?.[0];
                if (audioStream?.url) {
                    console.log(`[SHOMA] Piped Redirect SUCCESS (${instance})`);
                    return NextResponse.redirect(audioStream.url);
                }
            } catch (e) {}
        }

        throw new Error("No playable links found");

    } catch (error: any) {
        console.error('[SHOMA] Final Fail:', error.message);
        return NextResponse.json({ error: 'Playback failed. All sources blocked.' }, { status: 500 });
    }
}
