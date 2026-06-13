import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// High-reliability public proxies and specialized APIs
const PROXY_STRATEGIES = [
    // 1. YouTube-MP3 API (Highly reliable specialized proxy)
    async (id: string) => {
        try {
            const res = await fetch(`https://api.vevioz.com/api/button/mp3/${id}`, { signal: AbortSignal.timeout(4000) });
            const text = await res.text();
            const match = text.match(/href="(https:\/\/.*?\.mp3.*?)"/);
            if (match?.[1]) return { url: match[1], source: 'Vevioz Proxy' };
        } catch (e) {}
        return null;
    },
    // 2. Direct Piped Instances (Curated for reliability)
    async (id: string) => {
        const instances = ["https://pipedapi.kavin.rocks", "https://api.piped.victr.me", "https://piped-api.garudalinux.org"];
        for (const instance of instances) {
            try {
                const res = await fetch(`${instance}/streams/${id}`, { signal: AbortSignal.timeout(3000) });
                if (!res.ok) continue;
                const data = await res.json();
                const stream = data.audioStreams?.find((s: any) => s.format === 'M4A') || data.audioStreams?.[0];
                if (stream?.url) return { url: stream.url, source: `Piped (${new URL(instance).hostname})` };
            } catch (e) {}
        }
        return null;
    },
    // 3. Cobalt API (Stable fallback)
    async (id: string) => {
        try {
            const res = await fetch("https://api.cobalt.tools/api/json", {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${id}`, isAudioOnly: true, aFormat: "mp3" }),
                signal: AbortSignal.timeout(5000)
            });
            const data = await res.json();
            if (data.url) return { url: data.url, source: 'Cobalt' };
        } catch (e) {}
        return null;
    }
];

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const links: { url: string, source: string }[] = [];

    console.log(`[SHOMA] Nuclear stream request: ${videoId}`);

    for (const strategy of PROXY_STRATEGIES) {
        const link = await strategy(videoId);
        if (link) {
            links.push(link);
            // If we found the highly reliable one, we can stop early to be fast
            if (links.length >= 2) break;
        }
    }

    if (links.length === 0) {
        return NextResponse.json({ error: 'YouTube is aggressively blocking. Try later.' }, { status: 500 });
    }

    return NextResponse.json({ links });
}
