import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const statusUrl = "https://api.ibroadcast.com/s/JSON/status";
    
    const authParams = {
      user_id: body.user_id,
      token: body.token,
      client: body.client || 'shoma-music',
      version: body.version || '1.4',
      client_id: process.env.IBROADCAST_CLIENT_ID || '1000',
      app_id: process.env.IBROADCAST_CLIENT_ID || '1000',
    };

    // 1. Send the tracks to the trash
    const trashPayload = {
      ...authParams,
      mode: 'trashtracks',
      tracks: body.tracks,
    };
    
    console.log(`[SHOMA] Moving tracks to trash: ${body.tracks}`);
    const trashRes = await fetch(statusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trashPayload),
    });
    
    const trashData = await trashRes.json();
    console.log(`[SHOMA] Trash response:`, trashData);

    // 2. Empty the trash permanently
    const emptyPayload = {
      ...authParams,
      mode: 'emptytrash',
    };
    
    console.log(`[SHOMA] Emptying trash permanently...`);
    const emptyRes = await fetch(statusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emptyPayload),
    });
    
    const emptyData = await emptyRes.json();
    console.log(`[SHOMA] EmptyTrash response:`, emptyData);
    
    return NextResponse.json({ 
      success: true, 
      trash: trashData, 
      empty: emptyData 
    });
  } catch (error: any) {
    console.error('[SHOMA] Trash ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
