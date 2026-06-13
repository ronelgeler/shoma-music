import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.victr.me",
    "https://piped-api.garudalinux.org",
    "https://pipedapi.aeong.one",
    "https://pipedapi.leptons.xyz",
    "https://pipedapi.rivm.me",
    "https://pipedapi.drgns.space",
    "https://piped-api.lunar.icu",
    "https://api-piped.mha.fi",
    "https://piped-api.hostux.net"
];

const INVIDIOUS_INSTANCES = [
    "https://yewtu.be",
    "https://invidious.projectsegfau.lt",
    "https://invidious.nerdvpn.de",
    "https://inv.vern.cc",
    "https://invidious.no-logs.com",
    "https://invidious.tiekoetter.com",
    "https://invidious.snopyta.org",
    "https://invidious.kavin.rocks",
    "https://inv.riverside.rocks",
    "https://invidious.site"
];

const COBALT_INSTANCES = [
    "https://api.cobalt.tools/api/json",
    "https://cobalt.dark-viper.xyz/api/json",
    "https://cobalt-api.kavin.rocks/api/json",
    "https://cobalt.qbit.rocks/api/json"
];

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const links: { url: string, source: string }[] = [];
    console.log(`[SHOMA] Infinite Mirror request: ${videoId}`);

    // 1. Try Piped (Parallel-ish)
    const pipedPromises = PIPED_INSTANCES.slice(0, 6).map(async (instance) => {
        try {
            const res = await fetch(`${instance}/streams/${videoId}`, { signal: AbortSignal.timeout(4000) });
            if (res.ok) {
                const data = await res.json();
                const stream = data.audioStreams?.find((s: any) => s.format === 'M4A') || data.audioStreams?.[0];
                if (stream?.url) return { url: stream.url, source: `Piped Mirror` };
            }
        } catch (e) {}
        return null;
    });

    // 2. Try Invidious (Parallel-ish)
    const invidiousPromises = INVIDIOUS_INSTANCES.slice(0, 6).map(async (instance) => {
        try {
            const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(4000) });
            if (res.ok) {
                const data = await res.json();
                const format = data.adaptiveFormats?.find((f: any) => f.type.startsWith('audio/'));
                if (format?.url) {
                    const finalUrl = format.url.startsWith('http') ? format.url : `${instance}${format.url}`;
                    return { url: finalUrl, source: `Invidious Mirror` };
                }
            }
        } catch (e) {}
        return null;
    });

    // 3. Try Cobalt Mirrors
    const cobaltPromises = COBALT_INSTANCES.map(async (instance) => {
        try {
            const res = await fetch(instance, {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, isAudioOnly: true, aFormat: "mp3" }),
                signal: AbortSignal.timeout(6000)
            });
            const data = await res.json();
            if (data.url) return { url: data.url, source: 'Cobalt Mirror' };
        } catch (e) {}
        return null;
    });

    const results = await Promise.all([...pipedPromises, ...invidiousPromises, ...cobaltPromises]);
    const validLinks = results.filter((l): l is { url: string, source: string } => !!l);
    
    links.push(...validLinks);

    // 4. Fallback: Extraction API
    try {
        const res = await fetch(`https://api.vevioz.com/api/button/mp3/${videoId}`, { signal: AbortSignal.timeout(5000) });
        const text = await res.text();
        const match = text.match(/href="(https:\/\/.*?\.mp3.*?)"/);
        if (match?.[1]) links.push({ url: match[1], source: 'Emergency Proxy' });
    } catch (e) {}

    if (links.length === 0) {
        return NextResponse.json({ error: 'YouTube is blocking all paths. Try again later.' }, { status: 500 });
    }

    // Sort links to try mirrors first
    return NextResponse.json({ links });
}
