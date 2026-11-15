import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caller_id = searchParams.get('caller_id');

    if (!caller_id) {
      return NextResponse.json({ error: 'Falta caller_id' }, { status: 400 });
    }

    // 1. Buscar en historial_clinico_pacientes
    const { data: historial, error } = await supabase
      .from('historial_clinico_pacientes')
      .select('*')
      .eq('caller_id', caller_id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Si no tiene historial clínico, buscar si existe en clientes
    const { data: cliente } = await supabase
      .from('clientes')
      .select('*')
      .eq('caller_id', caller_id)
      .maybeSingle();

    if (historial) {
      return NextResponse.json({
        found: true,
        es_paciente_antiguo: true,
        historial,
        cliente: cliente || null
      });
    }

    return NextResponse.json({
      found: false,
      es_paciente_antiguo: false,
      es_paciente_nuevo: true,
      cliente: cliente || null,
      mensaje: 'Paciente nuevo sin historial clínico previo'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      caller_id, 
      paciente_nombre, 
      ultimo_motivo, 
      diagnostico_previo, 
      sugerencia_preventiva_ia, 
      doctor_asignado = 'Dra. Mariana Gómez' 
    } = body;

    const { data, error } = await supabase
      .from('historial_clinico_pacientes')
      .insert({
        caller_id,
        paciente_nombre,
        fecha_ultima_consulta: new Date().toISOString().split('T')[0],
        ultimo_motivo,
        diagnostico_previo,
        sugerencia_preventiva_ia,
        doctor_asignado
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, historial: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
