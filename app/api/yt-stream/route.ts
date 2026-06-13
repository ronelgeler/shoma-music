import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.victr.me",
    "https://piped-api.garudalinux.org",
    "https://pipedapi.aeong.one",
    "https://pipedapi.leptons.xyz",
    "https://pipedapi.rivm.me"
];

const INVIDIOUS_INSTANCES = [
    "https://yewtu.be",
    "https://invidious.projectsegfau.lt",
    "https://invidious.nerdvpn.de",
    "https://inv.vern.cc",
    "https://invidious.no-logs.com",
    "https://invidious.tiekoetter.com"
];

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const links: { url: string, source: string }[] = [];

    // 1. Try to get links from Piped (High Priority)
    for (const instance of PIPED_INSTANCES.slice(0, 3)) {
        try {
            const res = await fetch(`${instance}/streams/${videoId}`, { signal: AbortSignal.timeout(2500) });
            if (res.ok) {
                const data = await res.json();
                const stream = data.audioStreams?.find((s: any) => s.format === 'M4A') || data.audioStreams?.[0];
                if (stream?.url) links.push({ url: stream.url, source: `Piped (${new URL(instance).hostname})` });
            }
        } catch (e) {}
    }

    // 2. Try Cobalt (Medium Priority)
    try {
        const cobaltRes = await fetch("https://api.cobalt.tools/api/json", {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, isAudioOnly: true, aFormat: "mp3" }),
            signal: AbortSignal.timeout(4000)
        });
        const cobaltData = await cobaltRes.json();
        if (cobaltData.url) links.push({ url: cobaltData.url, source: 'Cobalt' });
    } catch (e) {}

    // 3. Try Invidious (Fallback Priority)
    for (const instance of INVIDIOUS_INSTANCES.slice(0, 2)) {
        try {
            const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data = await res.json();
                const format = data.adaptiveFormats?.find((f: any) => f.type.startsWith('audio/'));
                if (format?.url) {
                    const finalUrl = format.url.startsWith('http') ? format.url : `${instance}${format.url}`;
                    links.push({ url: finalUrl, source: `Invidious (${new URL(instance).hostname})` });
                }
            }
        } catch (e) {}
    }

    if (links.length === 0) {
        return NextResponse.json({ error: 'All paths blocked' }, { status: 500 });
    }

    return NextResponse.json({ links });
}
