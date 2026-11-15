'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Megaphone, 
  PhoneCall, 
  ShieldCheck, 
  Stethoscope, 
  TrendingUp, 
  CreditCard, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  ArrowRight, 
  Dna, 
  FileAudio, 
  Tag, 
  Plus, 
  RefreshCw,
  Sparkles,
  PhoneForwarded,
  Filter,
  Check,
  Play,
  Pause,
  Download,
  Edit3,
  Trash2,
  Save,
  X,
  Volume2,
  Settings2,
  SlidersHorizontal,
  AlertCircle,
  Phone,
  Lock,
  UserPlus,
  UserCheck,
  User,
  Info,
  History,
  Power,
  ShieldAlert,
  PhoneOutgoing,
  Key,
  Copy
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export interface AgentAssignmentHistory {
  nombre_anterior: string;
  fecha_cambio: string;
}

export interface AgentExtension {
  extension: string;
  nombre: string;
  password?: string;
  activo?: boolean;
  historial_asignaciones?: AgentAssignmentHistory[];
}

export interface Campaign {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string;
  did_campana: string;
  cabecera_ivr: string;
  cabecera_pstn: string[];
  opciones_permitidas: string[];
  extension_agente: string;
  dids_asociados: string[];
  agentes_extensiones?: AgentExtension[];
  enrutamiento_directo: string | null;
  activo: boolean;
  created_at?: string;
}

const DEFAULT_CAMPAIGNS: Campaign[] = [
  {
    id: 'c-1',
    nombre: 'Consulta de Saldo & Servicios',
    slug: 'atencion_clientes',
    descripcion: 'Campaña general de atención y saldo financiero. Enrutada al DID Virtual 1000.',
    did_campana: '1000',
    cabecera_ivr: '8000',
    cabecera_pstn: ['8009990000', '5550001000'],
    opciones_permitidas: ['1'],
    extension_agente: '1001',
    dids_asociados: ['1001', '1002'],
    agentes_extensiones: [
      { extension: '1001', nombre: 'Agente Finanzas 1 (Juan Pérez)', activo: true },
      { extension: '1002', nombre: 'Agente Finanzas 2 (Laura Soto)', activo: true }
    ],
    enrutamiento_directo: '1',
    activo: true
  },
  {
    id: 'c-2',
    nombre: 'Retención y Cancelaciones ARM',
    slug: 'cancelaciones',
    descripcion: 'Campaña especializada en retención y trámite de cancelación de tarjetas. Enrutada al DID Virtual 2000.',
    did_campana: '2000',
    cabecera_ivr: '8000',
    cabecera_pstn: ['8009990000', '5550001000'],
    opciones_permitidas: ['2'],
    extension_agente: '2001',
    dids_asociados: ['2001', '2002'],
    agentes_extensiones: [
      { extension: '2001', nombre: 'Agente Retención 1 (Carlos Mendoza)', activo: true },
      { extension: '2002', nombre: 'Agente Retención 2 (Mariana Gómez)', activo: true }
    ],
    enrutamiento_directo: '2',
    activo: true
  },
  {
    id: 'c-3',
    nombre: 'Ventas y Nuevos Contratos',
    slug: 'ventas',
    descripcion: 'Campaña comercial. Asesores especializados en nuevas contrataciones. Enrutada al DID Virtual 3000.',
    did_campana: '3000',
    cabecera_ivr: '8000',
    cabecera_pstn: ['8009990000', '5550001000'],
    opciones_permitidas: ['3'],
    extension_agente: '3001',
    dids_asociados: ['3001', '3002'],
    agentes_extensiones: [
      { extension: '3001', nombre: 'Asesor Comercial 1 (Roberto Silva)', activo: true },
      { extension: '3002', nombre: 'Asesora Comercial 2 (Elena Morales)', activo: true }
    ],
    enrutamiento_directo: '3',
    activo: true
  },
  {
    id: 'c-4',
    nombre: 'Doctores & Consultas Médicas IA',
    slug: 'doctores',
    descripcion: 'Campaña médica exclusiva. Citas presenciales, telemedicina y agenda médica IA. Enrutada al DID Virtual 4000.',
    did_campana: '4000',
    cabecera_ivr: '8000',
    cabecera_pstn: ['8009990000', '5550001000'],
    opciones_permitidas: ['4'],
    extension_agente: '4001',
    dids_asociados: ['4001', '4002', '4003'],
    agentes_extensiones: [
      { extension: '4001', nombre: 'Dr. Carlos Méndez - Medicina General', activo: true },
      { extension: '4002', nombre: 'Dra. Sofía Reyes - Cardiología', activo: true },
      { extension: '4003', nombre: 'Dr. Roberto Gómez - Pediatría', activo: true }
    ],
    enrutamiento_directo: '4',
    activo: true
  }
];

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Componente Celda de Audio con Play, Pausa, Línea de Tiempo interactiva y Exportar/Descargar
 */
