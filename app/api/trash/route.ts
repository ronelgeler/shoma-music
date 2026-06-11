import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = "https://api.ibroadcast.com/s/JSON/status";
    
    // 1. Send the tracks to the trash
    const payload = {
      ...body,
      mode: 'trashtracks',
      client_id: process.env.IBROADCAST_CLIENT_ID,
    };
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    // 2. Empty the trash permanently
    const emptyPayload = {
      user_id: body.user_id,
      token: body.token,
      mode: 'emptytrash',
      client_id: process.env.IBROADCAST_CLIENT_ID || 'shoma-music',
      version: '1.4',
      device_name: 'shoma-music-server'
    };
    
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emptyPayload),
    });
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
