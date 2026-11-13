'use client';

import React, { useState, useEffect } from 'react';
import CustomerProfile from '@/components/CustomerProfile';
import CallBitacora from '@/components/CallBitacora';
import OrderCalendar from '@/components/OrderCalendar';
import WebRTCDialer from '@/components/WebRTCDialer';
import ScreenPopModal from '@/components/ScreenPopModal';
import VisualIVRFlow from '@/components/VisualIVRFlow';
import { Customer, CallLog, OrderDelivery } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { Phone, Search, Users, Sparkles, PhoneCall, AlertCircle, RefreshCw, Layers, LayoutDashboard } from 'lucide-react';

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
    email: 'mariana.gomez@norte.com.mx',
    telefonos_adicionales: ['+528112233445'],
    fecha_nacimiento: '1992-11-20',
    agente_asignado: 'Agente Demo 1',
    compras_previas: [
      { item: 'Servidor PBX Asterisk 20 Cloud', fecha: '2026-02-01', total: 5200.00 }
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
  }
];

export default function CRMPage() {
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('c1');
  const [callLogs, setCallLogs] = useState<CallLog[]>(INITIAL_LOGS);
  const [orders, setOrders] = useState<OrderDelivery[]>(INITIAL_ORDERS);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estado para Screen-Pop (Llamada entrante)
  const [incomingCall, setIncomingCall] = useState<string | null>(null);
  
  // Número activo en el dialer
  const [activeDialNumber, setActiveDialNumber] = useState('1001');

  // Pestaña activa: 'crm' (Panel del Operador) o 'flow' (Diseñador Visual del Middleware)
  const [activeTab, setActiveTab] = useState<'crm' | 'flow'>('crm');

  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || null;

  // Escuchar eventos en tiempo real de Supabase si está configurado
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
              setIncomingCall(newLog.caller_id);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  // Filtrar clientes
  const filteredCustomers = customers.filter(c => 
    c.caller_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.empresa.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Manejar Screen-Pop al aceptar la llamada
  const handleAcceptIncomingCall = (callerId: string) => {
    let customer = customers.find(c => c.caller_id === callerId);
    if (!customer) {
      // Crear nuevo cliente al vuelo si no existe
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
    setIncomingCall(null);
  };

  const handleSaveCustomer = (updated: Customer) => {
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
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

  const handleNotifyCustomer = (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, notificado_al_cliente: true } : o));
    if (activeCustomer) {
      const notifyLog: CallLog = {
        id: `log-${Date.now()}`,
        caller_id: activeCustomer.caller_id,
        cliente_id: activeCustomer.id,
        tipo: 'saliente',
        duracion_segundos: 0,
        resumen_ia: 'Notificación automática enviada al cliente confirmando fecha estimada de entrega.',
        fecha_hora: new Date().toISOString()
      };
      setCallLogs(prev => [notifyLog, ...prev]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight">ARM Core CRM</h1>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                SIP & AI Ready
              </span>
            </div>
            <p className="text-[11px] text-slate-400">IVR Asterisk 20 + Screen-Pop + Outbound WebRTC</p>
          </div>
        </div>

        {/* Buscador de Clientes por CallerID */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setActiveTab('crm')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                activeTab === 'crm' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Panel CRM
            </button>
            <button
              onClick={() => setActiveTab('flow')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                activeTab === 'flow' 
                  ? 'bg-purple-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Flujo Visual IVR
            </button>
          </div>

          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por CallerID..."
              className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Botón de Simulación de Llamada Entrante (Screen-Pop Test) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIncomingCall('1001')}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition"
            title="Simula que la extensión 1001 llama al PBX para probar el Screen-Pop"
          >
            <Sparkles className="w-3.5 h-3.5" /> Simular Screen-Pop (1001)
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-800 text-xs text-slate-300">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span>Ext. 2001 (Agente Online)</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-[1700px] w-full mx-auto">
        {activeTab === 'flow' ? (
          <VisualIVRFlow />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Selector de Clientes (3 columnas) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" /> Clientes con CallerID ({filteredCustomers.length})
                </h3>
                <div className="space-y-2 max-h-[700px] overflow-y-auto">
                  {filteredCustomers.map((cust) => {
                    const isSelected = cust.id === selectedCustomerId;
                    return (
                      <button
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomerId(cust.id);
                          setActiveDialNumber(cust.caller_id);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-500 shadow-sm'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs">{cust.nombre_completo}</span>
                          <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                            {cust.caller_id}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{cust.empresa}</p>
                        <div className="flex justify-between items-center text-[11px] text-slate-600 mt-2 font-medium">
                          <span>Saldo:</span>
                          <span className="text-emerald-700 font-bold">${cust.saldo.toFixed(2)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Columna Central: Perfil, Bitácora y Calendario (6 columnas) */}
            <div className="lg:col-span-6 space-y-6">
              <CustomerProfile
                customer={activeCustomer}
                onSaveCustomer={handleSaveCustomer}
                onCallNumber={(phone) => setActiveDialNumber(phone)}
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
                />
              </div>
            </div>

            {/* Columna Derecha: Dialer SIP WebRTC Outbound (3 columnas) */}
            <div className="lg:col-span-3 space-y-6">
              <WebRTCDialer
                currentPhoneNumber={activeDialNumber}
                onCallInitiated={(num) => {
                  const newLog: CallLog = {
                    id: `log-${Date.now()}`,
                    caller_id: num,
                    cliente_id: activeCustomer?.id,
                    tipo: 'saliente',
                    duracion_segundos: 0,
                    notas_agente: 'Llamada saliente iniciada desde el CRM hacia número de destino.',
                    fecha_hora: new Date().toISOString()
                  };
                  setCallLogs(prev => [newLog, ...prev]);
                }}
                onCallEnded={(duration) => {
                  if (activeCustomer) {
                    const note = `Llamada finalizada. Duración: ${duration} segundos.`;
                    handleAddNote(note);
                  }
                }}
              />

              {/* Tarjeta Informativa de Integración Asterisk + Supabase */}
              <div className="bg-slate-900 text-slate-300 p-5 rounded-xl border border-slate-800 text-xs space-y-3">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Conexión Nube & Asterisk</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  El PBX es únicamente la central telefónica (SIP switch). Toda la lógica de menús visuales, saldos y base de datos reside de forma independiente en el Middleware.
                </p>
                <div className="pt-2 border-t border-slate-800 space-y-1 font-mono text-[10px]">
                  <div>• PBX: Solo Central Telefónica (SIP Trunk / Softphones)</div>
                  <div>• Middleware: Flujo IVR Visual + Base de Datos</div>
                  <div>• Protocolo entre ambos: SIP REFER / WebSockets</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Screen-Pop (Llamada entrante) */}
      <ScreenPopModal
        incomingCallerId={incomingCall}
        customer={customers.find(c => c.caller_id === incomingCall) || null}
        onAccept={handleAcceptIncomingCall}
        onDismiss={() => setIncomingCall(null)}
      />
    </div>
  );
}