interface AudioPlayerCellProps {
  logId: string;
  durationSeconds?: number;
  activePlayingId: string | null;
  onTogglePlay: (id: string | null) => void;
}

function AudioPlayerCell({ logId, durationSeconds = 30, activePlayingId, onTogglePlay }: AudioPlayerCellProps) {
  const isPlaying = activePlayingId === logId;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(durationSeconds > 0 ? durationSeconds : 30);

  const audioSrc = `/api/recordings?id=${logId}&duration=${totalDuration}`;
  const downloadUrl = `/api/recordings?id=${logId}&download=true&duration=${totalDuration}`;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch((err) => {
        console.warn('Reproducción de audio pausada por el navegador:', err);
        onTogglePlay(null);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, onTogglePlay]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
      setTotalDuration(Math.round(audioRef.current.duration));
    }
  };

  const handleEnded = () => {
    setCurrentTime(0);
    onTogglePlay(null);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 bg-slate-50/90 hover:bg-slate-100/90 border border-slate-200/90 rounded-xl px-2.5 py-1.5 transition min-w-[280px]">
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Botón Reproducir / Pausar */}
      <button
        onClick={() => onTogglePlay(isPlaying ? null : logId)}
        className={`p-1.5 rounded-lg flex items-center justify-center transition active:scale-95 shadow-sm ${
          isPlaying
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
        title={isPlaying ? 'Pausar audio' : 'Reproducir grabación .wav'}
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
      </button>

      {/* Línea de Tiempo y Tiempos */}
      <div className="flex-1 flex flex-col justify-center gap-0.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 font-bold">
          <span className="text-blue-700">{formatAudioTime(currentTime)}</span>
          <span className="text-slate-400">/ {formatAudioTime(totalDuration)}</span>
        </div>
        
        {/* Slider Scrubber de la Línea de Tiempo */}
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            style={{
              background: `linear-gradient(to right, #2563eb ${progressPercent}%, #e2e8f0 ${progressPercent}%)`
            }}
          />
        </div>
      </div>

      {/* Botón Descargar / Exportar Audio */}
      <a
        href={downloadUrl}
        download={`rec_${logId.slice(0, 8)}.wav`}
        className="p-1.5 rounded-lg bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 transition flex items-center gap-1 shadow-xs group"
        title="Descargar / Exportar archivo .wav para guardarlo en cualquier ruta local"
      >
        <Download className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-bold hidden sm:inline">Exportar</span>
      </a>
    </div>
  );
}

interface Props {
  onTestDialNumber?: (did: string) => void;
}

