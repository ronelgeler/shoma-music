import { NextRequest, NextResponse } from 'next/server';
import { Innertube, UniversalCache } from 'youtubei.js';

export const maxDuration = 60;

const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.victr.me",
    "https://piped-api.garudalinux.org",
    "https://pipedapi.aeong.one",
    "https://pipedapi.leptons.xyz",
    "https://pipedapi.rivm.me",
    "https://pipedapi.drgns.space"
];

const INVIDIOUS_INSTANCES = [
    "https://yewtu.be",
    "https://invidious.projectsegfau.lt",
    "https://invidious.nerdvpn.de",
    "https://inv.vern.cc",
    "https://invidious.no-logs.com",
    "https://invidious.tiekoetter.com",
    "https://invidious.snopyta.org"
];

async function tryPiped(videoId: string, count = 4) {
    const found: { url: string, source: string }[] = [];
    for (const instance of PIPED_INSTANCES.slice(0, count)) {
        try {
            const res = await fetch(`${instance}/streams/${videoId}`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data = await res.json();
                const stream = data.audioStreams?.find((s: any) => s.format === 'M4A') || data.audioStreams?.[0];
                if (stream?.url) found.push({ url: stream.url, source: `Piped (${new URL(instance).hostname})` });
            }
        } catch (e) {}
        if (found.length >= 2) break;
    }
    return found;
}

async function tryInvidious(videoId: string, count = 3) {
    const found: { url: string, source: string }[] = [];
    for (const instance of INVIDIOUS_INSTANCES.slice(0, count)) {
        try {
            const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data = await res.json();
                const format = data.adaptiveFormats?.find((f: any) => f.type.startsWith('audio/'));
                if (format?.url) {
                    const finalUrl = format.url.startsWith('http') ? format.url : `${instance}${format.url}`;
                    found.push({ url: finalUrl, source: `Invidious (${new URL(instance).hostname})` });
                }
            }
        } catch (e) {}
        if (found.length >= 2) break;
    }
    return found;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const links: { url: string, source: string }[] = [];

    // 1. Try Innertube Direct (TV client is often browser-playable without proxy)
    try {
        console.log(`[SHOMA] Trying Innertube Direct...`);
        const yt = await Innertube.create({ generate_session_locally: true });
        const info = await yt.getInfo(videoId, { client: 'TV' });
        const format = info.chooseFormat({ type: 'audio', quality: 'best' });
        if (format?.url) {
            links.push({ url: format.url, source: 'YouTube Direct (TV)' });
        }
    } catch (e) {
        console.warn('[SHOMA] Innertube direct failed:', e.message);
    }

    // 2. Try Piped
    const piped = await tryPiped(videoId);
    links.push(...piped);

    // 3. Try Cobalt
    try {
        const cobaltRes = await fetch("https://api.cobalt.tools/api/json", {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, isAudioOnly: true, aFormat: "mp3" }),
            signal: AbortSignal.timeout(5000)
        });
        const cobaltData = await cobaltRes.json();
        if (cobaltData.url) links.push({ url: cobaltData.url, source: 'Cobalt' });
    } catch (e) {}

    // 4. Try Invidious
    const inv = await tryInvidious(videoId);
    links.push(...inv);

    if (links.length === 0) {
        return NextResponse.json({ error: 'All paths blocked by YouTube. This song might be restricted.' }, { status: 500 });
    }

    return NextResponse.json({ links });
}
