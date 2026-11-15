'use client';

import React, { useState } from 'react';
import { 
  Play, 
  GitBranch, 
  Database, 
  PhoneForwarded, 
  Volume2, 
  CheckCircle2, 
  Plus, 
  Save, 
  Settings2, 
  Layers, 
  Maximize2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Server,
  Terminal,
  Cpu,
  Stethoscope,
  Bot
} from 'lucide-react';

interface FlowNode {
  id: string;
  type: 'trigger' | 'audio' | 'decision' | 'database' | 'transfer';
  title: string;
  subtitle: string;
  x: number;
  y: number;
  status: 'active' | 'configured' | 'pending';
}

const INITIAL_NODES: FlowNode[] = [
  {
    id: 'node-1',
    type: 'trigger',
    title: 'Trigger: SIP INVITE Asterisk',
    subtitle: 'Captura canal PJSIP en VM + CallerID',
    x: 340,
    y: 40,
    status: 'active'
  },
  {
    id: 'node-2',
    type: 'audio',
    title: 'Mensaje de Bienvenida (Voz IA)',
    subtitle: '"Bienvenido... Marque 1: Saldo, 2: Cancelación, 3: Ventas, 4: Citas Médicas"',
    x: 340,
    y: 160,
    status: 'active'
  },
  {
    id: 'node-3',
    type: 'decision',
    title: 'Decision Engine (DTMF / Voz)',
    subtitle: 'Mapea opciones 1: Saldo, 2: Cancelación, 3: Ventas, 4: Citas Médicas IA',
    x: 340,
    y: 280,
    status: 'active'
  },
  {
    id: 'node-4',
    type: 'database',
    title: 'Validación Estatus Tarjeta (1 vs 2)',
    subtitle: 'Valida estatus: 1 (Activa entrega saldo) / 2 (Cancelada bloquea)',
    x: 100,
    y: 420,
    status: 'configured'
  },
  {
    id: 'node-5',
    type: 'database',
    title: 'Cancelación & Auditoría (Opción 2)',
    subtitle: 'UPDATE estatus = 2 + INSERT tarjetas_cancelaciones_log',
    x: 340,
    y: 420,
    status: 'configured'
  },
  {
    id: 'node-6',
    type: 'transfer',
    title: 'Transferir a PBX (SIP REFER)',
    subtitle: 'Desvía llamada a Cola de Agentes (Ext 2001)',
    x: 580,
    y: 420,
    status: 'configured'
  },
  {
    id: 'node-7',
    type: 'audio',
    title: 'TTS: Dictado o Aviso Bloqueo',
    subtitle: 'Estatus 1: Dicta saldo | Estatus 2: Informa cancelación y transfiere',
    x: 100,
    y: 540,
    status: 'active'
  },
  {
    id: 'node-8',
    type: 'decision',
    title: 'Opción 4: Citas Médicas (Gemini IA)',
    subtitle: 'Valida CallerID (antiguo vs nuevo), sugiere prevención y agenda en Calendario MCP',
    x: 820,
    y: 420,
    status: 'active'
  },
  {
    id: 'node-9',
    type: 'database',
    title: 'CBR Escalation & Memoria IA',
    subtitle: 'Auto-entrenamiento con resolución humana en Supabase cbr_casos',
    x: 820,
    y: 540,
    status: 'configured'
  }
];

