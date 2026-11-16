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
      const cleanCaller = caller_id.startsWith('77') ? caller_id.substring(2) : caller_id;
      query = query.or(`caller_id.eq.${caller_id},caller_id.eq.${cleanCaller}`);
    } else if (tarjeta) {
      query = query.ilike('numero_tarjeta_mask', `%${tarjeta}%`);
    }

    const { data: results, error } = await query.limit(1);

    if (error || !results || results.length === 0) {
      return NextResponse.json(
        { found: false, message: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    const data = results[0];

    // VALIDACIÓN ESTÁNDAR: Si la tarjeta está cancelada (estatus 2), NO entregar saldo
    if (data.estatus_tarjeta === 2) {
      await supabase.from('llamadas_bitacora').insert({
        caller_id: data.caller_id,
        cliente_id: data.id,
        tipo: 'entrante',
        estado: 'en_curso',
        opcion_ivr_seleccionada: '1. Consulta de Saldo DENEGADA',
        resumen_ia: `Intento de consulta de saldo rechazado: Tarjeta ${data.numero_tarjeta_mask} se encuentra cancelada (Estatus 2). Folio: ${data.folio_cancelacion || 'N/A'}`
      });

      return NextResponse.json({
        found: true,
        caller_id: data.caller_id,
        nombre_completo: data.nombre_completo,
        numero_tarjeta_mask: data.numero_tarjeta_mask,
        estatus_tarjeta: 2,
        tarjeta_activa: false,
        saldo_bloqueado: true,
        folio_cancelacion: data.folio_cancelacion,
        mensaje: 'Tarjeta cancelada / bloqueada. Consulta de saldo no permitida en IVR.',
        saldo: null,
        saldo_formateado: 'NO DISPONIBLE (CANCELADA)'
      });
    }

    // Registrar consulta en bitácora si la tarjeta está activa (estatus 1)
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
      estatus_tarjeta: data.estatus_tarjeta ?? 1,
      tarjeta_activa: (data.estatus_tarjeta ?? 1) === 1,
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
      const cleanCaller = caller_id.startsWith('77') ? caller_id.substring(2) : caller_id;
      query = query.or(`caller_id.eq.${caller_id},caller_id.eq.${cleanCaller}`);
    } else if (tarjeta) {
      query = query.ilike('numero_tarjeta_mask', `%${tarjeta}%`);
    }

    const { data: results, error } = await query.limit(1);

    if (error || !results || results.length === 0) {
      return NextResponse.json(
        { found: false, message: 'Cuenta no encontrada' },
        { status: 404 }
      );
    }

    const data = results[0];

    if (data.estatus_tarjeta === 2) {
      return NextResponse.json({
        found: true,
        caller_id: data.caller_id,
        nombre_completo: data.nombre_completo,
        numero_tarjeta_mask: data.numero_tarjeta_mask,
        estatus_tarjeta: 2,
        tarjeta_activa: false,
        saldo_bloqueado: true,
        folio_cancelacion: data.folio_cancelacion,
        mensaje: 'Tarjeta cancelada / bloqueada. Saldo bloqueado en IVR.',
        saldo: null,
        saldo_formateado: 'NO DISPONIBLE (CANCELADA)'
      });
    }

    return NextResponse.json({
      found: true,
      caller_id: data.caller_id,
      nombre_completo: data.nombre_completo,
      empresa: data.empresa,
      numero_tarjeta_mask: data.numero_tarjeta_mask,
      estatus_tarjeta: data.estatus_tarjeta ?? 1,
      tarjeta_activa: true,
      saldo: Number(data.saldo),
      saldo_formateado: `$${Number(data.saldo).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
