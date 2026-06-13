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
    const cookie = searchParams.get('c');
    const poToken = searchParams.get('po');

    if (!videoId) {
        return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
    }

    const finalCookie = parseCookies(cookie || '');

    try {
        console.log(`[SHOMA] Stream request for: ${videoId}`);
        
        const yt = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true,
            cookie: finalCookie || undefined,
            po_token: poToken || undefined
        });
        
        const clients: any[] = ['TV', 'ANDROID_VR', 'MWEB', 'YTMUSIC_ANDROID'];
        let lastError = '';

        for (const clientType of clients) {
            try {
                console.log(`[SHOMA] Stream attempt (${clientType}) for ${videoId}`);
                const info = await yt.getInfo(videoId, clientType);
                const format = info.chooseFormat({ type: 'audio', quality: 'best', format: 'mp4' });

                if (!format) continue;

                const stream = await info.download({
                    type: 'audio',
                    quality: 'best',
                    format: 'mp4',
                    client: clientType
                });

                console.log(`[SHOMA] Stream SUCCESS (${clientType})`);

                return new Response(stream as any, {
                    headers: {
                        'Content-Type': 'audio/mp4',
                        'Accept-Ranges': 'bytes',
                        'Cache-Control': 'public, max-age=3600',
                        'Content-Disposition': 'inline'
                    },
                });
            } catch (e: any) {
                console.warn(`[SHOMA] Client ${clientType} failed:`, e.message);
                lastError = e.message;
            }
        }

        // FALLBACK TO ytdl-core-enhanced
        console.warn(`[SHOMA] Innertube failed, trying ytdl-core-enhanced fallback...`);
        try {
            const stream = ytdl(videoId, {
                filter: 'audioonly',
                quality: 'highestaudio',
                requestOptions: {
                    headers: {
                        cookie: finalCookie || undefined,
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
            throw new Error(`Fallback failed: ${ytdlError.message}`);
        }

    } catch (error: any) {
        console.error('[SHOMA] Stream Global Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
