import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// High-availability Piped & Invidious instances
const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.victr.me",
    "https://piped-api.garudalinux.org",
    "https://pipedapi.aeong.one",
    "https://pipedapi.leptons.xyz"
];

const INVIDIOUS_INSTANCES = [
    "https://yewtu.be",
    "https://invidious.projectsegfau.lt",
    "https://invidious.nerdvpn.de",
    "https://inv.vern.cc",
    "https://invidious.no-logs.com"
];

async function tryPiped(videoId: string) {
    for (const instance of PIPED_INSTANCES) {
        try {
            console.log(`[SHOMA] Trying Piped: ${instance}`);
            const res = await fetch(`${instance}/streams/${videoId}`, { signal: AbortSignal.timeout(3000) });
            if (!res.ok) continue;
            const data = await res.json();
            const stream = data.audioStreams?.find((s: any) => s.format === 'M4A') || data.audioStreams?.[0];
            if (stream?.url) return stream.url;
        } catch (e) {}
    }
    return null;
}

async function tryInvidious(videoId: string) {
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            console.log(`[SHOMA] Trying Invidious: ${instance}`);
            const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(3000) });
            if (!res.ok) continue;
            const data = await res.json();
            const format = data.adaptiveFormats?.find((f: any) => f.type.startsWith('audio/'));
            if (format?.url) {
                return format.url.startsWith('http') ? format.url : `${instance}${format.url}`;
            }
        } catch (e) {}
    }
    return null;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    try {
        console.log(`[SHOMA] Ultra-Resilient stream request for: ${videoId}`);

        // Try Piped first (fastest)
        const pipedUrl = await tryPiped(videoId);
        if (pipedUrl) {
            console.log(`[SHOMA] Piped Redirect SUCCESS`);
            return NextResponse.redirect(pipedUrl, 307);
        }

        // Try Invidious second
        const invUrl = await tryInvidious(videoId);
        if (invUrl) {
            console.log(`[SHOMA] Invidious Redirect SUCCESS`);
            return NextResponse.redirect(invUrl, 307);
        }

        // Try Cobalt last (sometimes slow)
        try {
            const cobaltRes = await fetch("https://api.cobalt.tools/api/json", {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, isAudioOnly: true, aFormat: "mp3" }),
                signal: AbortSignal.timeout(5000)
            });
            const cobaltData = await cobaltRes.json();
            if (cobaltData.url) {
                console.log(`[SHOMA] Cobalt Redirect SUCCESS`);
                return NextResponse.redirect(cobaltData.url, 307);
            }
        } catch (e) {}

        throw new Error("All anonymous pipes blocked");
    } catch (error: any) {
        console.error('[SHOMA] Critical Failure:', error.message);
        return NextResponse.json({ error: 'YouTube is blocking all our secret paths. Please try again.' }, { status: 500 });
    }
}
