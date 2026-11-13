'use client';

import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Delete, Radio, Globe } from 'lucide-react';

interface Props {
  currentPhoneNumber: string;
  onCallInitiated: (number: string) => void;
  onCallEnded: (durationSeconds: number) => void;
}

export default function WebRTCDialer({ currentPhoneNumber, onCallInitiated, onCallEnded }: Props) {
  const [dialNumber, setDialNumber] = useState(currentPhoneNumber || '');
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (currentPhoneNumber) {
      setDialNumber(currentPhoneNumber);
    }
  }, [currentPhoneNumber]);

  // Cronómetro de llamada activa
  useEffect(() => {
    let interval: any;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const handleDigit = (digit: string) => {
    if (callStatus === 'idle') {
      setDialNumber(prev => prev + digit);
    } else {
      // Si la llamada está activa, emite tono DTMF vía SIP / WebRTC
      console.log(`[DTMF Sent]: ${digit}`);
    }
  };

  const handleBackspace = () => {
    if (callStatus === 'idle') {
      setDialNumber(prev => prev.slice(0, -1));
    }
  };

  const handleStartCall = async () => {
    if (!dialNumber) return;
    setCallStatus('calling');
    onCallInitiated(dialNumber);

    // Simulación de conexión WebRTC hacia Asterisk PBX / PSTN
    setTimeout(() => {
      setCallStatus('connected');
    }, 1500);
  };

  const handleHangup = () => {
    onCallEnded(duration);
    setCallStatus('idle');
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
      {/* Estado de Conexión SIP WebRTC */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-700">SIP WebRTC Dialer</span>
        </div>
        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
          <Globe className="w-3 h-3" /> Ext. 2001 Registrada
        </span>
      </div>

      {/* Pantalla del Teléfono */}
      <div className="bg-slate-900 rounded-lg p-3 text-white flex flex-col items-center justify-center min-h-[70px]">
        {callStatus === 'idle' ? (
          <div className="w-full flex items-center justify-between">
            <input
              type="text"
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
              placeholder="Ingrese número o CallerID..."
              className="bg-transparent text-lg font-mono font-bold text-center w-full focus:outline-none text-emerald-400 placeholder:text-slate-600"
            />
            {dialNumber && (
              <button onClick={handleBackspace} className="text-slate-400 hover:text-white p-1">
                <Delete className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              {callStatus === 'calling' ? 'Conectando con PBX / PSTN...' : 'Llamada en Curso'}
            </p>
            <p className="text-lg font-mono font-bold text-emerald-400">{dialNumber}</p>
            {callStatus === 'connected' && (
              <p className="text-xs font-mono text-slate-300 mt-0.5">{formatDuration(duration)}</p>
            )}
          </div>
        )}
      </div>

      {/* Teclado DTMF (1-9, *, 0, #) */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
          <button
            key={digit}
            onClick={() => handleDigit(digit)}
            className="py-2.5 bg-slate-50 hover:bg-slate-100 active:bg-blue-50 active:text-blue-600 rounded-lg text-sm font-bold text-slate-700 border border-slate-200 transition"
          >
            {digit}
          </button>
        ))}
      </div>

      {/* Controles de Llamada (Llamar / Colgar / Mute) */}
      <div className="flex items-center justify-center gap-3 pt-2">
        {callStatus === 'idle' ? (
          <button
            onClick={handleStartCall}
            disabled={!dialNumber}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition"
          >
            <Phone className="w-5 h-5" /> Iniciar Llamada Outbound
          </button>
        ) : (
          <>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-lg border transition ${
                isMuted ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={handleHangup}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition"
            >
              <PhoneOff className="w-5 h-5" /> Colgar Llamada
            </button>
          </>
        )}
      </div>
    </div>
  );
}
