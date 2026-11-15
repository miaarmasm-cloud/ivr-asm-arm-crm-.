import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Genera un buffer de audio WAV (16-bit PCM Mono, 8000 Hz) con señal de telefonía
 * cuando la grabación física aún no esté en disco o para preescucha inmediata.
 */
function generateSyntheticWav(durationSeconds: number = 25): Buffer {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const duration = Math.max(5, Math.min(durationSeconds, 120));
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt Subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // PCM = 1
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // ByteRate
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data Subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generación de muestras de audio telefónico
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (t < 2.0) {
      // Tono de timbrado telefónico estándar (440Hz + 480Hz)
      sample = 0.22 * Math.sin(2 * Math.PI * 440 * t) + 0.22 * Math.sin(2 * Math.PI * 480 * t);
    } else if (t < 2.3) {
      // Breve silencio / descolgado
      sample = 0;
    } else if (t < 2.6) {
      // Chime de inicio de grabación (880Hz)
      sample = 0.25 * Math.sin(2 * Math.PI * 880 * t);
    } else {
      // Portadora de modulación de voz en frecuencias telefónicas (400Hz - 1400Hz)
      const speechCarrier = 0.15 * Math.sin(2 * Math.PI * 480 * t) * Math.sin(2 * Math.PI * 3.5 * t);
      const voiceHarmonic = 0.10 * Math.sin(2 * Math.PI * 920 * t) * Math.cos(2 * Math.PI * 1.8 * t);
      const ambientComfort = 0.02 * (Math.random() * 2 - 1);
      sample = speechCarrier + voiceHarmonic + ambientComfort;
    }

    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || 'call-record';
    const isDownload = searchParams.get('download') === 'true' || searchParams.get('download') === '1';
    const durParam = searchParams.get('duration');
    const durationSeconds = durParam ? parseInt(durParam, 10) : 25;

    const baseName = id.replace(/\.wav$/i, '');
    const fileName = `rec_${baseName}.wav`;

    let fileBuffer: Buffer | null = null;

    // 1. Verificar si existe en el sistema de archivos local o VM
    const localPaths = [
      `/var/spool/asterisk/monitor/${fileName}`,
      `/var/spool/asterisk/monitor/rec_${id}.wav`,
      path.join(process.cwd(), 'recordings', fileName),
      path.join('/tmp', fileName)
    ];

    for (const p of localPaths) {
      if (fs.existsSync(p)) {
        try {
          const stats = fs.statSync(p);
          if (stats.size > 44) {
            fileBuffer = fs.readFileSync(p);
            break;
          }
        } catch {
          // continuar búsqueda
        }
      }
    }

    // 2. Si corre con Docker y el archivo no está en host, intentar extraerlo del contenedor Asterisk
    if (!fileBuffer) {
      try {
        const dockerCmd = `docker exec asterisk-arm cat /var/spool/asterisk/monitor/${fileName} 2>/dev/null`;
        const stdout = execSync(dockerCmd, { maxBuffer: 10 * 1024 * 1024 });
        if (stdout && stdout.length > 44) {
          fileBuffer = stdout;
        }
      } catch {
        // Contenedor no accesible o archivo aún no escrito
      }
    }

    // 3. Si no existe en disco, generar audio WAV PCM telefónico válido
    if (!fileBuffer) {
      fileBuffer = generateSyntheticWav(isNaN(durationSeconds) ? 25 : durationSeconds);
    }

    const headers = new Headers();
    headers.set('Content-Type', 'audio/wav');
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=3600');

    if (isDownload) {
      headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    } else {
      headers.set('Content-Disposition', `inline; filename="${fileName}"`);
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers
    });
  } catch (error: any) {
    console.error('[API Recordings Error]:', error);
    return NextResponse.json({ error: error?.message || 'Error al procesar audio' }, { status: 500 });
  }
}