export default function VisualIVRFlow() {
  const [nodes, setNodes] = useState<FlowNode[]>(INITIAL_NODES);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(INITIAL_NODES[2]);
  const [zoom, setZoom] = useState(100);
  const [isSaved, setIsSaved] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  const getNodeIcon = (type: FlowNode['type']) => {
    switch (type) {
      case 'trigger': return <Play className="w-4 h-4 text-emerald-400" />;
      case 'audio': return <Volume2 className="w-4 h-4 text-blue-400" />;
      case 'decision': return <GitBranch className="w-4 h-4 text-purple-400" />;
      case 'database': return <Database className="w-4 h-4 text-amber-400" />;
      case 'transfer': return <PhoneForwarded className="w-4 h-4 text-rose-400" />;
    }
  };

  const getNodeColor = (type: FlowNode['type']) => {
    switch (type) {
      case 'trigger': return 'border-emerald-500/50 bg-emerald-950/20';
      case 'audio': return 'border-blue-500/50 bg-blue-950/20';
      case 'decision': return 'border-purple-500/50 bg-purple-950/20';
      case 'database': return 'border-amber-500/50 bg-amber-950/20';
      case 'transfer': return 'border-rose-500/50 bg-rose-950/20';
    }
  };

  const handleSaveFlow = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleSimulateBranch = (branch: '1' | '2' | '3' | '4') => {
    setIsSimulating(true);
    setActiveStepId('node-1');
    setTimeout(() => {
      setActiveStepId('node-2');
      setTimeout(() => {
        setActiveStepId('node-3');
        setTimeout(() => {
          if (branch === '1') {
            setActiveStepId('node-4');
            setTimeout(() => {
              setActiveStepId('node-7');
              setTimeout(() => {
                setIsSimulating(false);
                setActiveStepId(null);
              }, 1200);
            }, 1000);
          } else if (branch === '2') {
            setActiveStepId('node-5');
            setTimeout(() => {
              setIsSimulating(false);
              setActiveStepId(null);
            }, 1500);
          } else if (branch === '3') {
            setActiveStepId('node-6');
            setTimeout(() => {
              setIsSimulating(false);
              setActiveStepId(null);
            }, 1500);
          } else {
            setActiveStepId('node-8');
            setTimeout(() => {
              setActiveStepId('node-9');
              setTimeout(() => {
                setIsSimulating(false);
                setActiveStepId(null);
              }, 1200);
            }, 1200);
          }
        }, 1000);
      }, 1000);
    }, 800);
  };

  return (
    <div className="bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[780px]">
      {/* Barra Superior Estilo Orchestrator de Telecomunicaciones */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-400">Orquestador Visual IVR</span>
              <span className="text-slate-600">/</span>
              <span className="text-xs font-bold text-white font-mono">ivr_core_workflow_v1.0</span>
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                VM Standalone • Sin Kubernetes
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Asterisk 20 LTS PBX + Middleware FastAPI + Supabase Cloud REST</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Botones de simulación de ramificaciones */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
            <span className="text-[10px] text-slate-400 uppercase font-bold px-2">Simular:</span>
            <button
              onClick={() => handleSimulateBranch('1')}
              disabled={isSimulating}
              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 font-bold rounded-lg border border-amber-500/30 transition disabled:opacity-40"
            >
              1. Saldo
            </button>
            <button
              onClick={() => handleSimulateBranch('2')}
              disabled={isSimulating}
              className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 font-bold rounded-lg border border-rose-500/30 transition disabled:opacity-40"
            >
              2. Cancelar
            </button>
            <button
              onClick={() => handleSimulateBranch('3')}
              disabled={isSimulating}
              className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 font-bold rounded-lg border border-blue-500/30 transition disabled:opacity-40"
            >
              3. Agente Ext. 2001
            </button>
            <button
              onClick={() => handleSimulateBranch('4')}
              disabled={isSimulating}
              className="px-2 py-1 bg-teal-500/20 hover:bg-teal-500/40 text-teal-300 font-bold rounded-lg border border-teal-500/30 transition disabled:opacity-40 flex items-center gap-1"
            >
              <Stethoscope className="w-3 h-3 text-teal-400" />
              <span>4. Citas IA</span>
            </button>
          </div>

          <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700 text-xs">
            <button onClick={() => setZoom(z => Math.max(z - 10, 60))} className="p-1 hover:text-white text-slate-400">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-300">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(z + 10, 140))} className="p-1 hover:text-white text-slate-400">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleSaveFlow}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              isSaved 
                ? 'bg-emerald-600 text-white' 
                : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/30'
            }`}
          >
            {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {isSaved ? 'Flujo Desplegado en VM' : 'Guardar y Publicar'}
          </button>
        </div>
      </div>

      {/* Área Central: Canvas + Panel Lateral de Configuración de Nodo */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas de Diseño de Nodos */}
        <div 
          className="flex-1 relative bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px] bg-slate-950 overflow-auto p-8"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
        >
          {/* Líneas de Conexión SVG (Cables de Flujo) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: 900, minHeight: 700 }}>
            {/* Trigger -> Audio Bienvenida */}
            <path d="M 460 90 L 460 160" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 4" fill="none" />
            {/* Audio Bienvenida -> Decision */}
            <path d="M 460 210 L 460 280" stroke="#6366f1" strokeWidth="2" fill="none" />
            {/* Decision -> Opción 1 (Base de Datos Saldo) */}
            <path d="M 400 330 C 400 380, 220 370, 220 420" stroke="#a855f7" strokeWidth="2" fill="none" />
            {/* Decision -> Opción 2 (Cancelación) */}
            <path d="M 460 330 L 460 420" stroke="#a855f7" strokeWidth="2" fill="none" />
            {/* Decision -> Opción 3 (Ventas / Transfer PBX) */}
            <path d="M 520 330 C 520 380, 700 370, 700 420" stroke="#a855f7" strokeWidth="2" fill="none" />
            {/* Decision -> Opción 4 (Citas Médicas Gemini IA) */}
            <path d="M 560 330 C 560 380, 940 370, 940 420" stroke="#14b8a6" strokeWidth="2" fill="none" />
            {/* Opción 4 -> CBR Escalation & Memoria IA */}
            <path d="M 940 470 L 940 540" stroke="#14b8a6" strokeWidth="2" strokeDasharray="4 4" fill="none" />
            {/* Base de Datos Saldo -> Dictado TTS */}
            <path d="M 220 470 L 220 540" stroke="#f59e0b" strokeWidth="2" fill="none" />
          </svg>

          {/* Renderizado de Bloques / Nodos Visuales */}
          {nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const isStepActive = activeStepId === node.id;

            return (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className={`absolute w-64 p-3.5 rounded-2xl border cursor-pointer transition-all shadow-lg backdrop-blur-md ${getNodeColor(node.type)} ${
                  isStepActive 
                    ? 'ring-4 ring-emerald-400 border-emerald-400 scale-110 z-30 shadow-emerald-500/30'
                    : isSelected 
                      ? 'ring-2 ring-purple-400 border-purple-400 scale-105 z-20' 
                      : 'hover:border-slate-500 z-10'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {getNodeIcon(node.type)}
                    <span className="text-xs font-bold text-white tracking-wide">{node.title}</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${isStepActive ? 'bg-emerald-300 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
                </div>
                <p className="text-[11px] text-slate-400 font-mono line-clamp-2 mt-1">
                  {node.subtitle}
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="uppercase tracking-wider font-semibold">{node.type}</span>
                  <span className="text-slate-400 font-mono">ID: {node.id}</span>
                </div>
              </div>
            );
          })}

          {/* Minimapa Inferior Derecho */}
          <div className="absolute bottom-6 right-6 w-44 h-32 bg-slate-900/90 border border-slate-700 rounded-xl p-2.5 flex flex-col justify-between pointer-events-none shadow-xl">
            <span className="text-[9px] font-bold uppercase text-slate-400">Minimapa de Flujo VM</span>
            <div className="w-full h-20 bg-slate-950 rounded-lg border border-slate-800 relative">
              <div className="absolute top-2 left-12 w-16 h-2 bg-purple-500/40 rounded" />
              <div className="absolute top-6 left-12 w-16 h-2 bg-purple-500/40 rounded" />
              <div className="absolute top-10 left-4 w-10 h-2 bg-amber-500/40 rounded" />
              <div className="absolute top-10 left-16 w-10 h-2 bg-blue-500/40 rounded" />
              <div className="absolute top-10 left-28 w-10 h-2 bg-rose-500/40 rounded" />
            </div>
            <span className="text-[8px] text-slate-500 text-right">7 nodos activos en VM</span>
          </div>
        </div>

        {/* Panel Lateral: Propiedades del Nodo Seleccionado */}
        {selectedNode && (
          <div className="w-80 bg-slate-900 border-l border-slate-800 p-5 flex flex-col justify-between z-30">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-purple-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Configuración de Nodo</h4>
                </div>
                <span className="text-[10px] bg-slate-800 text-purple-300 font-mono px-2 py-0.5 rounded">
                  {selectedNode.type}
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Título del Bloque</label>
                <input
                  type="text"
                  value={selectedNode.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedNode(prev => prev ? ({ ...prev, title: val }) : null);
                    setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, title: val } : n));
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Instrucción / Acción</label>
                <textarea
                  value={selectedNode.subtitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedNode(prev => prev ? ({ ...prev, subtitle: val }) : null);
                    setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, subtitle: val } : n));
                  }}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {selectedNode.type === 'decision' && (
                <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl space-y-2 text-xs">
                  <span className="font-bold text-purple-300 block">Ramificaciones Habilitadas:</span>
                  <div className="space-y-1 font-mono text-[11px] text-slate-300">
                    <div className="flex items-center gap-1.5"><span className="text-purple-400 font-bold">• 1 / "Saldo":</span> Ir a Base de Datos (/api/saldo)</div>
                    <div className="flex items-center gap-1.5"><span className="text-purple-400 font-bold">• 2 / "Cancelar":</span> Ir a Cancelación (/api/cancelacion)</div>
                    <div className="flex items-center gap-1.5"><span className="text-purple-400 font-bold">• 3 / "Ventas":</span> Transferir a Agente (Ext 2001)</div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'database' && (
                <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl space-y-2 text-xs">
                  <span className="font-bold text-amber-300 block">Conexión a Datos:</span>
                  <p className="text-[11px] text-slate-300">
                    El nodo ejecuta la consulta directamente en la base de datos de Supabase utilizando el <strong className="text-white">CallerID</strong> o los dígitos DTMF de la tarjeta.
                  </p>
                </div>
              )}

              {selectedNode.type === 'transfer' && (
                <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl space-y-2 text-xs">
                  <span className="font-bold text-rose-300 block">Interacción con Asterisk:</span>
                  <p className="text-[11px] text-slate-300">
                    Envía el comando SIP <code className="text-rose-400">REFER</code> o la orden ARI al PBX para transferir la llamada activa al agente en la extensión 2001.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Sincronizado con la Máquina Virtual en tiempo real</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
