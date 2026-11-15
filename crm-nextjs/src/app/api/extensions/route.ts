import { NextResponse } from 'next/server';
import net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

const execAsync = promisify(exec);

// Helper para enviar comandos de recarga a Asterisk vía AMI (TCP 5038)
function reloadAsteriskViaAmi(host: string = '192.168.216.128'): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const port = 5038;
    const socket = new net.Socket();
    let authenticated = false;
    let buffer = '';
    let timeoutId: NodeJS.Timeout;

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.removeAllListeners();
      if (!socket.destroyed) {
        socket.destroy();
      }
    };

    timeoutId = setTimeout(() => {
      cleanup();
      resolve({ success: false, message: 'Timeout contactando Asterisk AMI' });
    }, 4000);

    socket.connect(port, host, () => {});

    socket.on('data', (data) => {
      buffer += data.toString();

      if (buffer.includes('Asterisk Call Manager') && !authenticated) {
        authenticated = true;
        buffer = '';
        socket.write(
          `Action: Login\r\n` +
          `Username: crmadmin\r\n` +
          `Secret: CrmAmiPass2026!\r\n\r\n`
        );
        return;
      }

      if (buffer.includes('Response: Success') && buffer.includes('Message: Authentication accepted')) {
        buffer = '';
        // 1. Recargar dialplan
        socket.write(`Action: Command\r\nCommand: dialplan reload\r\n\r\n`);
        setTimeout(() => {
          // 2. Recargar pjsip
          socket.write(`Action: Command\r\nCommand: pjsip reload\r\n\r\n`);
          setTimeout(() => {
            socket.write(`Action: Logoff\r\n\r\n`);
            cleanup();
            resolve({ success: true, message: 'Asterisk 20 dialplan y pjsip recargados exitosamente en memoria' });
          }, 200);
        }, 200);
        return;
      }
    });

    socket.on('error', (err) => {
      cleanup();
      resolve({ success: false, message: `Aviso AMI: ${err.message}` });
    });
  });
}

