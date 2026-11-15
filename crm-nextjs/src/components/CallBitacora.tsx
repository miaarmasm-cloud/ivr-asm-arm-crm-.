'use client';

import React, { useState } from 'react';
import { CallLog } from '@/lib/types';
import { 
  FileText, 
  PhoneIncoming, 
  PhoneOutgoing, 
  Clock, 
  Plus, 
  Bot, 
  User, 
  CheckCircle2, 
  Play, 
  Pause, 
  Copy, 
  Search, 
  Tag, 
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Download
} from 'lucide-react';

interface Props {
  logs: CallLog[];
  callerId: string;
  onAddNote: (note: string) => void;
}

export default function CallBitacora({ logs, callerId, onAddNote }: Props) {
  const [newNote, setNewNote] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [filterType, setFilterType] = useState<'todos' | 'entrante' | 'saliente'>('todos');
  const [searchFilter, setSearchFilter] = useState('');
  const [playingLogId, setPlayingLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredLogs = logs
    .filter(l => !callerId || l.caller_id === callerId)
    .filter(l => filterType === 'todos' || l.tipo === filterType)
    .filter(l => {
      if (!searchFilter) return true;
      const term = searchFilter.toLowerCase();
      return (
        (l.resumen_ia && l.resumen_ia.toLowerCase().includes(term)) ||
        (l.notas_agente && l.notas_agente.toLowerCase().includes(term)) ||
        (l.opcion_ivr_seleccionada && l.opcion_ivr_seleccionada.toLowerCase().includes(term))
      );
    });

  const handleSubmitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const finalNote = selectedTag ? `[${selectedTag}] ${newNote.trim()}` : newNote.trim();
    onAddNote(finalNote);
    setNewNote('');
    setSelectedTag('');
    setIsAdding(false);
  };

  const handleCopySummary = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePlayAudio = (id: string) => {
    if (playingLogId === id) {
      setPlayingLogId(null);
    } else {
      setPlayingLogId(id);
    }
  };

  const quickTags = ['Consulta de Saldo', 'Aclaración de Pedido', 'Retención', 'Promesa de Pago', 'Soporte Técnico'];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col gap-4">
      {/* Cabecera de la Bitácora */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Bitácora Telefónica & Asistente IA
            </h3>
            <span className="text-[11px] text-slate-400">
              {filteredLogs.length} {filteredLogs.length === 1 ? 'registro' : 'registros'} para este contacto
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-xs flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl shadow-sm transition active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar Nota
        </button>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
          <button
            onClick={() => setFilterType('todos')}
            className={`px-2.5 py-1 rounded-md transition ${filterType === 'todos' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType('entrante')}
            className={`px-2.5 py-1 rounded-md transition ${filterType === 'entrante' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Entrantes IVR
          </button>
          <button
            onClick={() => setFilterType('saliente')}
            className={`px-2.5 py-1 rounded-md transition ${filterType === 'saliente' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Salientes Agente
          </button>
        </div>

        <div className="relative w-44">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filtrar notas..."
            className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg pl-8 pr-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Formulario de Nueva Anotación con Etiquetas Rápidas */}
      {isAdding && (
        <form onSubmit={handleSubmitNote} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-2.5 animate-in fade-in">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Etiqueta:
            </span>
            {quickTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition ${
                  selectedTag === tag
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Escriba las anotaciones, acuerdos o indicaciones de la llamada..."
            className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-800"
            rows={2}
            autoFocus
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setSelectedTag(''); }}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
            >
              Guardar Nota
            </button>
          </div>
        </form>
      )}

      {/* Lista de Registros */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => {
            const isPlaying = playingLogId === log.id;
            const isCancelation = log.opcion_ivr_seleccionada?.includes('Cancelación') || log.resumen_ia?.includes('cancelación');

            return (
              <div 
                key={log.id} 
                className={`p-3.5 rounded-xl border text-xs space-y-2.5 transition ${
                  isCancelation
                    ? 'bg-rose-50/40 border-rose-200'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {/* Cabecera del Registro */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 font-bold text-xs ${
                    log.tipo === 'entrante' ? 'text-emerald-700' : 'text-blue-700'
                  }`}>
                    {log.tipo === 'entrante' ? (
                      <span className="p-1 bg-emerald-100 rounded-md"><PhoneIncoming className="w-3 h-3 text-emerald-700" /></span>
                    ) : (
                      <span className="p-1 bg-blue-100 rounded-md"><PhoneOutgoing className="w-3 h-3 text-blue-700" /></span>
                    )}
                    Llamada {log.tipo.toUpperCase()}
                  </span>

                  <span className="text-slate-400 text-[11px] flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" /> {new Date(log.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                {/* Opción IVR Asterisk seleccionada */}
                {log.opcion_ivr_seleccionada && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500">IVR PBX:</span>
                    <span className="bg-slate-200/80 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded font-mono">
                      {log.opcion_ivr_seleccionada}
                    </span>
                  </div>
                )}

                {/* Resumen IA */}
                {log.resumen_ia && (
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-slate-700 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-700">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Resumen Asistente IA</span>
                      </div>
                      <button
                        onClick={() => handleCopySummary(log.resumen_ia!, log.id)}
                        className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedId === log.id ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      {log.resumen_ia}
                    </p>
                  </div>
                )}

                {/* Notas agregadas por el agente humano */}
                {log.notas_agente && (
                  <div className="text-[11px] text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-200/60">
                    <span className="font-bold text-slate-700">Nota del Agente:</span> {log.notas_agente}
                  </div>
                )}

                {/* Reproductor de audio real de grabación PBX con línea de tiempo y exportar */}
                <div className="pt-2 flex flex-col gap-1.5 border-t border-slate-200/60">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <button
                      onClick={() => togglePlayAudio(log.id)}
                      className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-bold"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-500" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>{isPlaying ? 'Pausar Grabación' : 'Escuchar Grabación PBX'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400">{log.duracion_segundos}s</span>
                      <a
                        href={`/api/recordings?id=${log.id}&download=true&duration=${log.duracion_segundos || 30}`}
                        download={`rec_${log.id.slice(0, 8)}.wav`}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-emerald-700 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded border border-slate-200 hover:border-emerald-300 transition"
                        title="Descargar audio .wav a cualquier ruta local"
                      >
                        <Download className="w-3 h-3" />
                        <span>Exportar .wav</span>
                      </a>
                    </div>
                  </div>

                  {isPlaying && (
                    <div className="bg-slate-900 text-white p-2.5 rounded-xl flex items-center gap-3 animate-in fade-in">
                      <audio
                        autoPlay
                        src={`/api/recordings?id=${log.id}&duration=${log.duracion_segundos || 30}`}
                        onEnded={() => setPlayingLogId(null)}
                      />
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 w-full animate-pulse" />
                      </div>
                      <span className="text-[10px] font-mono text-emerald-300">rec_{log.id.slice(0, 8)}.wav</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-slate-400 text-xs italic">
            No hay registros que coincidan con los filtros actuales.
          </div>
        )}
      </div>
    </div>
  );
}