export default function CampaignsManager({ onTestDialNumber }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(DEFAULT_CAMPAIGNS);
  const [loading, setLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign>(DEFAULT_CAMPAIGNS[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);

  // Estados para Modal de Administración de Extensiones y Agentes
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [newExtInput, setNewExtInput] = useState('');
  const [newAgentNameInput, setNewAgentNameInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [editingExtIndex, setEditingExtIndex] = useState<number | null>(null);
  const [editingExtName, setEditingExtName] = useState('');
  const [deleteWarningMsg, setDeleteWarningMsg] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Cargar campañas y bitácora homologada desde Supabase
  const loadData = async () => {
    setLoading(true);
    if (isSupabaseConfigured()) {
      try {
        const { data: dbExts } = await supabase
          .from('extensiones')
          .select('*')
          .order('extension', { ascending: true });

        const { data: dbCamp } = await supabase
          .from('campanas')
          .select('*')
          .order('did_campana', { ascending: true });

        if (dbCamp && dbCamp.length > 0) {
          const normalized = dbCamp.map((c: any) => {
            const matchedExts = (dbExts || []).filter((e: any) => e.campana_slug === c.slug);
            let ags: AgentExtension[] = [];

            if (matchedExts.length > 0) {
              ags = matchedExts.map((e: any) => ({
                extension: e.extension,
                nombre: e.nombre_agente,
                password: e.password,
                activo: e.activo !== false,
                historial_asignaciones: e.historial_nombres || []
              }));
            } else if (c.agentes_extensiones && c.agentes_extensiones.length > 0) {
              ags = c.agentes_extensiones;
            } else {
              ags = (c.dids_asociados || []).map((d: string) => ({
                extension: d,
                nombre: `Agente Ext. ${d}`,
                password: `ARMpass${d}!`,
                activo: true
              }));
            }

            return {
              ...c,
              did_campana: c.did_campana || (c.slug === 'doctores' ? '4000' : c.slug === 'ventas' ? '3000' : c.slug === 'cancelaciones' ? '2000' : '1000'),
              cabecera_ivr: c.cabecera_ivr || '8000',
              cabecera_pstn: c.cabecera_pstn || ['8009990000', '5550001000'],
              agentes_extensiones: ags,
              dids_asociados: ags.map(a => a.extension)
            };
          });
          setCampaigns(normalized);
          const current = normalized.find((c: any) => c.slug === selectedCampaign.slug) || normalized[0];
          setSelectedCampaign(current);
        }

        const { data: dbLogs } = await supabase
          .from('llamadas_bitacora')
          .select('id, caller_id, cliente_id, tipo, estado, campana, did_marcado, duracion_segundos, fecha_hora, grabacion_url, agente_nombre, extension_agente')
          .order('fecha_hora', { ascending: false })
          .limit(10);
        if (dbLogs) {
          setRecentLogs(dbLogs);
        }
      } catch (err) {
        console.warn('Error cargando campañas de Supabase:', err);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Abrir Modal de Administración de Extensiones de la Campaña
  const handleOpenManageModal = (camp: Campaign) => {
    const agentes: AgentExtension[] = camp.agentes_extensiones && camp.agentes_extensiones.length > 0 
      ? JSON.parse(JSON.stringify(camp.agentes_extensiones))
      : (camp.dids_asociados || []).map(d => ({
          extension: d,
          nombre: camp.slug === 'doctores' ? `Médico Ext. ${d}` : `Agente Ext. ${d}`,
          activo: true
        }));

    setEditingCampaign({
      ...camp,
      dids_asociados: [...(camp.dids_asociados || [])],
      agentes_extensiones: agentes,
      opciones_permitidas: [...(camp.opciones_permitidas || [])]
    });

    const basePrefix = camp.did_campana ? camp.did_campana[0] : '1';
    const nextNum = (agentes.length + 1).toString().padStart(3, '0');
    const passPrefix = camp.slug === 'doctores' ? 'Doctor' : camp.slug === 'ventas' ? 'Ventas' : camp.slug === 'cancelaciones' ? 'Retencion' : 'Finanzas';
    setNewExtInput(`${basePrefix}${nextNum}`);
    setNewAgentNameInput('');
    setNewPasswordInput(`${passPrefix}Pass${basePrefix}${nextNum}!`);
    setEditingExtIndex(null);
    setDeleteWarningMsg(null);
    setSaveStatus('idle');
    setStatusMessage('');
    setIsManageModalOpen(true);
  };

  // Dar de alta nueva extensión para un agente o médico
  const handleAddAgentExtension = () => {
    if (!editingCampaign || !newExtInput.trim()) return;
    const cleanExt = newExtInput.trim().replace(/\s+/g, '');
    const cleanName = newAgentNameInput.trim() || (editingCampaign.slug === 'doctores' ? `Dr./Dra. Ext. ${cleanExt}` : `Agente Ext. ${cleanExt}`);
    const passPrefix = editingCampaign.slug === 'doctores' ? 'Doctor' : editingCampaign.slug === 'ventas' ? 'Ventas' : editingCampaign.slug === 'cancelaciones' ? 'Retencion' : 'Finanzas';
    const cleanPass = newPasswordInput.trim() || `${passPrefix}Pass${cleanExt}!`;

    const existingList = editingCampaign.agentes_extensiones || [];
    if (existingList.some(a => a.extension === cleanExt)) {
      setStatusMessage(`La extensión ${cleanExt} ya se encuentra registrada en esta campaña.`);
      return;
    }

    const updatedAgentes: AgentExtension[] = [
      ...existingList,
      { 
        extension: cleanExt, 
        nombre: cleanName, 
        password: cleanPass, 
        activo: true, 
        historial_asignaciones: [] 
      }
    ];
    const updatedDids = updatedAgentes.map(a => a.extension);

    setEditingCampaign({
      ...editingCampaign,
      agentes_extensiones: updatedAgentes,
      dids_asociados: updatedDids,
      extension_agente: updatedDids[0] || cleanExt
    });

    setNewAgentNameInput('');
    const basePrefix = editingCampaign.did_campana ? editingCampaign.did_campana[0] : '1';
    const nextNum = (updatedAgentes.length + 1).toString().padStart(3, '0');
    setNewExtInput(`${basePrefix}${nextNum}`);
    setNewPasswordInput(`${passPrefix}Pass${basePrefix}${nextNum}!`);
    setStatusMessage('');
  };

  // Reasignar nombre de agente conservando el histórico anterior (Best Practice)
  const handleSaveEditExtensionName = (index: number) => {
    if (!editingCampaign || !editingExtName.trim()) return;
    const cleanNewName = editingExtName.trim();
    const updatedAgentes = [...(editingCampaign.agentes_extensiones || [])];
    const targetAg = updatedAgentes[index];

    if (!targetAg) return;

    // Si el nombre cambió, archivar el nombre anterior en el histórico
    if (targetAg.nombre !== cleanNewName) {
      const historial = targetAg.historial_asignaciones || [];
      historial.unshift({
        nombre_anterior: targetAg.nombre,
        fecha_cambio: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
      });
      targetAg.historial_asignaciones = historial;
      targetAg.nombre = cleanNewName;
    }

    setEditingCampaign({
      ...editingCampaign,
      agentes_extensiones: updatedAgentes
    });
    setEditingExtIndex(null);
    setEditingExtName('');
    setStatusMessage(`Titular actualizado con histórico archivado.`);
  };

  // Alternar estado activo / inactivo de la extensión (Soft Deactivation sin borrar histórico)
  const handleToggleActiveExtension = (index: number) => {
    if (!editingCampaign) return;
    const updatedAgentes = [...(editingCampaign.agentes_extensiones || [])];
    const target = updatedAgentes[index];
    if (target) {
      target.activo = !(target.activo !== false);
      setEditingCampaign({
        ...editingCampaign,
        agentes_extensiones: updatedAgentes
      });
      setStatusMessage(`Extensión ${target.extension} ${target.activo ? 'activada' : 'pausada / desactivada'}.`);
    }
  };

  // Advertencia informativa: No eliminación física para preservar auditoría de llamadas y grabaciones .wav
  const handleShowDeleteWarning = (ext: string, nombre: string) => {
    setDeleteWarningMsg(
      `Por mejores prácticas de telecomunicaciones y auditoría clínica/financiera, la extensión ${ext} (${nombre}) no se elimina físicamente para preservar el histórico de llamadas pasadas, la bitácora y sus grabaciones .wav. En su lugar, puede pausarla marcándola como 'Inactiva' o reasignar su titular.`
    );
  };

  // Guardar cambios en Supabase y ejecutar recarga automática en Asterisk 20
  const handleSaveChanges = async () => {
    if (!editingCampaign) return;
    setSaveStatus('saving');
    setStatusMessage('Guardando en Supabase y recargando Asterisk 20...');

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('campanas')
          .update({
            nombre: editingCampaign.nombre,
            extension_agente: editingCampaign.extension_agente,
            dids_asociados: editingCampaign.dids_asociados,
            agentes_extensiones: editingCampaign.agentes_extensiones,
            opciones_permitidas: editingCampaign.opciones_permitidas,
            enrutamiento_directo: editingCampaign.enrutamiento_directo || null,
            descripcion: editingCampaign.descripcion
          })
          .eq('id', editingCampaign.id);

        if (error) {
          setSaveStatus('error');
          setStatusMessage(`Error en base de datos: ${error.message}`);
          return;
        }

        // Llamar endpoint para sincronizar extensiones en Asterisk y recargar dialplan/pjsip vía AMI
        try {
          if (editingCampaign.agentes_extensiones && editingCampaign.agentes_extensiones.length > 0) {
            for (const ag of editingCampaign.agentes_extensiones) {
              await fetch('/api/extensions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  extension: ag.extension,
                  nombre: ag.nombre,
                  password: ag.password,
                  campanaId: editingCampaign.id,
                  campanaSlug: editingCampaign.slug,
                  didVirtual: editingCampaign.did_campana,
                  activo: ag.activo !== false
                })
              });
            }
          }
          await fetch('/api/extensions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaignId: editingCampaign.id,
              action: 'reload'
            })
          });
        } catch (amiErr) {
          console.warn('Aviso recarga AMI:', amiErr);
        }

        setSaveStatus('saved');
        setStatusMessage('¡Campañas, DIDs y Asterisk 20 sincronizados y recargados exitosamente!');
        await loadData();
        setTimeout(() => {
          setIsManageModalOpen(false);
          setSaveStatus('idle');
          setDeleteWarningMsg(null);
        }, 1200);
      } catch (err: any) {
        setSaveStatus('error');
        setStatusMessage(err?.message || 'Error de conexión');
      }
    } else {
      setCampaigns(prev => prev.map(c => c.id === editingCampaign.id ? editingCampaign : c));
      setSelectedCampaign(editingCampaign);
      setSaveStatus('saved');
      setStatusMessage('Cambios actualizados en memoria.');
      setTimeout(() => {
        setIsManageModalOpen(false);
        setSaveStatus('idle');
      }, 1000);
    }
  };

  const getOptionBadge = (opt: string) => {
    switch (opt) {
      case '1':
        return (
          <span key={opt} className="bg-emerald-50 text-emerald-700 border border-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
            <CreditCard className="w-3 h-3" /> Opción 1: Consulta de Saldo
          </span>
        );
      case '2':
        return (
          <span key={opt} className="bg-rose-50 text-rose-700 border border-rose-300 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Opción 2: Cancelación de Tarjeta
          </span>
        );
      case '3':
        return (
          <span key={opt} className="bg-blue-50 text-blue-700 border border-blue-300 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Opción 3: Ventas & Asesor Comercial
          </span>
        );
      case '4':
        return (
          <span key={opt} className="bg-teal-50 text-teal-700 border border-teal-300 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
            <Stethoscope className="w-3 h-3" /> Opción 4: Citas Médicas & Doctores IA
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Superior de Arquitectura Jerárquica de Campañas */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-7 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-400 border border-blue-400/40 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Megaphone className="w-3 h-3" /> Dialplan Asterisk 20 & Salida PSTN
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Dna className="w-3 h-3" /> Cabecera Fija 8000 & DIDs 1000 - 4000
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Campañas Telefónicas, DIDs Virtuales y Salida Outbound PSTN
            </h2>
            <p className="text-slate-300 text-xs leading-relaxed">
              Todas las extensiones salen a la PSTN con el identificador de cabecera fija 8000 asociado al DID virtual de su campaña. Gestión de extensiones con preservación inmutable del histórico de titulares y grabaciones .wav.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-2 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar Campañas
            </button>
          </div>
        </div>
      </div>

      {/* Reglas de Segmentación y Matriz de Campañas (Imagen 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {campaigns.map((camp) => {
          const isSelected = selectedCampaign.slug === camp.slug;
          const agentList = camp.agentes_extensiones || (camp.dids_asociados || []).map(d => ({
            extension: d,
            nombre: `Ext. ${d}`,
            activo: true
          }));

          return (
            <div
              key={camp.id}
              onClick={() => setSelectedCampaign(camp)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected 
                  ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-500/20' 
                  : 'bg-white/80 hover:bg-white border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                    Campaña {camp.slug}
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Activa
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">{camp.nombre}</h3>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{camp.descripcion}</p>
                </div>

                {/* DID Virtual de Campaña y Cabecera Fija */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-[11px] space-y-1.5 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-sans font-bold text-[10px]">DID VIRTUAL:</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold text-xs">
                      {camp.did_campana}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200/60 pt-1">
                    <span className="flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-slate-400" /> Cabecera IVR:
                    </span>
                    <strong className="text-slate-700">8000 (PSTN)</strong>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-emerald-700 bg-emerald-50/70 p-1 rounded font-sans font-bold">
                    <span className="flex items-center gap-1">
                      <PhoneOutgoing className="w-2.5 h-2.5" /> Outbound PSTN:
                    </span>
                    <span>Habilitado (8000)</span>
                  </div>
                </div>

                {/* Extensiones Asignadas a los Agentes/Médicos */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Extensiones Agrupadas ({agentList.length}):
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenManageModal(camp);
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 hover:underline"
                    >
                      <Plus className="w-2.5 h-2.5" /> Agregar
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {agentList.map((ag) => (
                      <button
                        key={ag.extension}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onTestDialNumber) onTestDialNumber(ag.extension);
                        }}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition flex items-center gap-1 group ${
                          ag.activo === false
                            ? 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-75'
                            : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border-slate-200'
                        }`}
                        title={`${ag.nombre} ${ag.activo === false ? '(Pausada)' : ''} - Click para llamar`}
                      >
                        <User className="w-2.5 h-2.5 text-slate-400 group-hover:text-blue-600" />
                        <strong>{ag.extension}</strong>
                        <span className="text-[9px] text-slate-400 truncate max-w-[80px]">
                          {ag.nombre.replace(/^(Dr\.|Dra\.|Agente|Asesor|Asesora)\s*/i, '')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botón Gestionar */}
              <div className="pt-3 border-t border-slate-100 mt-4 space-y-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenManageModal(camp);
                  }}
                  className="w-full py-1.5 px-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl text-xs font-bold border border-slate-200 hover:border-blue-300 flex items-center justify-center gap-1.5 transition active:scale-98"
                >
                  <Settings2 className="w-3.5 h-3.5" /> Administrar Extensiones & Agentes
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detalle Profundo de la Campaña Seleccionada */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-800">{selectedCampaign.nombre}</h3>
                <span className="text-xs font-mono bg-blue-600 text-white px-2.5 py-0.5 rounded-full font-bold">
                  DID Virtual: {selectedCampaign.did_campana}
                </span>
                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Cabecera PSTN: {selectedCampaign.cabecera_ivr}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{selectedCampaign.descripcion}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenManageModal(selectedCampaign)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Dar de Alta / Reasignar Titulares
            </button>

            {onTestDialNumber && (
              <button
                onClick={() => onTestDialNumber(selectedCampaign.did_campana)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition active:scale-95"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Probar DID Virtual ({selectedCampaign.did_campana})
              </button>
            )}
          </div>
        </div>

        {/* Tarjeta de Regla Outbound a la PSTN con Cabecera 8000 */}
        <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 border border-blue-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl">
              <PhoneOutgoing className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Regla Outbound Hacia la PSTN Activa (Cabecera 8000)
              </h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Cualquier extensión del rango <strong className="text-blue-700 font-mono">{selectedCampaign.did_campana[0]}XXX</strong> puede realizar llamadas salientes a teléfonos externos. La llamada sale hacia la red pública identificándose con el número de cabecera <strong className="text-slate-800 font-mono">8000</strong> y se graba con su ADN único (UUID).
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-white text-emerald-700 border border-emerald-300 px-3 py-1 rounded-xl shadow-xs">
            CallerID: 8000 &bull; DID {selectedCampaign.did_campana}
          </span>
        </div>

        {/* Panel de Agentes y Extensiones Asignadas al Grupo */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" /> Agentes Asignados a la Campaña {selectedCampaign.did_campana}
            </span>
            <span className="text-[11px] text-slate-500">
              Rango PBX: <strong className="text-blue-600">{selectedCampaign.did_campana[0]}001 - {selectedCampaign.did_campana[0]}999</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {(selectedCampaign.agentes_extensiones || []).map((ag) => (
              <div
                key={ag.extension}
                className={`p-3 rounded-xl border transition flex flex-col justify-between ${
                  ag.activo === false 
                    ? 'bg-slate-100/60 border-slate-200 opacity-75' 
                    : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                      {selectedCampaign.slug === 'doctores' ? <Stethoscope className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-blue-700 text-xs">Ext. {ag.extension}</span>
                        {ag.activo === false && (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1.5 rounded">Pausada</span>
                        )}
                      </div>
                      <strong className="text-slate-800 text-xs block leading-tight">{ag.nombre}</strong>
                    </div>
                  </div>

                  {onTestDialNumber && ag.activo !== false && (
                    <button
                      onClick={() => onTestDialNumber(ag.extension)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                      title={`Llamar a ${ag.nombre}`}
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Histórico de Asignaciones Anteriores */}
                {ag.historial_asignaciones && ag.historial_asignaciones.length > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1 font-semibold text-slate-400">
                      <History className="w-2.5 h-2.5" /> Anteriormente:
                    </span>
                    <span className="italic text-slate-600 block truncate">
                      {ag.historial_asignaciones[0].nombre_anterior} ({ag.historial_asignaciones[0].fecha_cambio})
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Políticas de Aislamiento Estricto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Opciones Habilitadas y Autorizadas
            </span>
            <div className="space-y-1.5 pt-1">
              {(selectedCampaign.opciones_permitidas || []).map(opt => getOptionBadge(opt))}
            </div>
          </div>

          <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 space-y-2">
            <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-600" /> Opciones Bloqueadas / Aisladas para este Departamento
            </span>
            <div className="space-y-1.5 pt-1 text-xs">
              {['1', '2', '3', '4'].filter(o => !selectedCampaign.opciones_permitidas?.includes(o)).map(opt => (
                <div key={opt} className="bg-white/90 p-2 rounded-lg border border-rose-200 text-slate-600 flex items-center justify-between">
                  <span>
                    {opt === '1' && 'Opción 1: Consulta de Saldo'}
                    {opt === '2' && 'Opción 2: Cancelación de Tarjeta'}
                    {opt === '3' && 'Opción 3: Ventas y Nuevos Contratos'}
                    {opt === '4' && 'Opción 4: Citas Médicas y Doctores IA'}
                  </span>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                    Acceso Prohibido
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Matriz de Homologación: ID Único (ADN de Llamada) y Reproductor de Audio Homologado */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
              <Dna className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">
                Bitácora Homologada con ID Único e Irrepetible (ADN de Llamada)
              </h3>
              <p className="text-slate-500 text-xs">
                Cada canal abierto en Asterisk 20 (entrante o saliente) genera su UUID inmutable, vinculado al CallerID, agente titular de ese momento y a la ruta de grabación .wav.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-slate-100 text-slate-600 font-mono px-3 py-1 rounded-lg">
              {recentLogs.length} llamadas registradas
            </span>
          </div>
        </div>

        {/* Tabla de Registros Homologados en Vivo con Reproductor WAV */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80">
                <th className="py-2.5 px-3">ID Único (ADN / UUID)</th>
                <th className="py-2.5 px-3">CallerID</th>
                <th className="py-2.5 px-3">Agente / Especialista</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Campaña</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 min-w-[300px]">Grabación Homologada (.wav) & Audio Player</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {recentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition font-mono">
                  <td className="py-3 px-3">
                    <button
                      onClick={() => handleCopy(log.id, log.id)}
                      className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 group"
                      title="Copiar UUID"
                    >
                      <Tag className="w-3 h-3 text-blue-400 group-hover:text-blue-600" />
                      <span>{log.id.slice(0, 18)}...</span>
                      {copiedId === log.id && <Check className="w-3 h-3 text-emerald-600" />}
                    </button>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-800">{log.caller_id}</td>
                  <td className="py-3 px-3 font-sans">
                    <span className="font-bold text-slate-700 block">
                      {log.agente_nombre || (log.extension_agente ? `Ext. ${log.extension_agente}` : 'Atención IVR')}
                    </span>
                    {log.extension_agente && (
                      <span className="text-[10px] text-blue-600 font-mono">Ext. {log.extension_agente}</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      log.tipo === 'entrante' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {log.tipo}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-semibold">{log.campana || 'atencion_clientes'}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      log.estado === 'finalizada' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 animate-pulse'
                    }`}>
                      {log.estado}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <AudioPlayerCell
                      logId={log.id}
                      durationSeconds={log.duracion_segundos}
                      activePlayingId={activePlayingId}
                      onTogglePlay={setActivePlayingId}
                    />
                  </td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 italic font-sans">
                    No hay registros recientes. Inicie una llamada entrante o saliente para generar un nuevo ADN de llamada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADMINISTRACIÓN DE EXTENSIONES & REASIGNACIÓN CON HISTÓRICO          */}
      {/* ========================================================================= */}
      {isManageModalOpen && editingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    Administrar Extensiones & Titulares
                  </h3>
                  <span className="text-xs text-slate-500">
                    Campaña: <strong className="text-slate-700">{editingCampaign.nombre}</strong> ({editingCampaign.slug})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsManageModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 space-y-6">
              {/* Mensaje de estado */}
              {statusMessage && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  saveStatus === 'saved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  saveStatus === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                  'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {saveStatus === 'saved' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Advertencia informativa de mejores prácticas */}
              {deleteWarningMsg && (
                <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="block font-bold">Mejor Práctica de Auditoría Telefónica:</strong>
                    <p className="leading-relaxed">{deleteWarningMsg}</p>
                  </div>
                </div>
              )}

              {/* SECCIÓN 1: CABECERA Y DID VIRTUAL FIJOS (Inmutables por Supervisor) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-500" /> Parámetros Centrales de Conmutador (Protegidos)
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Solo Administrador
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* DID Virtual de Campaña Fijo */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      DID Virtual de Campaña (Dialplan):
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-base font-black text-blue-700">
                        {editingCampaign.did_campana}
                      </span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono font-bold">
                        Fijo Asterisk
                      </span>
                    </div>
                  </div>

                  {/* Cabecera IVR y PSTN Fijas */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Cabecera General IVR & Troncal PSTN:
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        8000 <span className="text-[10px] text-slate-400 font-normal">(PSTN: 8009990000)</span>
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        Conmutador
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: FORMULARIO DAR DE ALTA NUEVA EXTENSIÓN */}
              <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                    Dar de Alta Nueva Extensión
                  </h4>
                  <span className="text-[10px] font-mono text-blue-700 font-bold">
                    Rango: {editingCampaign.did_campana[0]}XXX
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Número de Extensión
                    </label>
                    <input
                      type="text"
                      value={newExtInput}
                      onChange={(e) => setNewExtInput(e.target.value)}
                      placeholder={`Ej. ${editingCampaign.did_campana[0]}005`}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-700 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Nombre del {editingCampaign.slug === 'doctores' ? 'Médico Especialista' : 'Agente'}
                    </label>
                    <input
                      type="text"
                      value={newAgentNameInput}
                      onChange={(e) => setNewAgentNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAgentExtension();
                        }
                      }}
                      placeholder={editingCampaign.slug === 'doctores' ? 'Ej. Dr. Roberto Gómez - Pediatría' : 'Ej. Juan Pérez - Asesor'}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400" /> Password SIP
                    </label>
                    <input
                      type="text"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Pass Softphone"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono text-slate-700 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Key className="w-3 h-3 text-blue-500" /> Requerido para registrarse en MicroSIP, Zoiper o WebRTC con Asterisk 20.
                  </span>
                  <button
                    type="button"
                    onClick={handleAddAgentExtension}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" /> Dar de Alta Extensión
                  </button>
                </div>
              </div>

              {/* SECCIÓN 3: LISTA DE EXTENSIONES Y REASIGNACIÓN CON HISTÓRICO */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Extensiones Asignadas (Total: {(editingCampaign.agentes_extensiones || []).length})
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Actualice titulares o pause extensiones sin perder el histórico.
                  </span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(editingCampaign.agentes_extensiones || []).map((ag, idx) => {
                    const isEditing = editingExtIndex === idx;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl border transition ${
                          ag.activo === false 
                            ? 'bg-slate-50/80 border-slate-200' 
                            : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1 mr-2">
                              <span className="font-mono font-bold text-blue-700 text-xs px-2 py-1 bg-blue-50 rounded">
                                Ext. {ag.extension}
                              </span>
                              <input
                                type="text"
                                value={editingExtName}
                                onChange={(e) => setEditingExtName(e.target.value)}
                                className="flex-1 px-3 py-1.5 text-xs border border-blue-400 rounded-lg font-medium"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditExtensionName(idx)}
                                className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-bold flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingExtIndex(null)}
                                className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-100 rounded-xl text-slate-700 font-mono font-bold text-xs">
                                {ag.extension}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <strong className="text-slate-800 text-xs">{ag.nombre}</strong>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    ag.activo === false 
                                      ? 'bg-slate-200 text-slate-600' 
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {ag.activo === false ? 'Pausada' : 'Activa'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    PJSIP/{ag.extension} &bull; DID {editingCampaign.did_campana}
                                  </span>
                                  <span className="text-[10px] text-slate-300">&bull;</span>
                                  <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                                    Pass: {ag.password || `ARMpass${ag.extension}!`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(ag.password || `ARMpass${ag.extension}!`);
                                      setStatusMessage(`Contraseña de Ext. ${ag.extension} copiada al portapapeles`);
                                      setTimeout(() => setStatusMessage(''), 2500);
                                    }}
                                    className="text-[9px] text-blue-600 hover:text-blue-800 p-0.5 hover:bg-blue-50 rounded"
                                    title="Copiar contraseña SIP para configurar softphone"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {!isEditing && (
                            <div className="flex items-center gap-1.5">
                              {/* Botón Reasignar Nombre */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingExtIndex(idx);
                                  setEditingExtName(ag.nombre);
                                }}
                                className="px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg font-medium flex items-center gap-1 transition"
                                title="Cambiar titular preservando el histórico anterior"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Reasignar</span>
                              </button>

                              {/* Botón Pausar / Activar */}
                              <button
                                type="button"
                                onClick={() => handleToggleActiveExtension(idx)}
                                className={`p-1.5 rounded-lg border transition ${
                                  ag.activo === false
                                    ? 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                                    : 'text-slate-500 bg-slate-50 border-slate-200 hover:bg-slate-100'
                                }`}
                                title={ag.activo === false ? 'Reactivar extensión' : 'Pausar extensión'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>

                              {/* Botón informativo de no borrado */}
                              <button
                                type="button"
                                onClick={() => handleShowDeleteWarning(ag.extension, ag.nombre)}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                title="Información sobre eliminación"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Visualización del Histórico de Titulares Anteriores */}
                        {ag.historial_asignaciones && ag.historial_asignaciones.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-400 flex items-center gap-1">
                              <History className="w-3 h-3 text-slate-400" /> Titulares anteriores:
                            </span>
                            {ag.historial_asignaciones.map((h, hIdx) => (
                              <span key={hIdx} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                                {h.nombre_anterior} ({h.fecha_cambio})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 rounded-b-3xl">
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={saveStatus === 'saving'}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                {saveStatus === 'saving' ? 'Guardando y Recargando...' : 'Guardar y Recargar Asterisk 20'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
