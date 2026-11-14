import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { caller_id, tarjeta, motivo = 'Cancelación solicitada vía IVR Opción 2' } = body;

    if (!caller_id && !tarjeta) {
      return NextResponse.json(
        { error: 'Debe especificar el caller_id o terminación de tarjeta' },
        { status: 400 }
      );
    }

    let query = supabase.from('clientes').select('*');
    if (caller_id) {
      query = query.eq('caller_id', caller_id);
    } else if (tarjeta) {
      query = query.ilike('numero_tarjeta_mask', `%${tarjeta}%`);
    }

    const { data: cliente, error } = await query.single();

    if (error || !cliente) {
      return NextResponse.json(
        { found: false, message: 'No se encontró la cuenta asociada para cancelar' },
        { status: 404 }
      );
    }

    const folioCancelacion = `CAN-${Date.now().toString().slice(-6)}`;

    // Registrar en la bitácora del CRM
    const { data: bitacora, error: errBitacora } = await supabase
      .from('llamadas_bitacora')
      .insert({
        caller_id: cliente.caller_id,
        cliente_id: cliente.id,
        tipo: 'entrante',
        estado: 'transferida',
        opcion_ivr_seleccionada: '2. Cancelación',
        resumen_ia: `Solicitud de cancelación recibida: Folio ${folioCancelacion}. Tarjeta ${cliente.numero_tarjeta_mask}. Saldo restante $${cliente.saldo}. Motivo: ${motivo}`,
        notas_agente: `Requiere confirmación de retención por agente humano. Folio ${folioCancelacion}`
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      mensaje: 'Solicitud de cancelación registrada exitosamente',
      folio_cancelacion: folioCancelacion,
      cliente: {
        id: cliente.id,
        caller_id: cliente.caller_id,
        nombre_completo: cliente.nombre_completo,
        numero_tarjeta_mask: cliente.numero_tarjeta_mask,
        saldo_pendiente: Number(cliente.saldo),
        empresa: cliente.empresa
      },
      siguiente_paso: 'Transferencia a ejecutivo de retención o confirmación SMS'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
