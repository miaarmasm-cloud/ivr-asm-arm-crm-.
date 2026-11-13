import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { destination, agentExtension = '2001' } = body;

    if (!destination) {
      return NextResponse.json({ error: 'Falta el número de destino' }, { status: 400 });
    }

    // En producción, se comunica con el Asterisk REST Interface (ARI) o el Middleware FastAPI
    const middlewareUrl = process.env.MIDDLEWARE_URL || 'http://localhost:8000';
    
    console.log(`[Next.js API Outbound] Iniciando llamada hacia ${destination} desde agente ${agentExtension}`);

    return NextResponse.json({
      success: true,
      message: `Llamada originada hacia ${destination}`,
      callId: `out-${Date.now()}`,
      destination,
      agentExtension
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
