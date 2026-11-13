'use client';

import React from 'react';
import { PhoneIncoming, User, Check, X, ShieldAlert } from 'lucide-react';
import { Customer } from '@/lib/types';

interface Props {
  incomingCallerId: string | null;
  customer: Customer | null;
  onAccept: (callerId: string) => void;
  onDismiss: () => void;
}

export default function ScreenPopModal({ incomingCallerId, customer, onAccept, onDismiss }: Props) {
  if (!incomingCallerId) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
        {/* Cabecera Animada */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full animate-bounce">
            <PhoneIncoming className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              Llamada Entrante Detectada (Screen-Pop)
            </span>
            <h3 className="text-xl font-bold text-slate-800">
              {incomingCallerId}
            </h3>
          </div>
        </div>

        {/* Datos Previos del Cliente */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
          {customer ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Cliente Identificado:</span>
                <span className="font-bold text-slate-800 text-sm">{customer.nombre_completo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Empresa:</span>
                <span className="font-semibold text-slate-700">{customer.empresa}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Saldo Actual:</span>
                <span className="font-bold text-emerald-600 text-sm">${customer.saldo.toFixed(2)} MXN</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Tarjeta Asociada:</span>
                <span className="font-mono text-slate-600">{customer.numero_tarjeta_mask}</span>
              </div>
            </>
          ) : (
            <div className="text-slate-500 italic py-2 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Número no registrado previamente en la base de datos. Se creará un nuevo contacto al atender.
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <X className="w-4 h-4 text-slate-500" /> Rechazar
          </button>

          <button
            onClick={() => onAccept(incomingCallerId)}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition"
          >
            <Check className="w-4 h-4" /> Atender y Desplegar Ficha
          </button>
        </div>
      </div>
    </div>
  );
}
