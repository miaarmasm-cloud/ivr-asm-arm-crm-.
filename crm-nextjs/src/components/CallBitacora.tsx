'use client';

import React, { useState } from 'react';
import { CallLog } from '@/lib/types';
import { FileText, PhoneIncoming, PhoneOutgoing, Clock, Plus, Bot, User, CheckCircle2 } from 'lucide-react';

interface Props {
  logs: CallLog[];
  callerId: string;
  onAddNote: (note: string) => void;
}

export default function CallBitacora({ logs, callerId, onAddNote }: Props) {
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const filteredLogs = logs.filter(l => l.caller_id === callerId);

  const handleSubmitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    onAddNote(newNote.trim());
    setNewNote('');
    setIsAdding(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" /> Bitácora de Llamadas e Indicaciones
        </h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
        >
          <Plus className="w-4 h-4" /> Agregar Anotación
        </button>
      </div>

      {/* Formulario de nueva anotación */}
      {isAdding && (
        <form onSubmit={handleSubmitNote} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-2">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Escriba las anotaciones, acuerdos o indicaciones de la llamada..."
            className="w-full text-xs p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-sm"
            >
              Guardar en Bitácora
            </button>
          </div>
        </form>
      )}

      {/* Lista de Registros */}
      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <div key={log.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 font-bold ${
                  log.tipo === 'entrante' ? 'text-emerald-700' : 'text-blue-700'
                }`}>
                  {log.tipo === 'entrante' ? (
                    <PhoneIncoming className="w-3.5 h-3.5" />
                  ) : (
                    <PhoneOutgoing className="w-3.5 h-3.5" />
                  )}
                  Llamada {log.tipo.toUpperCase()}
                </span>
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {new Date(log.fecha_hora).toLocaleString()}
                </span>
              </div>

              {log.opcion_ivr_seleccionada && (
                <div className="text-slate-600">
                  <span className="font-semibold text-slate-700">Flujo IVR:</span> {log.opcion_ivr_seleccionada}
                </div>
              )}

              {log.resumen_ia && (
                <div className="bg-blue-50/70 p-2 rounded border border-blue-100 text-blue-900 flex items-start gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold">Resumen IA:</span> {log.resumen_ia}
                  </div>
                </div>
              )}

              {log.notas_agente && (
                <div className="text-slate-700 flex items-start gap-1.5 pt-1 border-t border-slate-200">
                  <User className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold">Notas del Agente:</span> {log.notas_agente}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-400 italic py-4 text-center">
            No hay llamadas registradas en la bitácora para este CallerID.
          </p>
        )}
      </div>
    </div>
  );
}
