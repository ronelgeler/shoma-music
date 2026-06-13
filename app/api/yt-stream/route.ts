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
        console.log(`[SHOMA] Anonymous stream request for: ${videoId}`);
        
        // 1. Primary: Innertube with 'TV' client (Best for anonymous streaming)
        const yt = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true
        });
        
        try {
            console.log(`[SHOMA] Attempting TV client stream for ${videoId}`);
            const info = await yt.getInfo(videoId, { client: 'TV' as any });
            const format = info.chooseFormat({ type: 'audio', quality: 'best', format: 'mp4' });

            if (format) {
                const stream = await info.download({
                    type: 'audio',
                    quality: 'best',
                    format: 'mp4',
                    client: 'TV'
                });

                console.log(`[SHOMA] TV client stream SUCCESS`);
                return new Response(stream as any, {
                    headers: {
                        'Content-Type': 'audio/mp4',
                        'Accept-Ranges': 'bytes',
                        'Cache-Control': 'public, max-age=3600',
                    },
                });
            }
        } catch (e: any) {
            console.warn(`[SHOMA] TV client failed:`, e.message);
        }

        // 2. Fallback: Cobalt API (Bypasses many restrictions anonymously)
        console.warn(`[SHOMA] Trying Cobalt fallback...`);
        try {
            const cobaltRes = await fetch("https://api.cobalt.tools/api/json", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    isAudioOnly: true,
                    aFormat: "mp3"
                })
            });
            
            const cobaltData = await cobaltRes.json();
            if (cobaltData.url) {
                console.log(`[SHOMA] Cobalt stream redirect SUCCESS`);
                const audioRes = await fetch(cobaltData.url);
                return new Response(audioRes.body as any, {
                    headers: {
                        'Content-Type': 'audio/mpeg',
                        'Accept-Ranges': 'bytes',
                        'Cache-Control': 'public, max-age=3600',
                    },
                });
            }
        } catch (cobaltError: any) {
            console.warn(`[SHOMA] Cobalt failed:`, cobaltError.message);
        }

        // 3. Final Fallback: ytdl-core-enhanced
        console.warn(`[SHOMA] Trying ytdl-core fallback...`);
        try {
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
                headers: {
                    'Content-Type': 'audio/mpeg',
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'public, max-age=3600',
                },
            });
        } catch (ytdlError: any) {
            throw new Error(`All anonymous methods failed: ${ytdlError.message}`);
        }

    } catch (error: any) {
        console.error('[SHOMA] Stream Global Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
