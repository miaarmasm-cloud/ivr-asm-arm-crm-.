'use client';

import React, { useState, useEffect } from 'react';
import CustomerProfile from '@/components/CustomerProfile';
import CallBitacora from '@/components/CallBitacora';
import OrderCalendar from '@/components/OrderCalendar';
import WebRTCDialer from '@/components/WebRTCDialer';
import ScreenPopModal from '@/components/ScreenPopModal';
import VisualIVRFlow from '@/components/VisualIVRFlow';
import TelephonyMonitor from '@/components/TelephonyMonitor';
import VMConnectionModal from '@/components/VMConnectionModal';
import MedicalConsultations from '@/components/MedicalConsultations';
import CampaignsManager from '@/components/CampaignsManager';
import { Customer, CallLog, OrderDelivery } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { getVMConfig, VMConnectionConfig } from '@/lib/config';
import { 
  Phone, 
  PhoneOutgoing,
  Search, 
  Users, 
  Sparkles, 
  PhoneCall, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  LayoutDashboard, 
  Server, 
  Activity, 
  Wifi, 
  CreditCard, 
  DollarSign, 
  Package, 
  Plus,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Stethoscope,
  Megaphone
} from 'lucide-react';

// Datos semilla de inicio para pruebas inmediatas
const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    caller_id: '1001',
    nombre_completo: 'Carlos Mendoza Ortiz',
    empresa: 'Logística & Distribución S.A.',
    direccion: 'Av. Reforma 222, Piso 14, Cuauhtémoc, CDMX',
    numero_tarjeta_mask: '**** **** **** 8821',
    saldo: 14850.50,
    estatus_tarjeta: 1,
    email: 'carlos.mendoza@empresa.com',
    telefonos_adicionales: ['+525598765432', '+525544332211'],
    fecha_nacimiento: '1985-06-15',
    agente_asignado: 'Agente Demo 1',
    compras_previas: [
      { item: 'Licencia Enterprise ARM', fecha: '2026-01-10', total: 12000.00 },
      { item: 'Módulo de Telefonía SIP WebRTC', fecha: '2026-02-14', total: 2850.50 }
    ]
  },
  {
    id: 'c2',
    caller_id: '+525588776655',
    nombre_completo: 'Mariana Gómez Salgado',
    empresa: 'Comercializadora del Norte',
    direccion: 'Calzada del Valle 400, San Pedro Garza García, N.L.',
    numero_tarjeta_mask: '**** **** **** 3314',
    saldo: 5200.00,
    estatus_tarjeta: 1,
    email: 'mariana.gomez@norte.com.mx',
    telefonos_adicionales: ['+528112233445'],
    fecha_nacimiento: '1992-11-20',
    agente_asignado: 'Agente Demo 1',
    compras_previas: [
      { item: 'Servidor PBX Asterisk 20 Cloud', fecha: '2026-02-01', total: 5200.00 }
    ]
  },
  {
    id: 'c3',
    caller_id: '+523312345678',
    nombre_completo: 'Roberto Silva Lozano',
    empresa: 'Tecnologías Aplicadas del Bajío',
    direccion: 'Av. Américas 1500, Guadalajara, Jal.',
    numero_tarjeta_mask: '**** **** **** 4490',
    saldo: 23100.00,
    estatus_tarjeta: 1,
    email: 'roberto.silva@tecno-bajio.mx',
    telefonos_adicionales: ['+523398765412'],
    fecha_nacimiento: '1979-03-28',
    agente_asignado: 'Agente Demo 1',
    compras_previas: [
      { item: 'Troncal SIP 16 Canales Dedicados', fecha: '2026-02-05', total: 18500.00 },
      { item: 'Gateway VoIP FXO/FXS', fecha: '2026-02-09', total: 4600.00 }
    ]
  }
];

const INITIAL_LOGS: CallLog[] = [
  {
    id: 'log-1',
    caller_id: '1001',
    tipo: 'entrante',
    duracion_segundos: 184,
    opcion_ivr_seleccionada: '1. Consulta de Saldo',
    resumen_ia: 'El cliente consultó su saldo mediante el IVR y solicitó confirmación de la fecha de entrega del pedido PED-2026-904.',
    notas_agente: 'Cliente prioritario. Se le informó que el pedido llega en 48 horas.',
    fecha_hora: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'log-2',
    caller_id: '+525588776655',
    tipo: 'entrante',
    duracion_segundos: 120,
    opcion_ivr_seleccionada: '2. Cancelación',
    resumen_ia: 'Cliente consultó proceso de cancelación de cuenta. Se generó folio preliminar CAN-9012 y se ofreció bono de retención del 15%.',
    notas_agente: 'Cliente evaluando oferta de retención. Programar seguimiento.',
    fecha_hora: new Date(Date.now() - 7200000).toISOString()
  }
];

