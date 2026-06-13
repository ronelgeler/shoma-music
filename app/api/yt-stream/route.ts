import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const STABLE_PIPES = [
    "https://redirect.invidious.io",
    "https://pipedapi.kavin.rocks",
    "https://api.piped.victr.me",
    "https://piped-api.garudalinux.org",
    "https://yewtu.be",
    "https://invidious.projectsegfau.lt",
    "https://inv.vern.cc"
];

async function validateLink(url: string) {
    try {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch (e) { return false; }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const links: { url: string, source: string }[] = [];
    console.log(`[SHOMA] Validated Mirror request: ${videoId}`);

    // Parallel discovery and validation
    const discoveryPromises = STABLE_PIPES.map(async (instance) => {
        try {
            const isPiped = instance.includes('piped');
            const endpoint = isPiped ? `${instance}/streams/${videoId}` : `${instance}/api/v1/videos/${videoId}`;
            
            const res = await fetch(endpoint, { signal: AbortSignal.timeout(4000) });
            if (!res.ok) return null;
            const data = await res.json();
            
            let candidateUrl = '';
            let sourceName = '';

            if (isPiped) {
                candidateUrl = data.audioStreams?.find((s: any) => s.format === 'M4A')?.url || data.audioStreams?.[0]?.url;
                sourceName = 'Piped Mirror';
            } else {
                const format = data.adaptiveFormats?.find((f: any) => f.type.startsWith('audio/'));
                if (format?.url) {
                    candidateUrl = format.url.startsWith('http') ? format.url : `${instance}${format.url}`;
                    sourceName = 'Invidious Mirror';
                }
            }

            if (candidateUrl && await validateLink(candidateUrl)) {
                return { url: candidateUrl, source: sourceName };
            }
        } catch (e) {}
        return null;
    });

    // Also try specialized APIs
    const cobaltPromise = (async () => {
        try {
            const res = await fetch("https://api.cobalt.tools/api/json", {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, isAudioOnly: true, aFormat: "mp3" }),
                signal: AbortSignal.timeout(5000)
            });
            const data = await res.json();
            if (data.url && await validateLink(data.url)) return { url: data.url, source: 'Cobalt Mirror' };
        } catch (e) {}
        return null;
    })();

    const results = await Promise.all([...discoveryPromises, cobaltPromise]);
    const validLinks = results.filter((l): l is { url: string, source: string } => !!l);
    links.push(...validLinks);

    if (links.length === 0) {
        // Ultimate Fallback: Direct MP3 Extraction API (No validation needed, it's a redirect anyway)
        links.push({ url: `https://api.vevioz.com/api/button/mp3/${videoId}`, source: 'Emergency Proxy' });
    }

    return NextResponse.json({ links });
}
