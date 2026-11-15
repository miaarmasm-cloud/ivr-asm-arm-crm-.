import fs from 'fs';
import path from 'path';

// Ruta al token persistente de Google OAuth 2.0 (generado por el proyecto mia-asm-arm)
const TOKEN_PATHS = [
  path.resolve(process.cwd(), '../mcp-server/google_token.json'),
  path.resolve(process.cwd(), 'mcp-server/google_token.json'),
  path.resolve(__dirname, '../../../../mcp-server/google_token.json')
];

function findTokenFile(): string | null {
  for (const p of TOKEN_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function getValidGoogleAccessToken(): Promise<string | null> {
  const tokenFile = findTokenFile();
  if (!tokenFile) {
    console.warn('[Google Calendar Sync] No se encontró el archivo google_token.json');
    return null;
  }

  try {
    const raw = fs.readFileSync(tokenFile, 'utf8');
    const tokenData = JSON.parse(raw);
    const now = Date.now();
    const expiry = tokenData.expiry ? new Date(tokenData.expiry).getTime() : 0;

    // Si aún tiene más de 2 minutos de validez
    if (tokenData.token && expiry > now + 120000) {
      return tokenData.token;
    }

    // Refrescar con refresh_token
    if (tokenData.refresh_token && tokenData.client_id && tokenData.client_secret) {
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
        fs.writeFileSync(tokenFile, JSON.stringify(tokenData, null, 2), 'utf8');
        return tokenData.token;
      }
    }

    return tokenData.token || null;
  } catch (err) {
    console.error('[Google Calendar Sync Error]:', err);
    return null;
  }
}

export async function createGoogleCalendarEvent(params: {
  caller_id: string;
  paciente_nombre: string;
  doctor_asignado: string;
  fecha: string;
  hora: string;
  motivo: string;
  paciente_email?: string;
  doctor_email?: string;
}): Promise<string | null> {
  const token = await getValidGoogleAccessToken();
  if (!token) return null;

  try {
    const [hStr, mStr] = params.hora.split(':');
    const h = parseInt(hStr || '10', 10);
    const m = parseInt(mStr || '0', 10);
    const startIso = `${params.fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-06:00`;
    const endIso = `${params.fecha}T${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-06:00`;

    const attendees: Array<{ email: string; displayName?: string }> = [];
    if (params.doctor_email) {
      attendees.push({ email: params.doctor_email, displayName: params.doctor_asignado });
    }
    if (params.paciente_email) {
      attendees.push({ email: params.paciente_email, displayName: params.paciente_nombre });
    }

    const eventBody: any = {
      summary: `Cita Médica ARM: ${params.paciente_nombre} - ${params.doctor_asignado}`,
      description: `Paciente: ${params.paciente_nombre}\nCallerID: ${params.caller_id}\nMédico: ${params.doctor_asignado}\nMotivo: ${params.motivo}\nRegistrado vía ARM CRM & Google Calendar MCP Sync.`,
      start: { dateTime: startIso, timeZone: 'America/Mexico_City' },
      end: { dateTime: endIso, timeZone: 'America/Mexico_City' },
      colorId: '2' // Sage / Salud
    };

    if (attendees.length > 0) {
      eventBody.attendees = attendees;
    }

    const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventBody)
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.id || null;
    } else {
      const errTxt = await resp.text();
      console.warn('[Google Calendar API Insert Failed]:', errTxt);
    }
  } catch (err) {
    console.error('[Google Calendar Event Creation Error]:', err);
  }
  return null;
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<boolean> {
  const token = await getValidGoogleAccessToken();
  if (!token || !eventId) return false;

  try {
    const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return resp.status === 204 || resp.ok;
  } catch (err) {
    console.error('[Google Calendar Delete Error]:', err);
    return false;
  }
}