const INITIAL_ORDERS: OrderDelivery[] = [
  {
    id: 'ord-1',
    cliente_id: 'c1',
    folio_pedido: 'PED-2026-904',
    descripcion_compra: 'Equipo Gateway SIP 8 Canales + Auriculares Noise-Cancelling',
    monto_total: 6400.00,
    fecha_pedido: '2026-02-10',
    fecha_estimada_entrega: '2026-02-16',
    estado_entrega: 'En ruta',
    notificado_al_cliente: false,
    notas_entrega: 'Entregar en horario de oficina de 9:00 a 17:00 hrs con vigilancia'
  },
  {
    id: 'ord-2',
    cliente_id: 'c2',
    folio_pedido: 'PED-2026-988',
    descripcion_compra: 'Router Mikrotik Cloud Router Switch 24 Puertos',
    monto_total: 4800.00,
    fecha_pedido: '2026-02-12',
    fecha_estimada_entrega: '2026-02-18',
    estado_entrega: 'En preparación',
    notificado_al_cliente: false,
    notas_entrega: 'Confirmar previamente vía llamada al llegar'
  }
];

export default function CRMPage() {
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('c1');
  const [callLogs, setCallLogs] = useState<CallLog[]>(INITIAL_LOGS);
  const [orders, setOrders] = useState<OrderDelivery[]>(INITIAL_ORDERS);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estado para Screen-Pop (Llamada entrante o saliente con reporte / incidencia del momento)
  const [screenPopData, setScreenPopData] = useState<{
    callerId: string;
    callType: 'entrante' | 'saliente';
    folio?: string;
    reporte?: string;
  } | null>(null);
  
  // Número activo en el dialer WebRTC
  const [activeDialNumber, setActiveDialNumber] = useState('1001');
  const [autoStartCallTs, setAutoStartCallTs] = useState<number>(0);

  // Pestaña activa: 'crm' | 'flow' | 'monitor' | 'medical' | 'campaigns'
  const [activeTab, setActiveTab] = useState<'crm' | 'flow' | 'monitor' | 'medical' | 'campaigns'>('crm');

  // Modal de configuración VM / Localhost
  const [isVMModalOpen, setIsVMModalOpen] = useState(false);
  const [vmConfig, setVmConfig] = useState<VMConnectionConfig>(getVMConfig());

  // Formulario rápido para nuevo cliente
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || null;

  // Cargar clientes y bitácora desde Supabase al iniciar
  useEffect(() => {
    async function loadInitialData() {
      if (isSupabaseConfigured()) {
        try {
          const { data: dbCustomers } = await supabase
            .from('clientes')
            .select('*')
            .order('caller_id', { ascending: true });
          if (dbCustomers && dbCustomers.length > 0) {
            setCustomers(dbCustomers);
            setSelectedCustomerId(dbCustomers[0].id);
          }

          const { data: dbLogs } = await supabase
            .from('llamadas_bitacora')
            .select('*')
            .order('fecha_hora', { ascending: false })
            .limit(20);
          if (dbLogs && dbLogs.length > 0) {
            setCallLogs(dbLogs);
          }
        } catch (e) {
          console.error('Error cargando datos de Supabase:', e);
        }
      }
    }
    loadInitialData();
  }, []);

  // Escuchar eventos en tiempo real de Supabase
  useEffect(() => {
    if (isSupabaseConfigured()) {
      const channel = supabase
        .channel('realtime_calls')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'llamadas_bitacora' },
          (payload: any) => {
            const newLog = payload.new as CallLog;
            setCallLogs(prev => [newLog, ...prev]);
            if (newLog.tipo === 'entrante') {
              const cust = customers.find(c => c.caller_id === newLog.caller_id);
              setScreenPopData({
                callerId: newLog.caller_id,
                callType: 'entrante',
                folio: cust?.folio_cancelacion || `INC-IN-${newLog.caller_id}`,
                reporte: newLog.resumen_ia || 'Llamada entrante canalizada desde Asterisk IVR hacia agente'
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [customers]);

  // Filtrar clientes por CallerID, Nombre, Empresa o Tarjeta
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      c.caller_id.toLowerCase().includes(q) ||
      c.nombre_completo.toLowerCase().includes(q) ||
      c.empresa.toLowerCase().includes(q) ||
      c.numero_tarjeta_mask.toLowerCase().includes(q)
    );
  });

  // Manejar Screen-Pop al atender la llamada o desplegar ficha
  const handleAcceptScreenPop = (callerId: string) => {
    let customer = customers.find(c => c.caller_id === callerId);
    if (!customer) {
      customer = {
        id: `c-${Date.now()}`,
        caller_id: callerId,
        nombre_completo: `Cliente Nuevo (${callerId})`,
        empresa: 'Empresa por registrar',
        direccion: '',
        numero_tarjeta_mask: '**** **** **** 0000',
        saldo: 0.00,
        email: '',
        telefonos_adicionales: [],
        fecha_nacimiento: '2000-01-01',
        agente_asignado: 'Agente Demo 1',
        compras_previas: []
      };
      setCustomers(prev => [customer!, ...prev]);
    }
    setSelectedCustomerId(customer.id);
    setActiveDialNumber(customer.caller_id);
    setScreenPopData(null);
  };

  // Guardar notas de incidencia en vivo desde el Screen-Pop a Supabase
  const handleSaveIncidentNotes = async (callerId: string, notes: string) => {
    const customer = customers.find(c => c.caller_id === callerId);
    const newLog: CallLog = {
      id: `log-${Date.now()}`,
      caller_id: callerId,
      cliente_id: customer?.id || undefined,
      tipo: 'saliente',
      duracion_segundos: 0,
      notas_agente: notes,
      resumen_ia: `Incidencia en Screen-Pop para ${customer?.nombre_completo || callerId}: ${notes}`,
      fecha_hora: new Date().toISOString()
    };
    setCallLogs(prev => [newLog, ...prev]);
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('llamadas_bitacora').insert({
          caller_id: callerId,
          cliente_id: customer?.id || undefined,
          tipo: 'saliente',
          estado: 'finalizada',
          opcion_ivr_seleccionada: 'Incidencia Screen-Pop',
          resumen_ia: newLog.resumen_ia,
          notas_agente: notes
        });
      } catch (err) {
        console.warn('Error guardando incidencia en Supabase:', err);
      }
    }
  };

  const handleSaveCustomer = async (updated: Customer) => {
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('clientes')
          .update({
            nombre_completo: updated.nombre_completo,
            empresa: updated.empresa,
            direccion: updated.direccion,
            email: updated.email,
            agente_asignado: updated.agente_asignado,
            estatus_tarjeta: updated.estatus_tarjeta ?? 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', updated.id);
      } catch (err) {
        console.error('Error sincronizando cambios con Supabase:', err);
      }
    }
  };

  const handleAddNote = (noteText: string) => {
    if (!activeCustomer) return;
    const newLog: CallLog = {
      id: `log-${Date.now()}`,
      caller_id: activeCustomer.caller_id,
      cliente_id: activeCustomer.id,
      tipo: 'saliente',
      duracion_segundos: 60,
      notas_agente: noteText,
      fecha_hora: new Date().toISOString()
    };
    setCallLogs(prev => [newLog, ...prev]);
  };

  const handleDirectOutboundCall = (phone: string) => {
    setActiveDialNumber(phone);
    setAutoStartCallTs(Date.now());
    const cust = customers.find(c => c.caller_id === phone);
    setScreenPopData({
      callerId: phone,
      callType: 'saliente',
      folio: cust?.folio_cancelacion || `INC-${new Date().getFullYear()}-${phone}`,
      reporte: cust?.estatus_tarjeta === 2
        ? `Llamada Outbound: Gestión de Incidencia por Tarjeta Cancelada (Folio: ${cust.folio_cancelacion || 'CAN-8821'}). Saldo bloqueado en IVR.`
        : `Llamada Outbound de seguimiento directo para ${cust?.nombre_completo || phone}.`
    });
  };

  const handleNotifyCustomer = (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, notificado_al_cliente: true } : o));
    if (activeCustomer) {
      const notifyLog: CallLog = {
        id: `log-${Date.now()}`,
        caller_id: activeCustomer.caller_id,
        cliente_id: activeCustomer.id,
        tipo: 'saliente',
        duracion_segundos: 0,
        resumen_ia: 'Notificación SMS/WhatsApp automática enviada al cliente confirmando fecha estimada de entrega.',
        fecha_hora: new Date().toISOString()
      };
      setCallLogs(prev => [notifyLog, ...prev]);
    }
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustPhone.trim()) return;
    const newCust: Customer = {
      id: `c-${Date.now()}`,
      caller_id: newCustPhone.trim(),
      nombre_completo: newCustName.trim() || `Contacto ${newCustPhone.trim()}`,
      empresa: 'Corporativo General',
      direccion: 'Por registrar',
      numero_tarjeta_mask: `**** **** **** ${Math.floor(1000 + Math.random() * 9000)}`,
      saldo: 5000.00,
      email: `${newCustPhone.trim()}@empresa.com`,
      telefonos_adicionales: [],
      fecha_nacimiento: '1990-01-01',
      agente_asignado: 'Agente Demo 1',
      compras_previas: []
    };
    setCustomers(prev => [newCust, ...prev]);
    setSelectedCustomerId(newCust.id);
    setActiveDialNumber(newCust.caller_id);
    setShowNewCustomerForm(false);
    setNewCustName('');
    setNewCustPhone('');
  };

  // Cálculo de métricas rápidas
  const totalSaldoGestionado = customers.reduce((acc, c) => acc + (Number(c.saldo) || 0), 0);
  const totalEntregasPendientes = orders.filter(o => o.estado_entrega !== 'Entregado').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans text-slate-800">
      {/* Top Navbar Enterprise */}
      <header className="bg-slate-950 text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/90 shadow-lg sticky top-0 z-40 backdrop-blur-md">
        {/* Identidad del Sistema */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-2xl text-white shadow-md shadow-blue-500/20">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base tracking-tight text-white">ARM Core CRM</h1>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Asterisk 20 Ready
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Telefonía SIP • Screen-Pop • Outbound WebRTC • Direct VM</p>
          </div>
        </div>

        {/* Pestañas Principales de Navegación */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('crm')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === 'crm' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Panel CRM
            </button>

            <button
              onClick={() => setActiveTab('flow')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === 'flow' 
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Flujo Visual IVR
            </button>

            <button
              onClick={() => setActiveTab('monitor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === 'monitor' 
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Monitor Telefónico VM
            </button>

            <button
              onClick={() => setActiveTab('medical')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === 'medical' 
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" /> Consultas Médicas & Citas IA
            </button>

            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === 'campaigns' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" /> Campañas & DIDs
            </button>
          </div>
        </div>

        {/* Acciones Rápidas: Estado VM, Simulación Screen-Pop y Agente */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Botón de configuración de Máquina Virtual / Localhost */}
          <button
            onClick={() => setIsVMModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="Configuración de IP de la Máquina Virtual o Localhost"
          >
            <Server className="w-3.5 h-3.5 text-blue-400" />
            <span>VM: <strong className="font-mono text-emerald-400">{vmConfig.vmHost}</strong></span>
          </button>

          {/* Botón de Simulación de Citas Médicas (Opción 4) */}
          <button
            onClick={() => setActiveTab('medical')}
            className="bg-gradient-to-r from-teal-700 to-teal-800 hover:from-teal-600 hover:to-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="Abrir módulo de Consultas Médicas y Agendamiento con IA Gemini (Opción 4 IVR)"
          >
            <Stethoscope className="w-3.5 h-3.5 text-teal-300" /> Citas Médicas (Opción 4)
          </button>

          {/* Botón de Pop Outbound con Incidencia */}
          <button
            onClick={() => {
              const targetCallerId = activeDialNumber || '1001';
              const cust = customers.find(c => c.caller_id === targetCallerId) || activeCustomer;
              setScreenPopData({
                callerId: cust?.caller_id || targetCallerId,
                callType: 'saliente',
                folio: cust?.folio_cancelacion || `INC-${new Date().getFullYear()}-${cust?.caller_id || targetCallerId}`,
                reporte: cust?.estatus_tarjeta === 2
                  ? `Incidencia Outbound: Tarjeta Cancelada / Bloqueada (Folio: ${cust.folio_cancelacion || 'CAN-8821'}). Saldo bloqueado en IVR Asterisk.`
                  : `Reporte Outbound: Llamada de contacto y seguimiento comercial con ${cust?.nombre_completo || targetCallerId}.`
              });
            }}
            className="bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="Desplegar Screen-Pop Outbound con la incidencia o reporte de ese momento para el CallerID activo"
          >
            <PhoneOutgoing className="w-3.5 h-3.5 text-blue-200" /> Pop Outbound ({activeDialNumber})
          </button>

          {/* Botón de Simulación de Llamada Entrante (Screen-Pop Test) */}
          <button
            onClick={() => {
              const cust = customers.find(c => c.caller_id === '1001');
              setScreenPopData({
                callerId: '1001',
                callType: 'entrante',
                folio: cust?.folio_cancelacion || '2026-11-15-8821-1001',
                reporte: cust?.estatus_tarjeta === 2
                  ? 'Incidencia Entrante: El cliente tiene Tarjeta Cancelada (Estatus 2). Saldo bloqueado en IVR Asterisk.'
                  : 'Llamada entrante detectada en Asterisk IVR.'
              });
            }}
            className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="Simula llamada entrante desde la Extensión 1001 para disparar el Screen-Pop"
          >
            <Sparkles className="w-3.5 h-3.5" /> Simular Screen-Pop (1001)
          </button>

          {/* Estado del Agente */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800 text-xs text-slate-300">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span className="font-mono font-semibold">Ext. 2001 (Agente Online)</span>
          </div>
        </div>
      </header>

      {/* Franja de Métricas Rápidas KPI */}
      <section className="bg-white border-b border-slate-200/80 px-6 py-2.5">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-3.5 h-3.5" /></span>
              <span className="text-slate-500 font-medium">Clientes Activos:</span>
              <span className="font-bold text-slate-800">{customers.length}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign className="w-3.5 h-3.5" /></span>
              <span className="text-slate-500 font-medium">Saldo Total Gestionado:</span>
              <span className="font-bold text-emerald-700 font-mono">
                ${totalSaldoGestionado.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Package className="w-3.5 h-3.5" /></span>
              <span className="text-slate-500 font-medium">Entregas en Tránsito:</span>
              <span className="font-bold text-indigo-700">{totalEntregasPendientes}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><Activity className="w-3.5 h-3.5" /></span>
              <span className="text-slate-500 font-medium">Llamadas en Bitácora:</span>
              <span className="font-bold text-slate-800">{callLogs.length}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Infraestructura VM: PBX Asterisk + Middleware FastAPI Standalone</span>
          </div>
        </div>
      </section>

      {/* Contenedor Principal */}
      <main className="flex-1 p-6 max-w-[1700px] w-full mx-auto">
        {activeTab === 'flow' ? (
          <VisualIVRFlow />
        ) : activeTab === 'monitor' ? (
          <TelephonyMonitor />
        ) : activeTab === 'medical' ? (
          <MedicalConsultations onCallPatient={handleDirectOutboundCall} />
        ) : activeTab === 'campaigns' ? (
          <CampaignsManager
            onTestDialNumber={(did) => {
              setActiveTab('crm');
              setActiveDialNumber(did);
              setAutoStartCallTs(Date.now());
            }}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Directorio de Clientes (3 columnas) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" /> Directorio ({filteredCustomers.length})
                  </h3>
                  <button
                    onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Registrar nuevo cliente"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Formulario rápido de nuevo cliente */}
                {showNewCustomerForm && (
                  <form onSubmit={handleCreateCustomer} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs animate-in fade-in">
                    <span className="font-bold text-slate-700 block">Registrar Nuevo Contacto</span>
                    <input
                      type="text"
                      placeholder="Nombre del cliente"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                    <input
                      type="text"
                      placeholder="CallerID / Teléfono (ej. 1002)"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      required
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowNewCustomerForm(false)}
                        className="px-2.5 py-1 text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg shadow-xs"
                      >
                        Crear
                      </button>
                    </div>
                  </form>
                )}

                {/* Buscador Integrado */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por CallerID, nombre o tarjeta..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl pl-9 pr-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>

                {/* Lista de Clientes */}
                <div className="space-y-2 max-h-[660px] overflow-y-auto pr-1">
                  {filteredCustomers.map((cust) => {
                    const isSelected = cust.id === selectedCustomerId;
                    return (
                      <button
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomerId(cust.id);
                          setActiveDialNumber(cust.caller_id);
                        }}
                        className={`w-full text-left p-3.5 rounded-xl border transition group ${
                          isSelected
                            ? 'bg-blue-50/90 border-blue-500 shadow-sm ring-1 ring-blue-400'
                            : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs truncate max-w-[170px]">
                            {cust.nombre_completo}
                          </span>
                          <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md font-bold">
                            {cust.caller_id}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{cust.empresa}</p>
                        <div className="flex justify-between items-center text-[11px] text-slate-600 mt-2 font-medium">
                          <span className="text-[10px] text-slate-400">Saldo:</span>
                          <span className="text-emerald-700 font-bold font-mono">
                            ${cust.saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {filteredCustomers.length === 0 && (
                    <div className="py-8 text-center text-slate-400 text-xs italic">
                      No se encontraron contactos para "{searchQuery}"
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Columna Central: Perfil 360, Bitácora y Calendario (6 columnas) */}
            <div className="lg:col-span-6 space-y-6">
              <CustomerProfile
                customer={activeCustomer}
                onSaveCustomer={handleSaveCustomer}
                onCallNumber={handleDirectOutboundCall}
                onLogAdded={handleAddNote}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CallBitacora
                  logs={callLogs}
                  callerId={activeCustomer?.caller_id || ''}
                  onAddNote={handleAddNote}
                />

                <OrderCalendar
                  orders={orders}
                  customerId={activeCustomer?.id || ''}
                  onNotifyCustomer={handleNotifyCustomer}
                  onAddOrder={(newOrd) => setOrders(prev => [newOrd, ...prev])}
                />
              </div>
            </div>

            {/* Columna Derecha: Dialer SIP WebRTC Outbound & Tarjeta VM (3 columnas) */}
            <div className="lg:col-span-3 space-y-6">
              <WebRTCDialer
                currentPhoneNumber={activeDialNumber}
                autoStartCallTimestamp={autoStartCallTs}
                onCallInitiated={(num) => {
                  const cust = customers.find(c => c.caller_id === num);
                  const newLog: CallLog = {
                    id: `log-${Date.now()}`,
                    caller_id: num,
                    cliente_id: cust?.id || activeCustomer?.id,
                    tipo: 'saliente',
                    duracion_segundos: 0,
                    notas_agente: `Llamada saliente originada desde el CRM hacia número: ${num}`,
                    fecha_hora: new Date().toISOString()
                  };
                  setCallLogs(prev => [newLog, ...prev]);
                  setScreenPopData({
                    callerId: num,
                    callType: 'saliente',
                    folio: cust?.folio_cancelacion || `INC-${new Date().getFullYear()}-${num}`,
                    reporte: cust?.estatus_tarjeta === 2
                      ? `Llamada Outbound en curso: Gestión de Incidencia por Tarjeta Cancelada (Folio: ${cust.folio_cancelacion || 'CAN-8821'}).`
                      : `Llamada Outbound en curso hacia ${cust?.nombre_completo || num}.`
                  });
                }}
                onCallEnded={(dur) => {
                  if (activeCustomer) {
                    handleAddNote(`Llamada finalizada. Canal Asterisk liberado. Duración: ${dur} segundos.`);
                  }
                }}
              />

              {/* Tarjeta de Arquitectura VM Standalone */}
              <div className="bg-slate-950 text-slate-300 p-5 rounded-2xl border border-slate-800 text-xs space-y-3.5 shadow-xl">
                <div className="flex items-center justify-between text-white font-bold border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span>Despliegue VM Activo</span>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                    Port 5060 / 5038 / 8088
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  El sistema se encuentra configurado con Asterisk 20 nativo en la Máquina Virtual, con control directo vía AMI TCP y WebRTC.
                </p>
                <div className="space-y-1.5 font-mono text-[10px] text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>PBX: Asterisk 20 LTS (PJSIP + WebSockets)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>Control PBX: AMI Socket TCP (Puerto 5038)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>IVR & AGI: Python 3 REST (CBR + Citas)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Base de Datos: Supabase Cloud REST API</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Screen-Pop (Llamada entrante o saliente con incidencia del momento) */}
      <ScreenPopModal
        incomingCallerId={screenPopData?.callerId || null}
        customer={customers.find(c => c.caller_id === screenPopData?.callerId) || null}
        callType={screenPopData?.callType || 'saliente'}
        incidentFolio={screenPopData?.folio}
        incidentReport={screenPopData?.reporte}
        onAccept={handleAcceptScreenPop}
        onDismiss={() => setScreenPopData(null)}
        onSaveIncidentNotes={handleSaveIncidentNotes}
      />

      {/* Modal de Conexión de Máquina Virtual / Localhost */}
      <VMConnectionModal
        isOpen={isVMModalOpen}
        onClose={() => setIsVMModalOpen(false)}
        config={vmConfig}
        onUpdateConfig={(newCfg) => setVmConfig(newCfg)}
      />
    </div>
  );
}
