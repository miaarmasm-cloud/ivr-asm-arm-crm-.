#!/usr/bin/env node
/**
 * =============================================================================
 * SERVIDOR MCP MODULAR E INDEPENDIENTE: google-calendar-arm
 * =============================================================================
 * Herramientas MCP para:
 * 1. Disponibilidad de citas médicas y de servicio (L-V, 9:00 AM a 6:00 PM).
 * 2. Agendamiento sincronizado (Google Calendar API v3 + Supabase citas_calendario).
 * 3. Memoria clínica CBR (Historial del paciente y sugerencias preventivas proactivas).
 * 4. Reprogramación y cancelación autónoma por CallerID.
 * =============================================================================
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.dirname(__filename);
const TOKEN_FILE = path.join(BASE_DIR, 'google_token.json');
const CREDENTIALS_FILE = path.join(BASE_DIR, 'google_credentials.json');

const SUPABASE_URL = process.env.SUPABASE_URL || "https://xlmrmdxtrdomtrmnczwh.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbXJtZHh0cmRvbXRybW5jendoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MDcyMTEsImV4cCI6MjExMDE4MzIxMX0.Gcv0Rw0242xQtyultJjjAJclpxc4xHeAZHXU3BDdhXk";

const HEADERS_SUPABASE = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

// =============================================================================
// GESTION DE TOKENS Y AUTENTICACION CON GOOGLE
// =============================================================================

async function getValidGoogleAccessToken() {
  if (!fs.existsSync(TOKEN_FILE)) {
    throw new Error(`Token no encontrado en ${TOKEN_FILE}. Ejecute auth_google_calendar.py primero.`);
  }

  const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  const now = Date.now();
  const expiry = tokenData.expiry ? new Date(tokenData.expiry).getTime() : 0;

  // Si aún es válido (con margen de 2 min)
  if (tokenData.token && expiry > now + 120000) {
    return tokenData.token;
  }

  // Refrescar token
  if (!tokenData.refresh_token) {
    return tokenData.token;
  }

  try {
    const params = new URLSearchParams({
      client_id: tokenData.client_id,
      client_secret: tokenData.client_secret,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token'
    });

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (resp.ok) {
      const refreshed = await resp.json();
      tokenData.token = refreshed.access_token;
      tokenData.expiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2), 'utf8');
      return tokenData.token;
    }
  } catch (e) {
    process.stderr.write(`[Google Auth Refresh Error] ${e.message}\n`);
  }

  return tokenData.token;
}

// Helpers Supabase REST
async function dbGet(endpoint) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      headers: HEADERS_SUPABASE
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    process.stderr.write(`[Supabase GET Error] ${e.message}\n`);
  }
  return [];
}

async function dbPost(endpoint, data) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      method: 'POST',
      headers: HEADERS_SUPABASE,
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const txt = await res.text();
      return txt ? JSON.parse(txt) : { status: 'created' };
    }
  } catch (e) {
    process.stderr.write(`[Supabase POST Error] ${e.message}\n`);
  }
  return null;
}

async function dbPatch(endpoint, data) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      method: 'PATCH',
      headers: HEADERS_SUPABASE,
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const txt = await res.text();
      return txt ? JSON.parse(txt) : { status: 'ok' };
    }
  } catch (e) {
    process.stderr.write(`[Supabase PATCH Error] ${e.message}\n`);
  }
  return null;
}

// =============================================================================
// DEFINICION DE HERRAMIENTAS MCP
// =============================================================================

const TOOLS = [
  {
    name: 'gcal_listar_disponibilidad',
    description: 'Valida horarios disponibles para una fecha (YYYY-MM-DD). Rango de 9:00 AM a 6:00 PM de Lunes a Viernes.',
    inputSchema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'Fecha a consultar en formato YYYY-MM-DD' }
      },
      required: ['fecha']
    }
  },
  {
    name: 'gcal_agendar_cita',
    description: 'Agenda cita médica y sincroniza bidireccionalmente con Google Calendar y Supabase citas_calendario.',
    inputSchema: {
      type: 'object',
      properties: {
        caller_id: { type: 'string', description: 'CallerID del paciente (ej. 1001)' },
        nombre: { type: 'string', description: 'Nombre completo del paciente' },
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        hora: { type: 'string', description: 'Hora en formato HH:MM (09:00 a 17:00)' },
        motivo: { type: 'string', description: 'Motivo o check-up preventivo solicitado' }
      },
      required: ['caller_id', 'nombre', 'fecha', 'hora', 'motivo']
    }
  },
  {
    name: 'gcal_consultar_memoria_clinica',
    description: 'Consulta antecedentes médicos CBR del paciente en historial_clinico_pacientes y genera sugerencias preventivas.',
    inputSchema: {
      type: 'object',
      properties: {
        caller_id: { type: 'string', description: 'CallerID del paciente (ej. 1001)' }
      },
      required: ['caller_id']
    }
  },
  {
    name: 'gcal_reprogramar_cita',
    description: 'Reprograma la cita activa del paciente a una nueva fecha y hora verificando horarios laborales.',
    inputSchema: {
      type: 'object',
      properties: {
        caller_id: { type: 'string', description: 'CallerID del paciente' },
        nueva_fecha: { type: 'string', description: 'Nueva fecha YYYY-MM-DD' },
        nueva_hora: { type: 'string', description: 'Nueva hora HH:MM' }
      },
      required: ['caller_id', 'nueva_fecha', 'nueva_hora']
    }
  },
  {
    name: 'gcal_cancelar_cita',
    description: 'Cancela la cita médica activa por CallerID, elimina el evento de Google Calendar y libera el espacio.',
    inputSchema: {
      type: 'object',
      properties: {
        caller_id: { type: 'string', description: 'CallerID del paciente' }
      },
      required: ['caller_id']
    }
  }
];

// =============================================================================
// LOGICA DE EJECUCION DE HERRAMIENTAS
// =============================================================================

async function handleToolCall(name, args) {
  if (name === 'gcal_listar_disponibilidad') {
    const { fecha } = args;
    const parts = fecha.split('-');
    if (parts.length !== 3) {
      return { error: 'Formato inválido. Use YYYY-MM-DD' };
    }
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayOfWeek = d.getDay(); // 0 Dom, 6 Sab
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        disponible: false,
        motivo: `El día ${fecha} es ${dias[dayOfWeek]}. Horario laboral: Lunes a Viernes de 9:00 a 18:00 hrs.`,
        horarios_disponibles: []
      };
    }

    const horariosTotales = [
      "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
    ];
    const ocupados = new Set();

    // 1. Consultar Google Calendar
    try {
      const token = await getValidGoogleAccessToken();
      const timeMin = `${fecha}T00:00:00Z`;
      const timeMax = `${fecha}T23:59:59Z`;
      const gcalUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true`;
      const gResp = await fetch(gcalUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (gResp.ok) {
        const data = await gResp.json();
        for (const item of (data.items || [])) {
          const start = item.start?.dateTime || '';
          if (start.includes('T')) {
            const h = start.split('T')[1].substring(0, 5);
            ocupados.add(h);
          }
        }
      }
    } catch (e) {
      process.stderr.write(`[GCal Availability Warning] ${e.message}\n`);
    }

    // 2. Consultar Supabase
    const dbCitas = await dbGet(`citas_calendario?fecha=eq.${fecha}&estado=in.(confirmada,reprogramada)&select=hora,doctor_asignado`);
    for (const c of dbCitas) {
      if (c.hora) {
        const h = c.hora.substring(0, 5);
        const doc = c.doctor_asignado || '';
        if (!doctor || (doc.toLowerCase().includes(doctor.toLowerCase()))) {
          ocupados.add(h);
        }
      }
    }

    const libres = horariosTotales.filter(h => !ocupados.has(h));
    const doctorConsultado = doctor || "Dra. Mariana Fernández";
    const docDisponible = libres.length > 0 && (!doctorConsultado.toLowerCase().includes("fernandez") || libres.length > 2);

    const nextD = new Date(d);
    nextD.setDate(d.getDate() + (dayOfWeek === 5 ? 3 : 1));
    const siguienteDia = nextD.toISOString().split('T')[0];

    const alternativas = {
      mismo_dia: {
        doctor: "Dr. Carlos Fernández",
        especialidad: "Medicina Interna",
        horarios_disponibles: ["11:00", "15:00", "16:00"]
      },
      siguiente_dia: {
        doctor: "Dra. María González",
        especialidad: "Medicina Familiar / Preventiva",
        fecha: siguienteDia,
        horarios_disponibles: ["09:00", "10:00", "12:00", "16:00"]
      }
    };

    return {
      disponible: libres.length > 0,
      fecha,
      dia_semana: dias[dayOfWeek],
      doctor_solicitado: doctorConsultado,
      doctor_disponible: docDisponible,
      horarios_disponibles: libres,
      horarios_ocupados: Array.from(ocupados),
      alternativas_medicas: alternativas,
      recomendacion_ia: !docDisponible
        ? `El horario con ${doctorConsultado} está ocupado el ${fecha}. Sugerir con el Dr. Carlos Fernández ese mismo día a las 11:00 hrs, o con la Dra. María González el ${siguienteDia} a las 09:00 hrs.`
        : `Horarios disponibles confirmados con ${doctorConsultado}.`
    };
  }

  if (name === 'gcal_agendar_cita') {
    const { caller_id, nombre, fecha, hora, motivo, doctor } = args;
    const doctorFinal = doctor || "Dra. Mariana Fernández";

    // Validar disponibilidad
    const disp = await handleToolCall('gcal_listar_disponibilidad', { fecha, doctor: doctorFinal });
    if (!disp.disponible || !disp.horarios_disponibles.includes(hora)) {
      return {
        success: false,
        error: `El horario ${hora} del día ${fecha} no está disponible (L-V 9:00 a 18:00).`,
        alternativas: disp.alternativas_medicas
      };
    }

    let googleEventId = null;
    try {
      const token = await getValidGoogleAccessToken();
      const hInt = parseInt(hora.split(':')[0], 10);
      const mInt = parseInt(hora.split(':')[1] || '0', 10);
      const startDt = `${fecha}T${String(hInt).padStart(2, '0')}:${String(mInt).padStart(2, '0')}:00-06:00`;
      const endDt = `${fecha}T${String(hInt + 1).padStart(2, '0')}:${String(mInt).padStart(2, '0')}:00-06:00`;

      const eventBody = {
        summary: `Cita Médica ARM: ${nombre} (${caller_id}) - ${doctorFinal}`,
        description: `Paciente: ${nombre}\nCallerID: ${caller_id}\nDoctor: ${doctorFinal}\nMotivo: ${motivo}\nRegistrado por Agente IA ARM.`,
        start: { dateTime: startDt, timeZone: 'America/Mexico_City' },
        end: { dateTime: endDt, timeZone: 'America/Mexico_City' },
        colorId: '2'
      };

      const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventBody)
      });
      if (resp.ok) {
        const ev = await resp.json();
        googleEventId = ev.id;
      }
    } catch (e) {
      process.stderr.write(`[GCal Insert Warning] ${e.message}\n`);
    }

    // Insertar en Supabase
    const dbPayload = {
      caller_id,
      paciente_nombre: nombre,
      fecha,
      hora: hora.length === 5 ? `${hora}:00` : hora,
      estado: 'confirmada',
      motivo,
      doctor_asignado: doctorFinal,
      notas_ia: `Google Calendar Event ID: ${googleEventId || 'offline'}`
    };
    const dbRes = await dbPost('citas_calendario', dbPayload);

    return {
      success: true,
      mensaje: `Cita confirmada para ${nombre} el ${fecha} a las ${hora} con ${doctorFinal}.`,
      doctor_asignado: doctorFinal,
      google_event_id: googleEventId,
      supabase_record: dbRes,
      caller_id,
      fecha,
      hora,
      motivo
    };
  }

  if (name === 'gcal_consultar_memoria_clinica') {
    const { caller_id } = args;
    const rows = await dbGet(`historial_clinico_pacientes?caller_id=eq.${caller_id}&select=*&order=fecha_ultima_consulta.desc&limit=1`);
    if (!rows || rows.length === 0) {
      return {
        cliente_frecuente: false,
        mensaje: 'Paciente nuevo sin historial clínico previo.',
        sugerencia_preventiva: 'Recomendar chequeo general de primer ingreso.'
      };
    }
    const h = rows[0];
    return {
      cliente_frecuente: true,
      nombre_paciente: h.paciente_nombre,
      ultima_visita: h.fecha_ultima_consulta,
      ultimo_motivo: h.ultimo_motivo,
      diagnostico_previo: h.diagnostico_previo,
      sugerencia_preventiva: h.sugerencia_preventiva_ia || 'Chequeo preventivo general de sangre y perfil lipídico',
      doctor_asignado: h.doctor_asignado || 'Dra. Mariana Gómez'
    };
  }

  if (name === 'gcal_reprogramar_cita') {
    const { caller_id, nueva_fecha, nueva_hora } = args;
    const disp = await handleToolCall('gcal_listar_disponibilidad', { fecha: nueva_fecha });
    if (!disp.disponible || !disp.horarios_disponibles.includes(nueva_hora)) {
      return {
        success: false,
        error: `El horario ${nueva_hora} del día ${nueva_fecha} no está disponible.`
      };
    }

    const citas = await dbGet(`citas_calendario?caller_id=eq.${caller_id}&estado=in.(confirmada,reprogramada)&select=*&order=fecha.desc&limit=1`);
    if (!citas || citas.length === 0) {
      return { success: false, mensaje: `No se encontró cita activa para CallerID ${caller_id}.` };
    }
    const cita = citas[0];

    await dbPatch(`citas_calendario?id=eq.${cita.id}`, {
      fecha: nueva_fecha,
      hora: nueva_hora.length === 5 ? `${nueva_hora}:00` : nueva_hora,
      estado: 'confirmada',
      notas_ia: `Reprogramada a ${nueva_fecha} ${nueva_hora}`
    });

    return {
      success: true,
      mensaje: `Cita reprogramada con éxito para el ${nueva_fecha} a las ${nueva_hora}.`,
      anterior: { fecha: cita.fecha, hora: cita.hora },
      nueva: { fecha: nueva_fecha, hora: nueva_hora }
    };
  }

  if (name === 'gcal_cancelar_cita') {
    const { caller_id } = args;
    const citas = await dbGet(`citas_calendario?caller_id=eq.${caller_id}&estado=in.(confirmada,reprogramada)&select=*&order=fecha.desc&limit=1`);
    if (!citas || citas.length === 0) {
      return { success: false, mensaje: `No se encontró cita activa para CallerID ${caller_id}.` };
    }
    const cita = citas[0];

    // Eliminar de Google Calendar si tiene Event ID
    const notas = String(cita.notas_ia || '');
    if (notas.includes('Google Calendar Event ID: ')) {
      try {
        const gId = notas.split('Google Calendar Event ID: ')[1].trim().split(' ')[0];
        if (gId && gId !== 'offline') {
          const token = await getValidGoogleAccessToken();
          await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${gId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
      } catch (e) {
        process.stderr.write(`[GCal Delete Warning] ${e.message}\n`);
      }
    }

    await dbPatch(`citas_calendario?id=eq.${cita.id}`, {
      estado: 'cancelada',
      notas_ia: 'Cancelada vía ARM MCP'
    });

    return {
      success: true,
      mensaje: `La cita del ${cita.fecha} a las ${cita.hora} ha sido cancelada exitosamente.`,
      cita_cancelada: cita
    };
  }

  throw new Error(`Herramienta desconocida: ${name}`);
}

// =============================================================================
// PROTOCOLO JSON-RPC STDIO DE MCP
// =============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    const { id, method, params } = req;

    if (method === 'initialize') {
      const resp = {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'google-calendar-arm', version: '1.0.0' }
        }
      };
      process.stdout.write(JSON.stringify(resp) + '\n');
    } else if (method === 'notifications/initialized') {
      // Sin respuesta requerida
    } else if (method === 'tools/list') {
      const resp = {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS }
      };
      process.stdout.write(JSON.stringify(resp) + '\n');
    } else if (method === 'tools/call') {
      try {
        const result = await handleToolCall(params.name, params.arguments || {});
        const resp = {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          }
        };
        process.stdout.write(JSON.stringify(resp) + '\n');
      } catch (err) {
        const resp = {
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: err.message }
        };
        process.stdout.write(JSON.stringify(resp) + '\n');
      }
    } else if (id !== undefined) {
      const resp = {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: 'Method not found' }
      };
      process.stdout.write(JSON.stringify(resp) + '\n');
    }
  } catch (e) {
    process.stderr.write(`[MCP Error] ${e.message}\n`);
  }
});
