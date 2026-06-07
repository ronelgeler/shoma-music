import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = "https://api.ibroadcast.com/s/JSON/status";
    const payload = {
      ...body,
      client_id: process.env.IBROADCAST_CLIENT_ID,
      app_id: process.env.IBROADCAST_CLIENT_ID || 1000,
    };
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
