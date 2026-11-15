import { NextResponse } from 'next/server';
import net from 'net';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

// Helper para originar llamada en Asterisk 20 vía AMI (TCP 5038) con UUID homologado
function originateViaAmi(
  host: string,
  destination: string,
  agentExtension: string = '2001',
  callUuid?: string
): Promise<{ success: boolean; message: string; details?: string }> {
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
      resolve({ success: false, message: `Timeout de conexión AMI hacia ${host}:${port}` });
    }, 4000);

    socket.connect(port, host, () => {
      // Esperar banner de Asterisk
    });

    socket.on('data', (data) => {
      const text = data.toString();
      buffer += text;

      // 1. Detectar banner inicial para iniciar login
      if (buffer.includes('Asterisk Call Manager') && !authenticated) {
        authenticated = true;
        buffer = '';
        const loginCmd = 
          `Action: Login\r\n` +
          `Username: crmadmin\r\n` +
          `Secret: CrmAmiPass2026!\r\n\r\n`;
        socket.write(loginCmd);
        return;
      }

      // 2. Tras login exitoso, enviar Originate con variables de canal homologadas
      if (buffer.includes('Response: Success') && buffer.includes('Message: Authentication accepted')) {
        buffer = '';
        const prefix = agentExtension.charAt(0);
        const didVirtual = prefix === '4' ? '4000' : prefix === '3' ? '3000' : prefix === '2' ? '2000' : '1000';
        const uuidHeader = callUuid 
          ? `Variable: __CALL_UUID=${callUuid},CALL_UUID=${callUuid},__CALL_RECORDING=/var/spool/asterisk/monitor/rec_${callUuid}.wav,CALL_RECORDING=/var/spool/asterisk/monitor/rec_${callUuid}.wav,DID_VIRTUAL=${didVirtual},CABECERA_IVR=8000,EXT_AGENTE=${agentExtension}\r\n`
          : `Variable: DID_VIRTUAL=${didVirtual},CABECERA_IVR=8000,EXT_AGENTE=${agentExtension}\r\n`;
        const originateCmd = 
          `Action: Originate\r\n` +
          `Channel: Local/${destination}@from-internal\r\n` +
          `Context: from-internal\r\n` +
          `Exten: ${agentExtension}\r\n` +
          `Priority: 1\r\n` +
          `CallerID: ARM-${didVirtual} <8000>\r\n` +
          uuidHeader +
          `Timeout: 30000\r\n` +
          `Async: true\r\n\r\n`;
        socket.write(originateCmd);
        return;
      }

      // 3. Resultado de Originate
      if (buffer.includes('Response: Success') && buffer.includes('Originate successfully queued')) {
        cleanup();
        resolve({
          success: true,
          message: `Llamada a ${destination} encolada exitosamente en Asterisk 20 PBX (${host})`
        });
        return;
      }

      if (buffer.includes('Response: Error')) {
        cleanup();
        const firstLine = buffer.split('\r\n')[1] || 'Error en Asterisk AMI';
        resolve({
          success: false,
          message: `Asterisk AMI Error: ${firstLine}`,
          details: buffer
        });
        return;
      }
    });

    socket.on('error', (err) => {
      cleanup();
      resolve({ success: false, message: `Error de socket AMI: ${err.message}` });
    });
  });
}

