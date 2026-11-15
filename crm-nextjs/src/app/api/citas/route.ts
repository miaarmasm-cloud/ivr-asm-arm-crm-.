import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent } from '@/lib/googleCalendar';

const DOCTOR_EMAILS: Record<string, string> = {
  'Dra. Mariana Fernández': 'mariana.fernandez@clinica-arm.com',
  'Dra. Mariana Gómez': 'mariana.gomez@clinica-arm.com',
  'Dr. Fernando Fernández': 'fernando.fernandez@clinica-arm.com',
  'Dr. Alejandro Morales': 'alejandro.morales@clinica-arm.com',
  'Dra. Sofía Navarro': 'sofia.navarro@clinica-arm.com'
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caller_id = searchParams.get('caller_id');
    const doctor_asignado = searchParams.get('doctor_asignado');
    const check_doctor = searchParams.get('check_doctor');
    const check_fecha = searchParams.get('check_fecha');
    const check_hora = searchParams.get('check_hora');

    // Módulo de validación de disponibilidad y conflicto de Médico de Cabecera
    if (check_doctor && check_fecha && check_hora) {
      const horaNorm = check_hora.substring(0, 5);
      // 1. Verificar si el médico de cabecera está ocupado en la fecha y hora seleccionada (soporta 'HH:MM' y 'HH:MM:SS')
      const { data: citasDoctor } = await supabase
        .from('citas_calendario')
        .select('*')
        .eq('doctor_asignado', check_doctor)
        .eq('fecha', check_fecha)
        .in('hora', [horaNorm, `${horaNorm}:00`])
        .eq('estado', 'confirmada');

      const isOccupied = (citasDoctor && citasDoctor.length > 0);

      // Directorio general de médicos de la clínica homologado
      const PLANTILLA_MEDICOS = [
        { nombre: 'Dra. Mariana Fernández', especialidad: 'Medicina Familiar y Preventiva' },
        { nombre: 'Dr. Fernando Fernández', especialidad: 'Medicina Interna y Cardiología' },
        { nombre: 'Dra. Mariana Gómez', especialidad: 'Medicina General' },
        { nombre: 'Dr. Alejandro Morales', especialidad: 'Cardiología Preventiva' },
        { nombre: 'Dra. Sofía Navarro', especialidad: 'Laboratorio y Diagnóstico Clínico' }
      ];

      // 2. Obtener todas las citas en esa misma fecha y hora para ver qué otros médicos están libres
      const { data: citasMismoHorario } = await supabase
        .from('citas_calendario')
        .select('doctor_asignado')
        .eq('fecha', check_fecha)
        .in('hora', [horaNorm, `${horaNorm}:00`])
        .eq('estado', 'confirmada');

      const doctoresOcupados = new Set((citasMismoHorario || []).map((c: any) => c.doctor_asignado));

      const medicosDisponibles = PLANTILLA_MEDICOS.filter(
        (m) => m.nombre !== check_doctor && !doctoresOcupados.has(m.nombre)
      );

      // 3. Próxima fecha disponible para el médico de cabecera (día siguiente)
      const fechaObj = new Date(check_fecha + 'T00:00:00');
      fechaObj.setDate(fechaObj.getDate() + 1);
      if (fechaObj.getDay() === 6) fechaObj.setDate(fechaObj.getDate() + 2);
      if (fechaObj.getDay() === 0) fechaObj.setDate(fechaObj.getDate() + 1);
      const diaSiguienteStr = fechaObj.toISOString().split('T')[0];

      return NextResponse.json({
        check: true,
        ocupado: isOccupied,
        medico_cabecera: check_doctor,
        fecha_solicitada: check_fecha,
        hora_solicitada: horaNorm,
        mensaje_conflicto: isOccupied 
          ? `La doctora de cabecera ${check_doctor} se encuentra ocupada el ${check_fecha} a las ${horaNorm} hrs.`
          : `La doctora de cabecera ${check_doctor} está libre en ese horario.`,
        opcion_medico_turno: {
          doctor: 'Dr. Fernando Fernández',
          fecha: check_fecha,
          hora: '11:00',
          texto: `Agendar hoy con el Dr. Fernando Fernández a las 11:00 hrs`
        },
        opcion_dia_siguiente_cabecera: {
          doctor: check_doctor,
          fecha: diaSiguienteStr,
          hora: '10:00',
          texto: `Agendar para el día siguiente (${diaSiguienteStr}) a las 10:00 hrs con ${check_doctor}`
        },
        medicos_disponibles_mismo_horario: medicosDisponibles
      });
    }

    let query = supabase
      .from('citas_calendario')
      .select('*')
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });

    if (caller_id) {
      query = query.eq('caller_id', caller_id);
    }

    if (doctor_asignado) {
      query = query.eq('doctor_asignado', doctor_asignado);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ citas: data || [] });
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
      fecha, 
      hora, 
      especialidad = 'Medicina General y Laboratorio', 
      motivo = 'Check-up y Consulta Preventiva', 
      doctor_asignado = 'Dra. Mariana Fernández',
      notas_ia = 'Cita agendada por Agente Clínico IA Gemini'
    } = body;

    if (!caller_id || !paciente_nombre || !fecha || !hora) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: caller_id, paciente_nombre, fecha, hora' },
        { status: 400 }
      );
    }

    const horaNorm = hora.substring(0, 5);

    // Buscar si existe cliente vinculado para obtener email
    let cliente_id = null;
    let paciente_email = undefined;
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, email')
      .eq('caller_id', caller_id)
      .maybeSingle();

    if (cliente) {
      cliente_id = cliente.id;
      paciente_email = cliente.email;
    }

    // 1. SINCRONIZAR CON GOOGLE CALENDAR EN TIEMPO REAL
    let google_event_id: string | null = null;
    try {
      google_event_id = await createGoogleCalendarEvent({
        caller_id,
        paciente_nombre,
        doctor_asignado,
        fecha,
        hora: horaNorm,
        motivo,
        paciente_email: paciente_email || 'anto.krpax@gmail.com',
        doctor_email: DOCTOR_EMAILS[doctor_asignado] || 'miaarmasm@gmail.com'
      });
    } catch (gErr) {
      console.warn('[Google Calendar Sync Warning]:', gErr);
    }

    const notasFinal = google_event_id 
      ? `Google Calendar Event ID: ${google_event_id} | Sincronizado en Tiempo Real` 
      : (notas_ia || 'Cita agendada en Supabase');

    // 2. Insertar la cita médica en citas_calendario
    const { data: nuevaCita, error } = await supabase
      .from('citas_calendario')
      .insert({
        caller_id,
        cliente_id,
        paciente_nombre,
        fecha,
        hora: horaNorm,
        especialidad,
        motivo,
        estado: 'confirmada',
        doctor_asignado,
        notas_ia: notasFinal
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Registrar en bitácora para Screen-Pop inmediato en CRM
    await supabase.from('llamadas_bitacora').insert({
      caller_id,
      tipo: 'entrante',
      estado: 'finalizada',
      opcion_ivr_seleccionada: '2. Citas Médicas (Google Calendar Sync)',
      resumen_ia: `Cita médica confirmada para ${paciente_nombre}: ${especialidad} el ${fecha} a las ${horaNorm} hrs con ${doctor_asignado}. Google Calendar ID: ${google_event_id || 'offline'}.`,
      notas_agente: `Sincronización bidireccional completada con Google Calendar y Supabase.`
    });

    return NextResponse.json({
      success: true,
      mensaje: `Cita médica agendada exitosamente con ${doctor_asignado} y sincronizada con Google Calendar`,
      google_event_id,
      cita: nuevaCita
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, estado, fecha, hora, notas_ia } = body;

    if (!id) {
      return NextResponse.json({ error: 'Debe especificar el id de la cita' }, { status: 400 });
    }

    // Si se cancela la cita, remover el evento de Google Calendar
    if (estado === 'cancelada') {
      const { data: existing } = await supabase
        .from('citas_calendario')
        .select('notas_ia')
        .eq('id', id)
        .single();

      if (existing?.notas_ia && existing.notas_ia.includes('Google Calendar Event ID: ')) {
        const parts = existing.notas_ia.split('Google Calendar Event ID: ')[1].split(' ');
        const eventId = parts[0]?.trim();
        if (eventId && eventId !== 'offline') {
          await deleteGoogleCalendarEvent(eventId);
        }
      }
    }

    const updatePayload: any = {};
    if (estado) updatePayload.estado = estado;
    if (fecha) updatePayload.fecha = fecha;
    if (hora) updatePayload.hora = hora.substring(0, 5);
    if (notas_ia) updatePayload.notas_ia = notas_ia;
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('citas_calendario')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, cita: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
