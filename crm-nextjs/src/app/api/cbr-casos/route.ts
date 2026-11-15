import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { data: casos, error } = await supabase
      .from('cbr_casos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ casos: casos || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      action = 'create', // 'create' | 'resolve'
      id,
      categoria = 'medico_citas',
      caller_id,
      paciente_nombre,
      problema_descripcion,
      solucion_aplicada
    } = body;

    // Acción 1: Escalamiento desde IA hacia Humano
    if (action === 'create') {
      const { data, error } = await supabase
        .from('cbr_casos')
        .insert({
          categoria,
          caller_id,
          paciente_nombre,
          problema_descripcion,
          solucion_aplicada: 'Pendiente de resolución por especialista humano',
          resolucion_exitosa: false,
          estado: 'pendiente_humano',
          veces_utilizado: 1
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Bitácora
      await supabase.from('llamadas_bitacora').insert({
        caller_id: caller_id || '1001',
        tipo: 'entrante',
        estado: 'transferida',
        opcion_ivr_seleccionada: '4. Citas Médicas - Escalamiento Humano',
        resumen_ia: `Caso clínico no resuelto por Gemini IA: ${problema_descripcion}. Se transfirió a médico humano.`,
        notas_agente: `Caso CBR generado para entrenamiento supervisado.`
      });

      return NextResponse.json({ success: true, caso: data });
    }

    // Acción 2: Resolución por Humano y Auto-Entrenamiento
    if (action === 'resolve') {
      if (!id || !solucion_aplicada) {
        return NextResponse.json({ error: 'Falta id del caso o solucion_aplicada' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('cbr_casos')
        .update({
          solucion_aplicada,
          resolucion_exitosa: true,
          estado: 'resuelto_entrenado',
          veces_utilizado: 2
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Bitácora de entrenamiento
      await supabase.from('llamadas_bitacora').insert({
        caller_id: data.caller_id || '1001',
        tipo: 'saliente',
        estado: 'finalizada',
        opcion_ivr_seleccionada: 'Resolución de Caso CBR',
        resumen_ia: `Caso CBR resuelto e incorporado a la memoria de la IA Gemini: ${solucion_aplicada}`,
        notas_agente: `Entrenamiento automático completado exitosamente.`
      });

      return NextResponse.json({ 
        success: true, 
        mensaje: 'Caso resuelto e incorporado al modelo CBR para entrenamiento automático de la IA',
        caso: data 
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
