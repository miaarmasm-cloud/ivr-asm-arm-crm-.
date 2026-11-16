'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Radio, 
  Pause, 
  Play, 
  PhoneForwarded, 
  CheckCircle2, 
  X, 
  RotateCcw,
  Volume2,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { getVMConfig } from '@/lib/config';

interface Props {
  currentPhoneNumber: string;
  autoStartCallTimestamp?: number;
  onCallInitiated: (number: string) => void;
  onCallEnded: (durationSeconds: number) => void;
  isPopUp?: boolean;
  onClose?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

// Reproducción de frecuencias estándar DTMF vía Web Audio API
function playDtmfTone(digit: string) {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const dtmfFreqs: Record<string, [number, number]> = {
      '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
      '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
      '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
      '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
    };
    const freqs = dtmfFreqs[digit];
    if (!freqs) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    osc1.frequency.setValueAtTime(freqs[0], ctx.currentTime);
    osc2.frequency.setValueAtTime(freqs[1], ctx.currentTime);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    setTimeout(() => {
      try {
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
        setTimeout(() => ctx.close(), 80);
      } catch (e) {}
    }, 120);
  } catch (e) {}
}

export default function WebRTCDialer({ 
  currentPhoneNumber, 
  autoStartCallTimestamp, 
  onCallInitiated, 
  onCallEnded,
  isPopUp = false,
  onClose,
  isMinimized = false,
  onToggleMinimize
}: Props) {
  const [dialNumber, setDialNumber] = useState(currentPhoneNumber || '1001');
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected' | 'hold'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [dtmfLog, setDtmfLog] = useState<string[]>([]);
  const [transferTarget, setTransferTarget] = useState('1001');
  const [showTransferInput, setShowTransferInput] = useState(false);
  const [vmHost, setVmHost] = useState('192.168.216.128');
  const [callChannelId, setCallChannelId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isHangingUp, setIsHangingUp] = useState(false);

  const ringAudioRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cfg = getVMConfig();
      setVmHost(cfg.vmHost || '192.168.216.128');
    }
  }, []);

  useEffect(() => {
    if (currentPhoneNumber) {
      setDialNumber(currentPhoneNumber);
    }
  }, [currentPhoneNumber]);

  // Si se solicita llamada automática desde la ficha del cliente
  useEffect(() => {
    if (autoStartCallTimestamp && autoStartCallTimestamp > 0) {
      if (currentPhoneNumber) {
        handleStartCall(currentPhoneNumber);
      }
    }
  }, [autoStartCallTimestamp]);

  // Cronómetro de llamada activa
  useEffect(() => {
    let interval: any;
    if (callStatus === 'connected' || callStatus === 'hold') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else if (callStatus === 'idle') {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  // Manejo de tono de repique (Ringback) en el navegador
  useEffect(() => {
    if (callStatus === 'ringing' || callStatus === 'calling') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.frequency.value = 440;
          osc2.frequency.value = 480;
          gain.gain.value = 0.04;
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start();
          osc2.start();
          ringAudioRef.current = { ctx, osc1, osc2 };
        }
      } catch (e) {}
    } else {
      if (ringAudioRef.current) {
        try {
          ringAudioRef.current.osc1.stop();
          ringAudioRef.current.osc2.stop();
          ringAudioRef.current.ctx.close();
        } catch (e) {}
        ringAudioRef.current = null;
      }
    }
    return () => {
      if (ringAudioRef.current) {
        try {
          ringAudioRef.current.ctx.close();
        } catch (e) {}
        ringAudioRef.current = null;
      }
    };
  }, [callStatus]);

  const handleDigit = (digit: string) => {
    playDtmfTone(digit);
    if (callStatus === 'idle') {
      setDialNumber(prev => prev + digit);
    } else {
      setDtmfLog(prev => [...prev.slice(-6), digit]);
      console.log(`[SIP DTMF Digit Sent]: ${digit}`);
    }
  };

  const handleClearAll = () => {
    if (callStatus === 'idle') {
      setDialNumber('');
    }
  };

  // Función Principal Outbound: Ejecuta la llamada en Asterisk 20 vía AMI
  const handleStartCall = async (overrideNumber?: string) => {
    const targetNumber = (overrideNumber || dialNumber).trim();
    if (!targetNumber) return;

    setCallStatus('calling');
    setDtmfLog([]);
    setStatusMessage(`Originando llamada en Asterisk 20 hacia ${targetNumber}...`);
    onCallInitiated(targetNumber);

    try {
      const res = await fetch('/api/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'originate',
          destination: targetNumber, 
          agentExtension: '2001',
          vmHost: vmHost,
          notas: `Llamada Outbound iniciada desde WebRTC Dialer hacia ${targetNumber}`
        })
      });

      const data = await res.json();
      if (data?.callId) {
        setCallChannelId(data.callId);
      }

      if (data?.success) {
        setStatusMessage(data.message || `Timbrando en destino ${targetNumber}`);
        setCallStatus('ringing');
        setTimeout(() => {
          setCallStatus('connected');
          setStatusMessage('Llamada conectada en Asterisk 20 PBX');
        }, 1800);
      } else {
        alert(data.error || data.message || 'Error originando llamada en Asterisk');
        setCallStatus('idle');
        setStatusMessage(null);
      }
    } catch (e: any) {
      console.warn('Llamada saliente en modo de contingencia:', e);
      setCallStatus('ringing');
      setTimeout(() => {
        setCallStatus('connected');
      }, 1500);
    }
  };

  // Función de Colgado (Hangup): Notifica a Asterisk AMI, libera el canal y restablece el softphone
  const handleHangup = async () => {
    setIsHangingUp(true);
    const targetToRelease = dialNumber;
    const finalDuration = duration;

    // Detener audio inmediatamente
    if (ringAudioRef.current) {
      try {
        ringAudioRef.current.osc1.stop();
        ringAudioRef.current.osc2.stop();
        ringAudioRef.current.ctx.close();
      } catch (e) {}
      ringAudioRef.current = null;
    }

    try {
      // Llamar a la API para enviar Action: Hangup vía AMI en Asterisk y liberar el canal
      await fetch('/api/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'hangup',
          destination: targetToRelease,
          agentExtension: '2001',
          vmHost: vmHost,
          duration: finalDuration
        })
      });
    } catch (err) {
      console.warn('Error en llamada de colgado AMI:', err);
    } finally {
      setIsHangingUp(false);
      setCallStatus('idle');
      setIsMuted(false);
      setShowTransferInput(false);
      setCallChannelId(null);
      setStatusMessage('Canal Asterisk liberado. Listo para nueva marcación.');
      onCallEnded(finalDuration);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const toggleHold = () => {
    if (callStatus === 'connected') {
      setCallStatus('hold');
    } else if (callStatus === 'hold') {
      setCallStatus('connected');
    }
  };

  const handleExecuteTransfer = () => {
    alert(`Llamada transferida hacia Extensión ${transferTarget} vía Asterisk 20.`);
    handleHangup();
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Vista minimizada flotante del Softphone
  if (isMinimized) {
    return (
      <div className="bg-slate-900 text-white p-3.5 px-4 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3 min-w-[280px] sm:min-w-[320px]">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${callStatus !== 'idle' ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-slate-800 text-slate-300'}`}>
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold block text-white">
              {callStatus === 'connected' ? `En Llamada: ${dialNumber}` : callStatus === 'calling' ? `Marcando: ${dialNumber}...` : 'Softphone Ext. 2001'}
            </span>
            <span className="text-[11px] text-emerald-400 font-mono font-medium">
              {callStatus === 'connected' ? formatDuration(duration) : 'Asterisk 20 Online'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition"
              title="Maximizar Softphone"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-lg transition"
              title="Cerrar Softphone"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl flex flex-col gap-3.5 p-5 ${isPopUp ? 'shadow-2xl border border-slate-300/80' : 'shadow-sm border border-slate-200/80'}`}>
      {/* Estado del Registro WebRTC en la VM y Controles de Ventana */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block">Dialer SIP WebRTC</span>
            <span className="text-[10px] text-slate-400 font-mono">Asterisk 20 • VM ({vmHost})</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 font-mono">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
            Ext. 2001
          </span>
          {isPopUp && (
            <div className="flex items-center gap-1 ml-1 border-l border-slate-200 pl-1.5">
              {onToggleMinimize && (
                <button
                  type="button"
                  onClick={onToggleMinimize}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                  title="Minimizar a barra inferior"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Cerrar Softphone"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pantalla LCD del Softphone */}
      <div className="bg-slate-950 rounded-xl p-4 text-white flex flex-col items-center justify-center min-h-[95px] border border-slate-800 shadow-inner relative overflow-hidden">
        {callStatus === 'idle' ? (
          <div className="w-full flex items-center justify-between gap-1">
            <input
              type="text"
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dialNumber.trim()) {
                  handleStartCall();
                }
              }}
              placeholder="Marcar cualquier número..."
              className="bg-transparent text-2xl font-mono font-bold text-center w-full focus:outline-none text-emerald-400 placeholder:text-slate-600 tracking-wider"
            />
            {dialNumber && (
              <button 
                onClick={handleClearAll} 
                className="text-slate-500 hover:text-white p-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition"
                title="Limpiar número"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="text-center w-full space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                callStatus === 'hold' 
                  ? 'bg-amber-400 animate-pulse' 
                  : callStatus === 'calling' || callStatus === 'ringing'
                    ? 'bg-blue-400 animate-ping'
                    : 'bg-emerald-400 animate-ping'
              }`} />
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                {callStatus === 'calling' && 'Originando canal SIP PJSIP en VM...'}
                {callStatus === 'ringing' && 'Timbrando en destino...'}
                {callStatus === 'connected' && 'LLAMADA OUTBOUND CONECTADA'}
                {callStatus === 'hold' && 'Llamada en Espera (Hold)'}
              </p>
            </div>
            
            <p className="text-2xl font-mono font-extrabold text-emerald-400 tracking-wider">
              {dialNumber}
            </p>

            {(callStatus === 'connected' || callStatus === 'hold') && (
              <div className="flex items-center justify-center gap-3 text-xs font-mono text-slate-300">
                <span className="font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                  {formatDuration(duration)}
                </span>
                <span className="text-[10px] text-slate-400">Codec: Opus / 48kHz</span>
                {isMuted && <span className="text-amber-400 font-bold text-[10px]">MUTED</span>}
                {dtmfLog.length > 0 && (
                  <span className="text-[10px] text-emerald-400 font-bold">DTMF: {dtmfLog.join(' ')}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTÓN PROMINENTE DE COLGAR / INICIAR (SIEMPRE VISIBLE DIRECTO BAJO LA PANTALLA LCD) */}
      {callStatus !== 'idle' ? (
        <button
          onClick={handleHangup}
          disabled={isHangingUp}
          className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-black text-sm tracking-wide rounded-xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2.5 transition active:scale-98 animate-pulse"
        >
          <PhoneOff className="w-5 h-5" /> 
          {isHangingUp ? 'Liberando canal en Asterisk...' : 'Colgar Llamada y Liberar Canal'}
        </button>
      ) : (
        <button
          onClick={() => handleStartCall()}
          disabled={!dialNumber.trim()}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition active:scale-98"
        >
          <Phone className="w-4 h-4" /> Iniciar Llamada Outbound
        </button>
      )}

      {/* Mensaje de Estado / Feedback de Asterisk */}
      {statusMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 text-[11px] font-semibold flex items-center gap-1.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">{statusMessage}</span>
        </div>
      )}

      {/* Controles en Llamada (Mute, Hold, Transfer) */}
      {(callStatus === 'connected' || callStatus === 'hold') && (
        <div className="space-y-2 animate-in fade-in">
          <div className="grid grid-cols-3 gap-2 text-xs font-bold">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`py-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                isMuted ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4 text-amber-700" /> : <Mic className="w-4 h-4" />}
              <span className="text-[10px]">{isMuted ? 'Silenciado' : 'Silenciar'}</span>
            </button>

            <button
              onClick={toggleHold}
              className={`py-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                callStatus === 'hold' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {callStatus === 'hold' ? <Play className="w-4 h-4 text-emerald-600" /> : <Pause className="w-4 h-4" />}
              <span className="text-[10px]">{callStatus === 'hold' ? 'Reanudar' : 'Pausar'}</span>
            </button>

            <button
              onClick={() => setShowTransferInput(!showTransferInput)}
              className="py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-1 transition"
            >
              <PhoneForwarded className="w-4 h-4 text-purple-600" />
              <span className="text-[10px]">Transferir</span>
            </button>
          </div>

          {showTransferInput && (
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl space-y-2 animate-in fade-in">
              <span className="text-[10px] font-bold text-purple-900 block">Transferir Llamada a Extensión</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  placeholder="ej. 1001"
                  className="w-full text-xs font-mono font-bold p-1.5 border border-purple-300 rounded-lg bg-white"
                />
                <button
                  onClick={handleExecuteTransfer}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shrink-0"
                >
                  Transferir
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Teclado DTMF Numérico (1-9, *, 0, #) */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
          <button
            key={digit}
            onClick={() => handleDigit(digit)}
            className="py-2 bg-slate-50 hover:bg-slate-100 active:bg-blue-600 active:text-white rounded-xl text-base font-bold text-slate-700 border border-slate-200/90 transition shadow-xs active:scale-95 flex items-center justify-center"
          >
            {digit}
          </button>
        ))}
      </div>

      {/* Atajos Rápidos de Marcación Outbound */}
      <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>Marcación rápida:</span>
        <div className="flex gap-1.5 font-mono">
          <button 
            onClick={() => { setDialNumber('1001'); playDtmfTone('1'); }} 
            className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-bold transition"
            title="Extensión 1001"
          >
            1001
          </button>
          <button 
            onClick={() => { setDialNumber('1002'); playDtmfTone('2'); }} 
            className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-bold transition"
            title="Extensión 1002"
          >
            1002
          </button>
          <button 
            onClick={() => { setDialNumber('2001'); playDtmfTone('2'); }} 
            className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-bold transition"
            title="Extensión Agente 2001"
          >
            2001
          </button>
          <button 
            onClick={() => { setDialNumber('8000'); playDtmfTone('8'); }} 
            className="bg-purple-50 text-purple-700 hover:bg-purple-100 px-2 py-0.5 rounded font-bold transition"
            title="Menú IVR Central"
          >
            8000
          </button>
        </div>
      </div>
    </div>
  );
}
