'use client';

import React, { useState } from 'react';
import { 
  PhoneIncoming, 
  PhoneOutgoing,
  User, 
  Check, 
  X, 
  ShieldAlert, 
  CreditCard, 
  DollarSign, 
  Volume2, 
  VolumeX, 
  Building,
  Sparkles,
  PhoneForwarded,
  Tag,
  AlertTriangle,
  FileText,
  Save,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Customer } from '@/lib/types';

interface Props {
  incomingCallerId: string | null;
  customer: Customer | null;
  callType?: 'entrante' | 'saliente';
  incidentFolio?: string;
  incidentReport?: string;
  onAccept: (callerId: string) => void;
  onDismiss: () => void;
  onSaveIncidentNotes?: (callerId: string, notes: string) => void;
}

export default function ScreenPopModal({ 
  incomingCallerId, 
  customer, 
  callType = 'saliente',
  incidentFolio,
  incidentReport,
  onAccept, 
  onDismiss,
  onSaveIncidentNotes
}: Props) {
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [incidentNotes, setIncidentNotes] = useState('');
  const [savedNotesAlert, setSavedNotesAlert] = useState(false);

  if (!incomingCallerId) return null;

  const isOutbound = callType === 'saliente';
  const isCardCancelled = customer?.estatus_tarjeta === 2;
  const activeFolio = incidentFolio || customer?.folio_cancelacion || `INC-${new Date().getFullYear()}-${incomingCallerId}`;

  const handleSaveNotes = () => {
    if (onSaveIncidentNotes && incidentNotes.trim()) {
      onSaveIncidentNotes(incomingCallerId, incidentNotes.trim());
      setSavedNotesAlert(true);
      setTimeout(() => setSavedNotesAlert(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 max-w-lg w-full p-6 space-y-4 relative overflow-hidden">
        {/* Glow de fondo animado */}
        <div className={`absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 rounded-full blur-2xl pointer-events-none ${
          isOutbound ? 'bg-blue-500/15' : 'bg-emerald-500/15'
        }`} />

        {/* Cabecera del Screen-Pop */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-3.5 text-white rounded-2xl shadow-lg animate-bounce ${
              isOutbound 
                ? 'bg-blue-600 shadow-blue-500/30' 
                : 'bg-emerald-500 shadow-emerald-500/30'
            }`}>
              {isOutbound ? <PhoneOutgoing className="w-6 h-6" /> : <PhoneIncoming className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                  isOutbound 
                    ? 'text-blue-700 bg-blue-50 border-blue-200' 
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                }`}>
                  {isOutbound ? 'Pop Outbound Activo • Asterisk 20' : 'Screen-Pop Entrante • Asterisk 20'}
                </span>
                {isCardCancelled && (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-rose-600" /> Cancelada
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight font-mono mt-1">
                {incomingCallerId}
              </h3>
            </div>
          </div>

          <button
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-xl transition"
            title={isAudioMuted ? 'Activar audio' : 'Silenciar'}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-slate-600" />}
          </button>
        </div>

        {/* Tarjeta de Incidencia o Reporte del Momento */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2.5 border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 font-bold text-emerald-400">
              <Tag className="w-3.5 h-3.5" /> Folio de Incidencia del Momento:
            </span>
            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-[11px] font-extrabold text-white border border-slate-700">
              {activeFolio}
            </span>
          </div>

          <div className="text-xs text-slate-300 leading-relaxed">
            {incidentReport ? (
              <p>{incidentReport}</p>
            ) : isCardCancelled ? (
              <p className="text-rose-300 font-medium flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Reporte de Incidencia:</strong> Tarjeta en <strong>Estatus 2 (Cancelada/Bloqueada)</strong>.
                  {customer?.motivo_cancelacion && ` Motivo: "${customer.motivo_cancelacion}".`} Saldo retenido en IVR.
                </span>
              </p>
            ) : (
              <p className="text-slate-300 flex items-start gap-1.5">
                <FileText className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Reporte de Llamada:</strong> Contacto saliente iniciado hacia el cliente. Línea verificada en Asterisk 20.
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Ficha Predictiva del Contacto / Cliente */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 text-xs space-y-2.5">
          {customer ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cliente Identificado</span>
                  <span className="font-bold text-slate-800 text-sm">{customer.nombre_completo}</span>
                </div>
                {customer.saldo > 10000 && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-300">
                    <Sparkles className="w-3 h-3 text-amber-600" /> Preferente
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 font-semibold block flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-500" /> Empresa
                  </span>
                  <span className="font-semibold text-slate-700 text-xs truncate block mt-0.5">
                    {customer.empresa || 'Particular'}
                  </span>
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 font-semibold block flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-600" /> Saldo Registrado
                  </span>
                  <span className="font-bold text-emerald-700 text-xs font-mono block mt-0.5">
                    ${Number(customer.saldo).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-slate-600 bg-white/70 px-3 py-1.5 rounded-xl border border-slate-200/60 text-[11px]">
                <span className="font-medium flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Tarjeta:
                </span>
                <span className="font-mono font-bold text-slate-800">{customer.numero_tarjeta_mask}</span>
              </div>
            </>
          ) : (
            <div className="py-2 flex items-start gap-2.5 text-slate-600">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800 text-xs">Destino Telefónico sin Ficha Previa</p>
                <p className="text-[11px] text-slate-500">
                  Número libre para marcación. Al continuar, se registrará el nuevo contacto en la base de datos.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Captura Rápida de Notas para la Incidencia de ese Momento */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 block">
            Notas de la Incidencia / Gestión en Vivo:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={incidentNotes}
              onChange={(e) => setIncidentNotes(e.target.value)}
              placeholder="Capturar reporte o acuerdo de la llamada..."
              className="w-full text-xs p-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-500 font-sans"
            />
            {onSaveIncidentNotes && (
              <button
                onClick={handleSaveNotes}
                disabled={!incidentNotes.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl flex items-center gap-1 shrink-0 transition"
                title="Guardar notas en la bitácora"
              >
                <Save className="w-3.5 h-3.5" /> Guardar
              </button>
            )}
          </div>
          {savedNotesAlert && (
            <span className="text-[10px] text-emerald-600 font-bold block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Reporte guardado en bitácora de Supabase
            </span>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <X className="w-4 h-4 text-slate-400" /> Cerrar Pop
          </button>

          <button
            onClick={() => onAccept(incomingCallerId)}
            className={`flex-2 py-2.5 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95 ${
              isOutbound 
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' 
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
            }`}
          >
            <Check className="w-4 h-4" /> Desplegar Ficha de Incidencia
          </button>
        </div>
      </div>
    </div>
  );
}
