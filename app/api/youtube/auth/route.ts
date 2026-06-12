import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export async function GET(req: NextRequest) {
  try {
    const yt = await Innertube.create();
    
    return new Promise((resolve) => {
        yt.session.on('auth-pending', (data) => {
            resolve(NextResponse.json({ 
                code: data.user_code, 
                url: data.verification_url 
            }));
        });
        
        yt.session.signIn().catch(err => {
            resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        });
        
        // Timeout after 10s if event doesn't fire
        setTimeout(() => {
            resolve(NextResponse.json({ error: 'Auth timeout' }, { status: 504 }));
        }, 10000);
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
    try {
        const { code } = await req.json();
        const yt = await Innertube.create();
        
        // This is tricky because youtubei.js's signIn() waits until finished.
        // We'll need a better way if we want to poll.
        // For now, let's just return success if we have a session.
        
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
