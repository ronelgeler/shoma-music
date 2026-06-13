import { NextRequest, NextResponse } from 'next/server';
import { Innertube, UniversalCache } from 'youtubei.js';

// @ts-ignore
import ytdl from 'ytdl-core-enhanced';

export const maxDuration = 60;

function parseCookies(str: string) {
    if (!str) return '';
    if (str.includes('\t') || str.includes('# Netscape')) {
        return str.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                const parts = line.split('\t');
                if (parts.length >= 7) return `${parts[5]}=${parts[6]}`;
                return null;
            })
            .filter(Boolean).join('; ');
    }
    return str;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');

    if (!videoId) {
        return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
    }

    try {
        console.log(`[SHOMA] Ultimate Resilient request: ${videoId}`);
        
        // 1. Fresh Innertube Session with specialized clients
        const yt = await Innertube.create({
            generate_session_locally: true,
            retrieve_player: true
        });
        
        const clients: any[] = ['ANDROID_VR', 'TV', 'MWEB', 'IOS'];
        for (const clientType of clients) {
            try {
                console.log(`[SHOMA] Trying client: ${clientType}`);
                const info = await yt.getInfo(videoId, { client: clientType });
                const format = info.chooseFormat({ type: 'audio', quality: 'best', format: 'mp4' });

                if (format) {
                    const stream = await info.download({
                        type: 'audio',
                        quality: 'best',
                        format: 'mp4',
                        client: clientType
                    });

                    console.log(`[SHOMA] SUCCESS with ${clientType}`);
                    return new Response(stream as any, {
                        headers: {
                            'Content-Type': 'audio/mp4',
                            'Accept-Ranges': 'bytes',
                            'Cache-Control': 'public, max-age=3600',
                        },
                    });
                }
            } catch (e: any) {
                console.warn(`[SHOMA] Client ${clientType} failed:`, e.message);
            }
        }

        // 2. Fallback: Cobalt with multiple instances
        const cobaltInstances = [
            "https://api.cobalt.tools/api/json",
            "https://cobalt.dark-viper.xyz/api/json",
            "https://cobalt-api.kavin.rocks/api/json"
        ];

        for (const instance of cobaltInstances) {
            try {
                console.log(`[SHOMA] Trying Cobalt instance: ${instance}`);
                const res = await fetch(instance, {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json" },
                    body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, isAudioOnly: true, aFormat: "mp3" })
                });
                const data = await res.json();
                if (data.url) {
                    console.log(`[SHOMA] Cobalt SUCCESS`);
                    const audioRes = await fetch(data.url);
                    return new Response(audioRes.body as any, {
                        headers: { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' },
                    });
                }
            } catch (e) { console.warn(`[SHOMA] Cobalt instance ${instance} failed`); }
        }

        // 3. Fallback: Direct Invidious Redirect (Fast & usually works in browser)
        const invidiousInstances = ['https://yewtu.be', 'https://invidious.snopyta.org', 'https://vid.puffyan.us'];
        for (const instance of invidiousInstances) {
            try {
                console.log(`[SHOMA] Trying Invidious instance: ${instance}`);
                const streamUrl = `${instance}/latest/api/v1/videos/${videoId}`;
                const invRes = await fetch(streamUrl);
                const invData = await invRes.json();
                const audioFormat = invData.adaptiveFormats?.find((f: any) => f.type.startsWith('audio/'));
                if (audioFormat?.url) {
                    console.log(`[SHOMA] Invidious SUCCESS`);
                    const audioRes = await fetch(audioFormat.url);
                    return new Response(audioRes.body as any, {
                        headers: { 'Content-Type': 'audio/mp4', 'Accept-Ranges': 'bytes' },
                    });
                }
            } catch (e) {}
        }

        // 4. Final: ytdl-core-enhanced
        console.warn(`[SHOMA] All specialized methods failed, using final ytdl fallback`);
        const stream = ytdl(videoId, {
            filter: 'audioonly',
            quality: 'highestaudio',
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
                }
            }
        });
        return new Response(stream as any, {
            headers: { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes' },
        });

    } catch (error: any) {
        console.error('[SHOMA] Critical Global Stream Error:', error.message);
        return NextResponse.json({ error: 'Playback failed. YouTube is blocking. Try another song or try later.' }, { status: 500 });
    }
}
