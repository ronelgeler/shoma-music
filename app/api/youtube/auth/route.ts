import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const yt = await Innertube.create();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const timeout = setTimeout(() => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Auth timeout' })}\n\n`));
          controller.close();
        }, 58000);

        yt.session.on('auth-pending', (data) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'code', 
            code: data.user_code, 
            url: data.verification_url 
          })}\n\n`));
        });

        yt.session.on('auth', (data) => {
          clearTimeout(timeout);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'tokens', 
            credentials: data.credentials 
          })}\n\n`));
          controller.close();
        });

        try {
          await yt.session.signIn();
        } catch (err: any) {
          clearTimeout(timeout);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