// Helper para colgar y liberar canales de forma inmediata en Asterisk 20 vía AMI
function hangupViaAmi(
  host: string,
  destination: string,
  agentExtension: string = '2001',
  channelName?: string
): Promise<{ success: boolean; message: string; details?: string }> {
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
      resolve({ success: false, message: `Timeout al colgar llamada en AMI (${host}:${port})` });
    }, 4000);

    socket.connect(port, host, () => {});

    socket.on('data', (data) => {
      const text = data.toString();
      buffer += text;

      if (buffer.includes('Asterisk Call Manager') && !authenticated) {
        authenticated = true;
        buffer = '';
        const loginCmd = 
          `Action: Login\r\n` +
          `Username: crmadmin\r\n` +
          `Secret: CrmAmiPass2026!\r\n\r\n`;
        socket.write(loginCmd);
        return;
      }

      if (buffer.includes('Response: Success') && buffer.includes('Message: Authentication accepted')) {
        buffer = '';
        // 1. Comando CLI para solicitar hangup a cualquier canal relacionado con el destino o el agente
        const hangupCmd1 = 
          `Action: Command\r\n` +
          `Command: channel request hangup /.*(${destination}|${agentExtension}|Local).*/\r\n\r\n`;
        socket.write(hangupCmd1);

        // 2. Si se proporcionó un canal específico, enviar Action: Hangup directo
        if (channelName) {
          const hangupCmd2 = 
            `Action: Hangup\r\n` +
            `Channel: ${channelName}\r\n\r\n`;
          socket.write(hangupCmd2);
        }

        setTimeout(() => {
          socket.write(`Action: Logoff\r\n\r\n`);
          setTimeout(() => {
            cleanup();
            resolve({
              success: true,
              message: `Canales para ${destination} colgados y liberados en Asterisk 20`
            });
          }, 200);
        }, 200);
        return;
      }
    });

    socket.on('error', (err) => {
      cleanup();
      resolve({ success: false, message: `Error de socket AMI al colgar: ${err.message}` });
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      action = 'originate',
      destination, 
      agentExtension = '2001', 
      vmHost = process.env.NEXT_PUBLIC_VM_HOST || '192.168.216.128',
      channelName,
      duration = 0,
      notas = '' 
    } = body;

    if (!destination) {
      return NextResponse.json({ error: 'Falta el número o extensión de destino' }, { status: 400 });
    }

    // ACCION 1: COLGAR LLAMADA (HANGUP) Y LIBERAR CANAL
    if (action === 'hangup') {
      console.log(`[Next.js Outbound API] Solicitando HANGUP en Asterisk para ${destination} (Ext ${agentExtension})`);
      const amiHangup = await hangupViaAmi(vmHost, destination, agentExtension, channelName);

      // Actualizar bitácora en Supabase
      if (isSupabaseConfigured()) {
        try {
          await supabase
            .from('llamadas_bitacora')
            .update({
              estado: 'finalizada',
              duracion_segundos: duration,
              resumen_ia: `Llamada outbound finalizada desde el CRM por agente ${agentExtension}. Canal PBX liberado. Duración: ${duration}s.`
            })
            .eq('caller_id', destination)
            .eq('estado', 'en_curso');
        } catch (dbErr) {
          console.warn('Error actualizando bitácora al colgar:', dbErr);
        }
      }

      return NextResponse.json({
        success: true,
        action: 'hangup',
        message: amiHangup.message,
        asterisk: amiHangup,
        status: 'idle',
        released: true,
        destination,
        timestamp: new Date().toISOString()
      });
    }

    // ACCION 2: ORIGINAR LLAMADA OUTBOUND CON HOMOLOGACIÓN DE ID ÚNICO (ADN)
    console.log(`[Next.js Outbound API] Registrando e iniciando llamada hacia ${destination} desde Ext ${agentExtension}`);

    let logId = `call-out-${Date.now()}`;
    let clienteId: string | null = null;
    let clienteNombre = destination;
    let grabacionUrl = `/var/spool/asterisk/monitor/rec_${logId}.wav`;

    // 1. Registrar primero en Supabase para obtener el UUID inmutable (ADN de llamada)
    if (isSupabaseConfigured()) {
      try {
        const prefix = agentExtension.charAt(0);
        const campanaSlug = prefix === '4' ? 'doctores' : prefix === '3' ? 'ventas' : prefix === '2' ? 'cancelaciones' : 'atencion_clientes';
        const didVirtual = prefix === '4' ? '4000' : prefix === '3' ? '3000' : prefix === '2' ? '2000' : '1000';

        const { data: cliente } = await supabase
          .from('clientes')
          .select('id, nombre_completo, estatus_tarjeta, folio_cancelacion')
          .eq('caller_id', destination)
          .maybeSingle();

        if (cliente) {
          clienteId = cliente.id;
          clienteNombre = cliente.nombre_completo || destination;
        }

        // Buscar el nombre actual del agente en la campaña
        let agenteNombre = `Agente Ext. ${agentExtension}`;
        const { data: campData } = await supabase
          .from('campanas')
          .select('agentes_extensiones')
          .eq('slug', campanaSlug)
          .maybeSingle();

        if (campData && campData.agentes_extensiones) {
          const matchAg = (campData.agentes_extensiones as any[]).find(a => a.extension === agentExtension);
          if (matchAg && matchAg.nombre) {
            agenteNombre = matchAg.nombre;
          }
        }

        const { data: insertedLog } = await supabase
          .from('llamadas_bitacora')
          .insert({
            caller_id: destination,
            cliente_id: clienteId,
            tipo: 'saliente',
            estado: 'en_curso',
            campana: campanaSlug,
            did_marcado: destination,
            extension_agente: agentExtension,
            agente_nombre: agenteNombre,
            opcion_ivr_seleccionada: `Llamada Outbound PSTN (DID ${didVirtual})`,
            resumen_ia: `Llamada saliente iniciada desde el CRM hacia ${clienteNombre}. Destino: ${destination}. Atiende: ${agenteNombre} (Ext. ${agentExtension}). DID Virtual: ${didVirtual}. Cabecera: 8000.`,
            notas_agente: notas || `Marcación manual iniciada por ${agenteNombre} (Ext. ${agentExtension})`
          })
          .select('id')
          .single();

        if (insertedLog) {
          logId = insertedLog.id;
          grabacionUrl = `/var/spool/asterisk/monitor/rec_${logId}.wav`;
          // Homologar la ruta de grabación con el UUID
          await supabase
            .from('llamadas_bitacora')
            .update({ grabacion_url: grabacionUrl })
            .eq('id', logId);
        }
      } catch (errDb) {
        console.warn('Error registrando llamada saliente en Supabase:', errDb);
      }
    }

    // 2. Ejecutar originación real contra Asterisk AMI pasando el UUID homologado
    const amiResult = await originateViaAmi(vmHost, destination, agentExtension, logId);

    return NextResponse.json({
      success: true,
      action: 'originate',
      asterisk: amiResult,
      message: amiResult.success 
        ? `Llamada iniciada en Asterisk hacia ${destination}` 
        : `Llamada registrada (Aviso PBX: ${amiResult.message})`,
      callId: logId,
      logId,
      callUuid: logId,
      grabacionUrl,
      clienteId,
      destination,
      agentExtension,
      status: amiResult.success ? 'ringing' : 'originating',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get('destination') || '';
    const agentExtension = searchParams.get('agentExtension') || '2001';
    const vmHost = searchParams.get('vmHost') || process.env.NEXT_PUBLIC_VM_HOST || '192.168.216.128';

    if (!destination) {
      return NextResponse.json({ error: 'Falta destino' }, { status: 400 });
    }

    const amiHangup = await hangupViaAmi(vmHost, destination, agentExtension);
    return NextResponse.json({ success: true, message: amiHangup.message });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
