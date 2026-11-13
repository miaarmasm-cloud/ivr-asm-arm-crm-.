import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { roomName = 'ivr-agent-room', participantName = 'Agente-CRM-2001' } = await request.json();

    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'secretkey_super_segura_livekit_2026';
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || 'ws://localhost:7880';

    return NextResponse.json({
      success: true,
      roomName,
      participantName,
      wsUrl,
      // Para pruebas directas con softphone o navegador
      tokenPlaceholder: `token_livekit_para_${participantName}`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
