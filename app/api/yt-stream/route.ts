import { NextRequest, NextResponse } from 'next/server';
import { Innertube, UniversalCache } from 'youtubei.js';

// @ts-ignore
import ytdl from 'ytdl-core-enhanced';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) {
        return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        console.log(`[SHOMA] Super-Redirect request: ${videoId}`);

        // 1. Priority: Cobalt API (Direct Browser-Friendly URL)
        const cobaltInstances = [
            "https://api.cobalt.tools/api/json",
            "https://cobalt.dark-viper.xyz/api/json",
            "https://cobalt-api.kavin.rocks/api/json"
        ];

        for (const instance of cobaltInstances) {
            try {
                console.log(`[SHOMA] Trying Cobalt Redirect: ${instance}`);
                const res = await fetch(instance, {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json" },
                    body: JSON.stringify({ url: videoUrl, isAudioOnly: true, aFormat: "mp3" })
                });
                const data = await res.json();
                if (data.url) {
                    console.log(`[SHOMA] Cobalt Redirect SUCCESS`);
                    return NextResponse.redirect(data.url);
                }
            } catch (e) { console.warn(`[SHOMA] Cobalt ${instance} failed`); }
        }

        // 2. Secondary: Invidious Direct Audio URL
        const invidiousInstances = ['https://yewtu.be', 'https://invidious.snopyta.org', 'https://vid.puffyan.us'];
        for (const instance of invidiousInstances) {
            try {
                console.log(`[SHOMA] Trying Invidious Redirect: ${instance}`);
                const streamUrl = `${instance}/latest/api/v1/videos/${videoId}`;
                const invRes = await fetch(streamUrl);
                const invData = await invRes.json();
                const audioFormat = invData.adaptiveFormats?.find((f: any) => f.type.startsWith('audio/'));
                if (audioFormat?.url) {
                    console.log(`[SHOMA] Invidious Redirect SUCCESS`);
                    const finalUrl = audioFormat.url.startsWith('http') ? audioFormat.url : `${instance}${audioFormat.url}`;
                    return NextResponse.redirect(finalUrl);
                }
            } catch (e) {}
        }

        // 3. Last Resort: Proxy through Innertube
        console.warn(`[SHOMA] All redirects failed, trying local proxy...`);
        const yt = await Innertube.create({ generate_session_locally: true });
        const info = await yt.getInfo(videoId, { client: 'TV' });
        const format = info.chooseFormat({ type: 'audio', quality: 'best' });
        
        if (format) {
            const stream = await info.download({ type: 'audio', quality: 'best', client: 'TV' });
            return new Response(stream as any, {
                headers: { 'Content-Type': 'audio/mp4', 'Accept-Ranges': 'bytes' },
            });
        }

        throw new Error("No playable source found");

    } catch (error: any) {
        console.error('[SHOMA] Super-Redirect Global Error:', error.message);
        return NextResponse.json({ error: 'YouTube is blocking our servers. Please try again or use a different song.' }, { status: 500 });
    }
}
