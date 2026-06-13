import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const INVIDIOUS_INSTANCES = [
    "https://inv.tux.pizza",
    "https://invidious.no-logs.com",
    "https://invidious.io.lol",
    "https://iv.ggtyler.dev",
    "https://invidious.namazso.eu",
    "https://invidious.projectsegfau.lt",
    "https://inv.vern.cc",
    "https://yewtu.be",
    "https://invidious.lunar.icu"
];

const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.victr.me",
    "https://piped-api.garudalinux.org",
    "https://pipedapi.aeong.one",
    "https://pipedapi.rivm.me"
];

async function checkUrl(url: string) {
    try {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch (e) { return false; }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    console.log(`[SHOMA] Hunter-Seeker request: ${videoId}`);

    // 1. Parallel Hunt for working Links
    const links: { url: string, source: string }[] = [];

    // Strategy A: Scrape specialized MP3 proxies
    const scrapeSpecial = async () => {
        try {
            const res = await fetch(`https://api.vevioz.com/api/button/mp3/${videoId}`, { signal: AbortSignal.timeout(4000) });
            const text = await res.text();
            const match = text.match(/href="(https:\/\/.*?\.mp3.*?)"/);
            if (match?.[1]) return { url: match[1], source: 'Direct MP3 Proxy' };
        } catch (e) {}
        return null;
    };

    // Strategy B: Invidious Parallel Discovery
    const huntInvidious = async () => {
        const promises = INVIDIOUS_INSTANCES.slice(0, 8).map(async (base) => {
            try {
                const res = await fetch(`${base}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(3500) });
                if (!res.ok) return null;
                const data = await res.json();
                const format = data.adaptiveFormats?.find((f: any) => f.type.startsWith('audio/'));
                if (format?.url) {
                    const url = format.url.startsWith('http') ? format.url : `${base}${format.url}`;
                    if (await checkUrl(url)) return { url, source: `Invidious (${new URL(base).hostname})` };
                }
            } catch (e) {}
            return null;
        });
        const results = await Promise.all(promises);
        return results.filter(Boolean);
    };

    // Strategy C: Piped Parallel Discovery
    const huntPiped = async () => {
        const promises = PIPED_INSTANCES.map(async (base) => {
            try {
                const res = await fetch(`${base}/streams/${videoId}`, { signal: AbortSignal.timeout(3500) });
                if (!res.ok) return null;
                const data = await res.json();
                const stream = data.audioStreams?.find((s: any) => s.format === 'M4A') || data.audioStreams?.[0];
                if (stream?.url) {
                    if (await checkUrl(stream.url)) return { url: stream.url, source: `Piped (${new URL(base).hostname})` };
                }
            } catch (e) {}
            return null;
        });
        const results = await Promise.all(promises);
        return results.filter(Boolean);
    };

    // Execute Hunt
    const [special, invs, piped] = await Promise.all([scrapeSpecial(), huntInvidious(), huntPiped()]);
    
    if (special) links.push(special as any);
    links.push(...(invs as any[]));
    links.push(...(piped as any[]));

    if (links.length === 0) {
        // Last-second emergency redirect (No validation, just hope)
        return NextResponse.json({ 
            links: [
                { url: `https://api.vevioz.com/api/button/mp3/${videoId}`, source: 'Emergency Proxy' },
                { url: `https://yt-api.cc/api/download/mp3/${videoId}`, source: 'Backup Proxy' }
            ]
        });
    }

    return NextResponse.json({ links });
}
