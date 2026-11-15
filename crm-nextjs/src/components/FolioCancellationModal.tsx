'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Tag, 
  Copy, 
  Check, 
  AlertCircle, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  User, 
  Phone, 
  Clock, 
  ShieldAlert, 
  FileCheck,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { CancelacionLog, Customer } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomerByCallerId: (callerId: string) => void;
}

export default function FolioCancellationModal({ isOpen, onClose, onSelectCustomerByCallerId }: Props) {
  const [folioQuery, setFolioQuery] = useState('');
  const [logs, setLogs] = useState<CancelacionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedFolio, setCopiedFolio] = useState<string | null>(null);

  const fetchLogs = async (query = '') => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const url = query.trim() 
        ? `/api/cancelacion?folio=${encodeURIComponent(query.trim())}`
        : '/api/cancelacion';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(data.logs || []);
      } else {
        setErrorMsg(data.error || 'No se pudieron recuperar los registros');
      }
    } catch (err: any) {
      setErrorMsg(`Error de conexión: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs(folioQuery);
    }
  }, [isOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(folioQuery);
  };

  const handleCopy = (folio: string) => {
    navigator.clipboard.writeText(folio);
    setCopiedFolio(folio);
    setTimeout(() => setCopiedFolio(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabecera del Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white p-5 flex items-center justify-between border-b border-rose-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/30 border border-rose-500/50 rounded-xl text-rose-300">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight text-white">
                  Módulo de Consulta de Folios de Cancelación
                </h3>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  Supabase Live
                </span>
              </div>
              <p className="text-xs text-rose-200/70 mt-0.5">
                Nomenclatura oficial: <code className="bg-rose-950/80 px-1 py-0.5 rounded text-rose-300 font-mono">YYYY-MM-DD-XXXX-YYYY</code> (Fecha-Tarjeta-CallerID)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Búsqueda y Filtros */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={folioQuery}
                onChange={(e) => setFolioQuery(e.target.value)}
                placeholder="Buscar por Folio (ej. 2026-11-14-8821-1001), CallerID o terminación..."
                className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 placeholder:text-slate-400 font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Consultar</span>
            </button>
            <button
              type="button"
              onClick={() => { setFolioQuery(''); fetchLogs(''); }}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition"
              title="Restablecer búsqueda"
            >
              Ver Todos
            </button>
          </form>
        </div>

        {/* Lista de Registros de Cancelación */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
              <span>Consultando registros de auditoría en Supabase...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl">
              <ShieldAlert className="w-8 h-8 text-slate-300" />
              <p className="font-semibold text-slate-600">No se encontraron folios de cancelación</p>
              <p className="text-[11px] text-slate-400">
                Verifique el folio ingresado o realice una prueba marcando la Opción 2 en el IVR Asterisk.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const isCopied = copiedFolio === log.folio_cancelacion;
              return (
                <div 
                  key={log.id} 
                  className="p-4 rounded-xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-rose-50/20 transition shadow-sm space-y-3"
                >
                  {/* Fila Superior: Folio y Acciones */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-rose-100 text-rose-800 rounded-lg">
                        <Tag className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Folio Oficial de Cancelación
                        </span>
                        <span className="font-mono font-extrabold text-sm text-rose-950 tracking-wider">
                          {log.folio_cancelacion}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopy(log.folio_cancelacion)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition"
                        title="Copiar folio al portapapeles"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? '¡Copiado!' : 'Copiar'}</span>
                      </button>

                      {log.caller_id && (
                        <button
                          onClick={() => {
                            onSelectCustomerByCallerId(log.caller_id);
                            onClose();
                          }}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition shadow-sm"
                          title="Cargar expediente en el CRM"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Ver Ficha CRM</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grid de Metadatos */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">CallerID:</span>
                      <span className="font-mono font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-blue-500" /> {log.caller_id}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Tarjeta:</span>
                      <span className="font-mono font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                        <CreditCard className="w-3 h-3 text-emerald-500" /> {log.numero_tarjeta_mask}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Saldo Resguardado:</span>
                      <span className="font-mono font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                        <DollarSign className="w-3 h-3" /> ${(log.saldo_al_momento || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Canal / Origen:</span>
                      <span className="font-bold text-slate-700 text-[11px] mt-0.5 block">
                        {log.canal || 'IVR_OPCION_2'}
                      </span>
                    </div>
                  </div>

                  {/* Fila Inferior: Motivo y Fecha */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg flex-wrap gap-2">
                    <span className="italic">
                      <span className="font-semibold text-slate-700">Motivo:</span> {log.motivo || 'Cancelación solicitada por cliente'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(log.created_at).toLocaleString('es-MX')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Total de registros mostrados: {logs.length}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
