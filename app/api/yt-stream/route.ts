import { NextRequest, NextResponse } from 'next/server';
import { Innertube, UniversalCache } from 'youtubei.js';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) {
        return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        console.log(`[SHOMA] Super-Pipe request: ${videoId}`);

        // 1. Try Piped API (Very stable direct stream extraction)
        const pipedInstances = [
            "https://pipedapi.kavin.rocks",
            "https://piped-api.garudalinux.org",
            "https://api.piped.victr.me"
        ];

        for (const instance of pipedInstances) {
            try {
                console.log(`[SHOMA] Trying Piped: ${instance}`);
                const res = await fetch(`${instance}/streams/${videoId}`);
                const data = await res.json();
                
                // Piped returns multiple audio streams, find the best one
                const audioStream = data.audioStreams?.find((s: any) => s.format === 'M4A' || s.format === 'WEBM_OPUS') || data.audioStreams?.[0];
                
                if (audioStream?.url) {
                    console.log(`[SHOMA] Piped Redirect SUCCESS`);
                    return NextResponse.redirect(audioStream.url, 307);
                }
            } catch (e) { console.warn(`[SHOMA] Piped instance ${instance} failed`); }
        }

        // 2. Try Invidious API
        const invidiousInstances = [
            "https://invidious.projectsegfau.lt",
            "https://yewtu.be",
            "https://invidious.nerdvpn.de"
        ];

        for (const instance of invidiousInstances) {
            try {
                console.log(`[SHOMA] Trying Invidious: ${instance}`);
                const res = await fetch(`${instance}/api/v1/videos/${videoId}`);
                const data = await res.json();
                
                const audioFormat = data.adaptiveFormats?.find((f: any) => f.type.startsWith('audio/'));
                if (audioFormat?.url) {
                    console.log(`[SHOMA] Invidious Redirect SUCCESS`);
                    const finalUrl = audioFormat.url.startsWith('http') ? audioFormat.url : `${instance}${audioFormat.url}`;
                    return NextResponse.redirect(finalUrl, 307);
                }
            } catch (e) { console.warn(`[SHOMA] Invidious ${instance} failed`); }
        }

        // 3. Fallback: Cobalt API
        try {
            console.log(`[SHOMA] Trying Cobalt...`);
            const res = await fetch("https://api.cobalt.tools/api/json", {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ url: videoUrl, isAudioOnly: true, aFormat: "mp3" })
            });
            const data = await res.json();
            if (data.url) {
                console.log(`[SHOMA] Cobalt Redirect SUCCESS`);
                return NextResponse.redirect(data.url, 307);
            }
        } catch (e) {}

        // 4. Last Resort: Local Innertube Proxy (Likely to fail on Vercel, but here as safety)
        const yt = await Innertube.create({ generate_session_locally: true });
        const info = await yt.getInfo(videoId, { client: 'TV' });
        const format = info.chooseFormat({ type: 'audio', quality: 'best' });
        
        if (format) {
            const stream = await info.download({ type: 'audio', quality: 'best', client: 'TV' });
            return new Response(stream as any, {
                headers: { 'Content-Type': 'audio/mp4', 'Accept-Ranges': 'bytes' },
            });
        }

        throw new Error("No working stream found");

    } catch (error: any) {
        console.error('[SHOMA] Super-Pipe Global Error:', error.message);
        return NextResponse.json({ error: 'All audio sources failed. YouTube is blocking.' }, { status: 500 });
    }
}