// Sincronizar archivo /etc/asterisk/pjsip_custom.conf dentro del contenedor Asterisk
async function syncPjsipCustomFile() {
  if (!isSupabaseConfigured()) return;

  try {
    const { data: exts, error } = await supabase
      .from('extensiones')
      .select('*')
      .order('extension', { ascending: true });

    if (error || !exts) return;

    const baseExtensions = new Set([
      '1001', '1002', '1003', '1004',
      '2001', '2002', '2003', '2004',
      '3001', '3002', '3003', '3004',
      '4001', '4002', '4003', '4004', '4005'
    ]);

    // Generar contenido PJSIP únicamente para extensiones adicionales dinámicas (evitando colisión de duplicados en Sorcery)
    let confContent = '; =========================================================================\n' +
      '; EXTENSIONES DINÁMICAS ADICIONALES GENERADAS AUTOMÁTICAMENTE DESDE SUPABASE / CRM\n' +
      '; =========================================================================\n\n';

    let additionalCount = 0;
    for (const ext of exts) {
      const extNum = ext.extension;
      if (baseExtensions.has(extNum)) continue; // Ya estructurada en pjsip.conf

      additionalCount++;
      const pass = ext.password || `ARMpass${extNum}!`;
      const name = ext.nombre_agente || `Agente ${extNum}`;

      confContent += `; Extensión Adicional ${extNum}: ${name} (${ext.campana_slug})\n`;
      confContent += `[${extNum}](endpoint-template)\n`;
      confContent += `auth=auth-${extNum}\n`;
      confContent += `aors=${extNum}\n\n`;

      confContent += `[auth-${extNum}]\n`;
      confContent += `type=auth\n`;
      confContent += `auth_type=userpass\n`;
      confContent += `username=${extNum}\n`;
      confContent += `password=${pass}\n\n`;

      confContent += `[${extNum}]\n`;
      confContent += `type=aor\n`;
      confContent += `max_contacts=5\n`;
      confContent += `remove_existing=yes\n\n`;
    }

    if (additionalCount === 0) {
      confContent += '; No hay extensiones adicionales dinámicas fuera de pjsip.conf actualmente.\n';
    }

    // Escribir al contenedor si estamos en Linux / VM
    try {
      const escaped = confContent.replace(/'/g, "'\\''");
      await execAsync(`echo '${escaped}' | docker exec -i asterisk-arm tee /etc/asterisk/pjsip_custom.conf > /dev/null`);
    } catch {
      // Si estamos en entorno de desarrollo local sin docker directo, continuar con AMI
    }
  } catch (e) {
    console.warn('Aviso sincronizando archivo pjsip_custom:', e);
  }
}

// GET: Obtener lista de extensiones desde la tabla Supabase 'extensiones'
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campanaSlug = searchParams.get('campana');

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 });
    }

    let query = supabase.from('extensiones').select('*').order('extension', { ascending: true });
    if (campanaSlug) {
      query = query.eq('campana_slug', campanaSlug);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, extensiones: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Crear, actualizar o cambiar estado de una extensión con recarga automática
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      extension,
      nombre,
      password,
      campanaId,
      campanaSlug,
      didVirtual,
      activo = true,
      action = 'create',
      vmHost = process.env.NEXT_PUBLIC_VM_HOST || '192.168.216.128'
    } = body;

    // Si la acción es recarga o no trae extensión específica
    if (action === 'reload' || (!extension && !nombre)) {
      await syncPjsipCustomFile();
      const amiReload = await reloadAsteriskViaAmi(vmHost);
      return NextResponse.json({
        success: true,
        message: 'Asterisk 20 dialplan y PJSIP recargados exitosamente vía AMI',
        asterisk: amiReload,
        timestamp: new Date().toISOString()
      });
    }

    const defaultPassword = password || `ARMpass${extension}!`;

    // 1. Guardar en tabla 'extensiones' en Supabase
    if (isSupabaseConfigured()) {
      // Verificar si ya existe para preservar histórico si se cambia de nombre
      const { data: existing } = await supabase
        .from('extensiones')
        .select('*')
        .eq('extension', extension)
        .maybeSingle();

      let historial = existing?.historial_nombres || [];
      if (existing && existing.nombre_agente && existing.nombre_agente !== nombre) {
        historial.unshift({
          nombre_anterior: existing.nombre_agente,
          fecha_cambio: new Date().toISOString()
        });
      }

      const payload = {
        extension,
        nombre_agente: nombre,
        password: defaultPassword,
        campana_id: campanaId || existing?.campana_id,
        campana_slug: campanaSlug || existing?.campana_slug || 'atencion_clientes',
        did_virtual_campana: didVirtual || existing?.did_virtual_campana || '1000',
        cabecera_ivr: '8000',
        activo,
        historial_nombres: historial,
        updated_at: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase
        .from('extensiones')
        .upsert(payload, { onConflict: 'extension' });

      if (upsertErr) {
        console.warn('Error upsert extensiones:', upsertErr);
      }

      // Sincronizar también con la tabla 'campanas' (agentes_extensiones y dids_asociados)
      if (campanaSlug) {
        const { data: campData } = await supabase
          .from('campanas')
          .select('id, dids_asociados, agentes_extensiones')
          .eq('slug', campanaSlug)
          .maybeSingle();

        if (campData) {
          let agentesList: any[] = campData.agentes_extensiones || [];
          const idx = agentesList.findIndex((a) => a.extension === extension);
          if (idx >= 0) {
            agentesList[idx] = {
              ...agentesList[idx],
              nombre,
              password: defaultPassword,
              activo
            };
          } else {
            agentesList.push({
              extension,
              nombre,
              password: defaultPassword,
              activo: true
            });
          }

          let dids: string[] = campData.dids_asociados || [];
          if (!dids.includes(extension)) {
            dids.push(extension);
          }

          await supabase
            .from('campanas')
            .update({
              agentes_extensiones: agentesList,
              dids_asociados: dids
            })
            .eq('slug', campanaSlug);
        }
      }
    }

    // 2. Sincronizar archivo pjsip_custom.conf
    await syncPjsipCustomFile();

    // 3. Ejecutar recarga atómica en caliente de Asterisk 20 (pjsip reload y dialplan reload)
    const amiReload = await reloadAsteriskViaAmi(vmHost);

    return NextResponse.json({
      success: true,
      message: `Extensión ${extension} sincronizada con contraseña y recarga ejecutada en Asterisk 20`,
      extension,
      nombre,
      password: defaultPassword,
      asterisk: amiReload,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error en endpoint de extensiones' }, { status: 500 });
  }
}
