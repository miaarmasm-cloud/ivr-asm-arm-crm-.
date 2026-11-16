import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caller_id = searchParams.get('caller_id');
    const cliente_id = searchParams.get('cliente_id');
    const folio = searchParams.get('folio');

    let query = supabase.from('tarjetas_cancelaciones_log').select('*').order('created_at', { ascending: false });

    if (folio) {
      query = query.ilike('folio_cancelacion', `%${folio.trim()}%`);
    } else if (caller_id) {
      const cleanCaller = caller_id.startsWith('77') ? caller_id.substring(2) : caller_id;
      query = query.or(`caller_id.eq.${caller_id},caller_id.eq.${cleanCaller}`);
    } else if (cliente_id) {
      query = query.eq('cliente_id', cliente_id);
    }

    const { data: logs, error } = await query.limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      caller_id, 
      cliente_id, 
      tarjeta, 
      nuevo_estatus, // 1: Activa, 2: Cancelada/Bloqueada
      motivo,
      canal = 'CRM_AGENTE'
    } = body;

    if (!caller_id && !cliente_id && !tarjeta) {
      return NextResponse.json(
        { error: 'Debe especificar el caller_id, cliente_id o terminación de tarjeta' },
        { status: 400 }
      );
    }

    // 1. Buscar cliente (con soporte de normalización de prefijo 77)
    let query = supabase.from('clientes').select('*');
    if (cliente_id) {
      query = query.eq('id', cliente_id);
    } else if (caller_id) {
      const cleanCaller = caller_id.startsWith('77') ? caller_id.substring(2) : caller_id;
      query = query.or(`caller_id.eq.${caller_id},caller_id.eq.${cleanCaller}`);
    } else if (tarjeta) {
      query = query.ilike('numero_tarjeta_mask', `%${tarjeta}%`);
    }

    const { data: clientesFound, error } = await query.limit(1);

    if (error || !clientesFound || clientesFound.length === 0) {
      return NextResponse.json(
        { found: false, message: 'No se encontró la cuenta asociada' },
        { status: 404 }
      );
    }

    const cliente = clientesFound[0];
    const estatusAnterior = cliente.estatus_tarjeta ?? 1;
    // Si no se especifica nuevo_estatus, por defecto es 2 (cancelación)
    const estatusDestino = nuevo_estatus !== undefined ? Number(nuevo_estatus) : 2;

    if (![1, 2].includes(estatusDestino)) {
      return NextResponse.json(
        { error: 'El estatus debe ser 1 (Activa) o 2 (Cancelada)' },
        { status: 400 }
      );
    }

    const esCancelacion = estatusDestino === 2;
    
    // Nomenclatura oficial: concatenar fecha (yyyy-mm-dd) -4 ultimos digitos de la tarjeta-4 ultimos digitos del callerid
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    const fechaStr = `${yyyy}-${mm}-${dd}`;

    const digitosTarjeta = (cliente.numero_tarjeta_mask || tarjeta || '0000').replace(/\D/g, '');
    const last4Tarjeta = digitosTarjeta.length >= 4 ? digitosTarjeta.slice(-4) : digitosTarjeta.padStart(4, '0');

    const digitosCaller = (cliente.caller_id || caller_id || '0000').replace(/\D/g, '');
    const last4Caller = digitosCaller.length >= 4 ? digitosCaller.slice(-4) : digitosCaller.padStart(4, '0');

    const folioOperacion = esCancelacion 
      ? `${fechaStr}-${last4Tarjeta}-${last4Caller}`
      : `ACT-${fechaStr}-${last4Tarjeta}`;

    const motivoFinal = motivo || (esCancelacion 
      ? 'Cancelación/Bloqueo registrado desde CRM o IVR' 
      : 'Aclaración de incidencia y reactivación autorizada por agente');

    // 2. Actualizar campo estatus_tarjeta y datos de cancelación en tabla clientes
    const updateClientePayload: any = {
      estatus_tarjeta: estatusDestino,
      updated_at: new Date().toISOString()
    };

    if (esCancelacion) {
      updateClientePayload.folio_cancelacion = folioOperacion;
      updateClientePayload.fecha_cancelacion = new Date().toISOString();
      updateClientePayload.motivo_cancelacion = motivoFinal;
    } else {
      updateClientePayload.folio_cancelacion = null;
      updateClientePayload.fecha_cancelacion = null;
      updateClientePayload.motivo_cancelacion = motivoFinal;
    }

    const { error: errUpdate } = await supabase
      .from('clientes')
      .update(updateClientePayload)
      .eq('id', cliente.id);

    if (errUpdate) {
      return NextResponse.json(
        { error: `Error al actualizar estatus de cliente: ${errUpdate.message}` },
        { status: 500 }
      );
    }

    // 3. Registrar auditoría en tarjetas_cancelaciones_log
    await supabase.from('tarjetas_cancelaciones_log').insert({
      cliente_id: cliente.id,
      folio_cancelacion: folioOperacion,
      caller_id: cliente.caller_id,
      numero_tarjeta_mask: cliente.numero_tarjeta_mask || '****',
      estatus_anterior: estatusAnterior,
      estatus_nuevo: estatusDestino,
      motivo: motivoFinal,
      canal: canal,
      saldo_al_momento: Number(cliente.saldo || 0)
    });

    // 4. Registrar en la bitácora general de llamadas / CRM
    await supabase.from('llamadas_bitacora').insert({
      caller_id: cliente.caller_id,
      cliente_id: cliente.id,
      tipo: 'entrante',
      estado: esCancelacion ? 'transferida' : 'finalizada',
      opcion_ivr_seleccionada: esCancelacion ? '2. Cancelación' : 'Reactivación de Tarjeta (Desbloqueo)',
      folio_cancelacion: esCancelacion ? folioOperacion : null,
      resumen_ia: esCancelacion 
        ? `Cancelación de tarjeta ejecutada: Folio Oficial ${folioOperacion}. Tarjeta ${cliente.numero_tarjeta_mask}. Saldo restante $${cliente.saldo}. Motivo: ${motivoFinal}. Consulta de saldo en IVR queda bloqueada.`
        : `Reactivación de tarjeta ejecutada: Incidencia aclarada (${motivoFinal}). Tarjeta ${cliente.numero_tarjeta_mask}. Estatus restablecido a 1 (Activa). Saldo vuelve a estar disponible en IVR Asterisk.`,
      notas_agente: `Operación ${folioOperacion} procesada por ${canal}. Nuevo estatus: ${estatusDestino}. Motivo: ${motivoFinal}`
    });

    return NextResponse.json({
      success: true,
      mensaje: esCancelacion 
        ? 'Tarjeta cancelada/bloqueada con éxito. Consulta de saldo bloqueada en IVR.'
        : 'Tarjeta desbloqueada y reactivada con éxito. Consulta de saldo habilitada en IVR.',
      folio_operacion: folioOperacion,
      folio_cancelacion: esCancelacion ? folioOperacion : null,
      estatus_anterior: estatusAnterior,
      estatus_tarjeta: estatusDestino,
      tarjeta_activa: estatusDestino === 1,
      cliente: {
        id: cliente.id,
        caller_id: cliente.caller_id,
        nombre_completo: cliente.nombre_completo,
        numero_tarjeta_mask: cliente.numero_tarjeta_mask,
        saldo_pendiente: Number(cliente.saldo),
        estatus_tarjeta: estatusDestino,
        folio_cancelacion: esCancelacion ? folioOperacion : null,
        fecha_cancelacion: esCancelacion ? updateClientePayload.fecha_cancelacion : null
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
