'use client';

import React, { useState } from 'react';
import { 
  Server, 
  Activity, 
  PhoneCall, 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Play, 
  ArrowRight, 
  Database, 
  Globe, 
  Cpu, 
  Terminal,
  Volume2
} from 'lucide-react';
import { getVMConfig, getComputedUrls } from '@/lib/config';

export default function TelephonyMonitor() {
  const [vmConfig, setVmConfig] = useState(getVMConfig());
  const [testCallerId, setTestCallerId] = useState('1001');
  const [testCard, setTestCard] = useState('8821');
  const [apiOutput, setApiOutput] = useState<any>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [activeApiTest, setActiveApiTest] = useState<'saldo' | 'cancelacion' | 'outbound' | null>(null);

  const computed = getComputedUrls(vmConfig);

  const handleTestSaldo = async () => {
    setIsLoadingApi(true);
    setActiveApiTest('saldo');
    setApiOutput(null);
    try {
      const res = await fetch(`/api/saldo?caller_id=${encodeURIComponent(testCallerId)}`);
      const data = await res.json();
      setApiOutput({ status: res.status, endpoint: '/api/saldo', data });
    } catch (e: any) {
      setApiOutput({ error: e.message });
    } finally {
      setIsLoadingApi(false);
    }
  };

  const handleTestCancelacion = async () => {
    setIsLoadingApi(true);
    setActiveApiTest('cancelacion');
    setApiOutput(null);
    try {
      const res = await fetch('/api/cancelacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caller_id: testCallerId, tarjeta: testCard, motivo: 'Prueba desde Monitor Telefónico VM' })
      });
      const data = await res.json();
      setApiOutput({ status: res.status, endpoint: '/api/cancelacion', data });
    } catch (e: any) {
      setApiOutput({ error: e.message });
    } finally {
      setIsLoadingApi(false);
    }
  };

  const handleTestOutbound = async () => {
    setIsLoadingApi(true);
    setActiveApiTest('outbound');
    setApiOutput(null);
    try {
      const res = await fetch('/api/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: testCallerId, agentExtension: '2001' })
      });
      const data = await res.json();
      setApiOutput({ status: res.status, endpoint: '/api/outbound', data });
    } catch (e: any) {
      setApiOutput({ error: e.message });
    } finally {
      setIsLoadingApi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Entorno VM Standalone */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/30 text-blue-400 rounded-2xl border border-blue-500/30">
            <Server className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Monitor Telefónico de Máquina Virtual (VM)</h2>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Sin Kubernetes • Standalone VM
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Host de la VM: <span className="font-mono text-emerald-400 font-bold">{vmConfig.vmHost}</span> • PBX Asterisk 20 + Middleware FastAPI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 block text-[10px]">Ext. 1001 (Cliente)</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> PJSIP Registrada
            </span>
          </div>

          <div className="bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 block text-[10px]">Ext. 2001 (Agente CRM)</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> WebRTC Activa
            </span>
          </div>
        </div>
      </div>

      {/* Grid de Estado de los 4 Servicios Centrales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Servicio 1: Asterisk PBX SIP */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Telefonía Base</span>
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Puerto 5060
            </span>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Asterisk 20 LTS PBX</h4>
            <p className="text-xs text-slate-500 mt-0.5">SIP Switch & Canales PJSIP directos en la VM</p>
          </div>
          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 truncate">
            {computed.asteriskSipAddress} (UDP/TCP)
          </div>
        </div>

        {/* Servicio 2: Asterisk WebRTC WS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">WebSockets CRM</span>
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Puerto 8088
            </span>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">WebRTC Gateway</h4>
            <p className="text-xs text-slate-500 mt-0.5">Enlace en tiempo real para el softphone del navegador</p>
          </div>
          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 truncate">
            {computed.asteriskWsUrl}
          </div>
        </div>

        {/* Servicio 3: Middleware FastAPI */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Lógica IVR & REST</span>
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Puerto 8000
            </span>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Middleware FastAPI</h4>
            <p className="text-xs text-slate-500 mt-0.5">Orquestación de llamadas, AGI REST y ElevenLabs AI</p>
          </div>
          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 truncate">
            {computed.middlewareUrl}
          </div>
        </div>

        {/* Servicio 4: Supabase Cloud Database */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Base de Datos</span>
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Realtime OK
            </span>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Supabase PostgREST</h4>
            <p className="text-xs text-slate-500 mt-0.5">Almacenamiento de clientes, bitácora y pedidos</p>
          </div>
          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 truncate">
            xlmrmdxtrdomtrmnczwh.supabase.co
          </div>
        </div>
      </div>

      {/* Banco de Pruebas Interactivo de Telefonía e IVR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Terminal className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Simulador de Pruebas IVR & API</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                CallerID de Prueba (Extensión o Teléfono)
              </label>
              <input
                type="text"
                value={testCallerId}
                onChange={(e) => setTestCallerId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Últimos 4 Dígitos de Tarjeta (DTMF)
              </label>
              <input
                type="text"
                value={testCard}
                onChange={(e) => setTestCard(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={handleTestSaldo}
                disabled={isLoadingApi}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-98 disabled:opacity-50"
              >
                <Database className="w-4 h-4" /> Probar Opción 1: Consulta Saldo (/api/saldo)
              </button>

              <button
                onClick={handleTestCancelacion}
                disabled={isLoadingApi}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-98 disabled:opacity-50"
              >
                <AlertTriangle className="w-4 h-4" /> Probar Opción 2: Cancelación (/api/cancelacion)
              </button>

              <button
                onClick={handleTestOutbound}
                disabled={isLoadingApi}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-98 disabled:opacity-50"
              >
                <PhoneCall className="w-4 h-4" /> Probar Llamada Saliente (/api/outbound)
              </button>
            </div>
          </div>
        </div>

        {/* Consola de Resultados JSON */}
        <div className="lg:col-span-7 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between text-white font-mono text-xs min-h-[360px]">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-300">Respuesta de la API del CRM / VM</span>
              </div>
              {isLoadingApi && (
                <span className="text-emerald-400 flex items-center gap-1.5 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Procesando petición...
                </span>
              )}
            </div>

            {apiOutput ? (
              <pre className="bg-slate-900 p-4 rounded-xl text-emerald-400 overflow-x-auto text-[11px] leading-relaxed max-h-[300px]">
                {JSON.stringify(apiOutput, null, 2)}
              </pre>
            ) : (
              <div className="py-16 text-center text-slate-500 italic">
                Presione uno de los botones de prueba para ejecutar una consulta contra la API y visualizar los datos en vivo.
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 pt-3 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Asterisk AGI REST + ElevenLabs Voice Engine</span>
            <span className="text-emerald-400">VM Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
