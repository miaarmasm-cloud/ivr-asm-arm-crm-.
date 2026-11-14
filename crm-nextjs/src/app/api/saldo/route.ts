import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caller_id = searchParams.get('caller_id');
    const tarjeta = searchParams.get('tarjeta');

    if (!caller_id && !tarjeta) {
      return NextResponse.json(
        { error: 'Debe proporcionar caller_id o terminación de tarjeta' },
        { status: 400 }
      );
    }

    let query = supabase.from('clientes').select('*');

    if (caller_id) {
      query = query.eq('caller_id', caller_id);
    } else if (tarjeta) {
      query = query.ilike('numero_tarjeta_mask', `%${tarjeta}%`);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json(
        { found: false, message: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    // Registrar consulta en bitácora
    await supabase.from('llamadas_bitacora').insert({
      caller_id: data.caller_id,
      cliente_id: data.id,
      tipo: 'entrante',
      estado: 'finalizada',
      opcion_ivr_seleccionada: '1. Consulta de Saldo',
      resumen_ia: `Consulta de saldo por IVR: Saldo reportado $${data.saldo} MXN en tarjeta ${data.numero_tarjeta_mask}`
    });

    return NextResponse.json({
      found: true,
      caller_id: data.caller_id,
      nombre_completo: data.nombre_completo,
      empresa: data.empresa,
      numero_tarjeta_mask: data.numero_tarjeta_mask,
      saldo: Number(data.saldo),
      saldo_formateado: `$${Number(data.saldo).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`,
      email: data.email
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { caller_id, tarjeta } = body;

    if (!caller_id && !tarjeta) {
      return NextResponse.json(
        { error: 'Debe proporcionar caller_id o tarjeta en el cuerpo JSON' },
        { status: 400 }
      );
    }

    let query = supabase.from('clientes').select('*');
    if (caller_id) {
      query = query.eq('caller_id', caller_id);
    } else if (tarjeta) {
      query = query.ilike('numero_tarjeta_mask', `%${tarjeta}%`);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json(
        { found: false, message: 'Cliente no registrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      found: true,
      caller_id: data.caller_id,
      nombre_completo: data.nombre_completo,
      empresa: data.empresa,
      numero_tarjeta_mask: data.numero_tarjeta_mask,
      saldo: Number(data.saldo),
      saldo_formateado: `$${Number(data.saldo).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
