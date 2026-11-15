'use client';

import React, { useState } from 'react';
import { 
  Server, 
  Cpu, 
  Wifi, 
  CheckCircle2, 
  X, 
  AlertTriangle, 
  RefreshCw, 
  Save, 
  Globe, 
  ShieldCheck,
  Check,
  Radio
} from 'lucide-react';
import { VMConnectionConfig, getComputedUrls, saveVMConfig } from '@/lib/config';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: VMConnectionConfig;
  onUpdateConfig: (newConfig: VMConnectionConfig) => void;
}

export default function VMConnectionModal({ isOpen, onClose, config, onUpdateConfig }: Props) {
  const [localConfig, setLocalConfig] = useState<VMConnectionConfig>(config);
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'warning'>('idle');
  const [testResult, setTestResult] = useState<{ message: string; latency?: number } | null>(null);

  React.useEffect(() => {
    setLocalConfig(config);
    setTestingStatus('idle');
    setTestResult(null);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const computed = getComputedUrls(localConfig);

  const handleApplyPreset = (mode: 'localhost' | 'vm_ip', host: string) => {
    setLocalConfig(prev => ({
      ...prev,
      mode,
      vmHost: host
    }));
  };

  const handleTestConnection = async () => {
    setTestingStatus('testing');
    setTestResult(null);
    const start = performance.now();
    try {
      // Test de endpoint local de saldo y middleware
      const res = await fetch('/api/saldo?caller_id=1001', { method: 'GET' });
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        setTestingStatus('success');
        setTestResult({
          message: `Conectividad exitosa: API del CRM y Supabase respondiendo en ${latency} ms.`,
          latency
        });
      } else {
        setTestingStatus('warning');
        setTestResult({
          message: `Endpoint respondió con código ${res.status} en ${latency} ms. Verifique que los servicios de la VM estén activos.`,
          latency
        });
      }
    } catch (err: any) {
      setTestingStatus('warning');
      setTestResult({
        message: `Error de red: ${err.message || 'No se pudo contactar el host.'}`,
      });
    }
  };

  const handleSave = () => {
    saveVMConfig(localConfig);
    onUpdateConfig(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/40">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-tight text-white">Conexión de Máquina Virtual (VM) & Host</h3>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Modo VM Directo
                </span>
              </div>
              <p className="text-xs text-slate-400">Sin intermediación de Kubernetes • Conexión directa a IP / Localhost</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Aviso de entorno VM */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-blue-900">
            <Cpu className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Despliegue en Máquina Virtual Activo</span>
              <p className="text-blue-700 text-[11px] leading-relaxed">
                Arquitectura oficial: Asterisk 20 PBX (PJSIP) como central telefónica única y el IVR construido en Python, comunicándose 100% por API REST con Supabase y el CRM.
              </p>
            </div>
          </div>

          {/* Selector de Presets Rápidos */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Presets Rápidos de Conexión
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleApplyPreset('localhost', 'localhost')}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  localConfig.vmHost === 'localhost' || localConfig.vmHost === '127.0.0.1'
                    ? 'border-blue-600 bg-blue-50/70 shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Localhost (Misma máquina)</span>
                  {(localConfig.vmHost === 'localhost' || localConfig.vmHost === '127.0.0.1') && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-mono">127.0.0.1 / localhost</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('vm_ip', '192.168.216.1')}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  localConfig.vmHost === '192.168.216.1'
                    ? 'border-purple-600 bg-purple-50/70 shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Red VMware / VMnet8</span>
                  {localConfig.vmHost === '192.168.216.1' && (
                    <Check className="w-4 h-4 text-purple-600" />
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-mono">192.168.216.1 (Adaptador VM)</span>
              </button>
            </div>
          </div>

          {/* Input de Host / IP Personalizada */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Host o Dirección IP de la Máquina Virtual
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={localConfig.vmHost}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, vmHost: e.target.value.trim(), mode: 'custom' }))}
                placeholder="ej. localhost, 192.168.216.1, 192.168.8.61"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Puedes ingresar la IP asignada por tu hipervisor (VMware, VirtualBox o KVM).
            </p>
          </div>

          {/* Mapeo de Puertos de Servicios */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Puertos de Servicios en la VM
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-semibold">Middleware FastAPI</span>
                <span className="font-mono font-bold text-slate-800">Puerto {localConfig.middlewarePort}</span>
                <span className="text-[10px] text-slate-400 block truncate">{computed.middlewareUrl}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-semibold">Asterisk 20 (WebSockets WS)</span>
                <span className="font-mono font-bold text-slate-800">Puerto {localConfig.asteriskWsPort}</span>
                <span className="text-[10px] text-slate-400 block truncate">{computed.asteriskWsUrl}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-semibold">Asterisk SIP (UDP/TCP)</span>
                <span className="font-mono font-bold text-slate-800">Puerto {localConfig.asteriskSipPort}</span>
                <span className="text-[10px] text-slate-400 block truncate">{computed.asteriskSipAddress}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-semibold">Supabase REST API</span>
                <span className="font-mono font-bold text-slate-800">Puerto 443 (HTTPS)</span>
                <span className="text-[10px] text-slate-400 block truncate">PostgREST JSON Client</span>
              </div>
            </div>
          </div>

          {/* Estado de Test de Conexión */}
          {testResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              testingStatus === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              {testingStatus === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              )}
              <div>
                <p className="font-medium">{testResult.message}</p>
                {testResult.latency !== undefined && (
                  <span className="text-[10px] font-mono opacity-80">Latencia estimada: {testResult.latency}ms</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingStatus === 'testing'}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${testingStatus === 'testing' ? 'animate-spin' : ''}`} />
            {testingStatus === 'testing' ? 'Comprobando...' : 'Probar Conectividad'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm flex items-center gap-1.5 transition"
            >
              <Save className="w-3.5 h-3.5" /> Guardar y Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
