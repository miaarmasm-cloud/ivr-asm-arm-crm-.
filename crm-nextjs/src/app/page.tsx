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
  Megaphone,
  Lock,
  Unlock,
  Clock,
  Tag,
  AlertTriangle,
  UserPlus
} from 'lucide-react';

// Datos semilla de inicio para pruebas inmediatas
const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    caller_id: '1001',
    nombre_completo: 'Anto Krpaz X',
    empresa: 'Logística & Distribución S.A.',
    direccion: 'Av. Reforma 222, Piso 14, Cuauhtémoc, CDMX',
    numero_tarjeta_mask: '**** **** **** 8821',
    saldo: 14850.50,
    estatus_tarjeta: 2,
    folio_cancelacion: '2026-11-15-8821-1001',
    motivo_cancelacion: 'Cancelación solicitada por cliente en IVR',
    fecha_cancelacion: '2026-11-15T20:00:00.000Z',
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
    caller_id: '1002',
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
    caller_id: '7711100921',
    nombre_completo: 'Lic. Gabriel Morales Ramos',
    empresa: 'Soluciones Morales & Asoc.',
    direccion: 'Insurgentes Sur 1602, Crédito Constructor, Benito Juárez, CDMX',
    numero_tarjeta_mask: '**** **** **** 7744',
    saldo: 38500.00,
    estatus_tarjeta: 2,
    folio_cancelacion: '2026-11-16-7744-0921',
    motivo_cancelacion: 'Cancelación preventiva de tarjeta por reporte de extravío',
    fecha_cancelacion: '2026-11-16T00:30:00.000Z',
    email: 'gabriel.morales@morales-asoc.mx',
    telefonos_adicionales: ['11100921', '+525544332211'],
    fecha_nacimiento: '1980-04-12',
    agente_asignado: 'Agente Demo 1',
    compras_previas: [
      { item: 'Póliza Médica Familiar Premium', fecha: '2026-01-15', total: 18500.00 },
      { item: 'Consulta Especialista Cardiología', fecha: '2026-02-10', total: 2000.00 }
    ]
  }
];

const INITIAL_LOGS: CallLog[] = [
  {
    id: 'log-1',
    caller_id: '1001',
    tipo: 'entrante',
    duracion_segundos: 184,
    opcion_ivr_seleccionada: '2. Cancelación',
    resumen_ia: 'El cliente Anto Krpaz X gestionó cancelación de tarjeta. Se generó folio oficial 2026-11-15-8821-1001 y su saldo quedó protegido.',
    notas_agente: 'Cliente solicita atención para aclarar el motivo y posible desbloqueo.',
    fecha_hora: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'log-2',
    caller_id: '7711100921',
    tipo: 'entrante',
    duracion_segundos: 120,
    opcion_ivr_seleccionada: '2. Cancelación',
    resumen_ia: 'Llamada simulada PSTN 7711100921. Cliente Lic. Gabriel Morales Ramos con tarjeta cancelada (Folio 2026-11-16-7744-0921).',
    notas_agente: 'En espera de aclaración para reactivación a Estatus 1.',
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
    cliente_id: 'c3',
    folio_pedido: 'PED-2026-7711',
    descripcion_compra: 'Medicamentos Antihipertensivos y Kit de Monitoreo Presión Digital',
    monto_total: 3200.00,
    fecha_pedido: '2026-02-14',
    fecha_estimada_entrega: '2026-02-17',
    estado_entrega: 'En preparación',
    notificado_al_cliente: false,
    notas_entrega: 'Entrega prioritaria a domicilio del paciente'
  }
];

type DirectoryTab = 'todos' | 'recientes' | 'leads' | 'activos' | 'canceladas';

export default function CRMPage() {
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('c1');
  const [callLogs, setCallLogs] = useState<CallLog[]>(INITIAL_LOGS);
  const [orders, setOrders] = useState<OrderDelivery[]>(INITIAL_ORDERS);
  
  // Búsqueda ligada en vivo a la Base de Datos (SELECT con debounce)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [dbSearchResults, setDbSearchResults] = useState<Customer[] | null>(null);

  // Filtro de pestañas del Directorio Lateral
  const [directoryTab, setDirectoryTab] = useState<DirectoryTab>('todos');

  // Cola de CallerIDs entrantes o atendidos recientemente para ordenamiento
  const [recentIncomingCallers, setRecentIncomingCallers] = useState<string[]>(['7711100921', '1001']);
  
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

  // Pestaña activa principal: 'crm' | 'flow' | 'monitor' | 'medical' | 'campaigns'
  const [activeTab, setActiveTab] = useState<'crm' | 'flow' | 'monitor' | 'medical' | 'campaigns'>('crm');

  // Modal de configuración VM / Localhost
  const [isVMModalOpen, setIsVMModalOpen] = useState(false);
  const [vmConfig, setVmConfig] = useState<VMConnectionConfig>(getVMConfig());

  // Formulario rápido para nuevo cliente / lead
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || 
    (dbSearchResults ? dbSearchResults.find(c => c.id === selectedCustomerId) : null) || null;

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
            // Si hay cliente cancelado o con llamada reciente, seleccionarlo
            const initialTarget = dbCustomers.find(c => c.estatus_tarjeta === 2) || dbCustomers[0];
            setSelectedCustomerId(initialTarget.id);
            setActiveDialNumber(initialTarget.caller_id);
          }

          const { data: dbLogs } = await supabase
            .from('llamadas_bitacora')
            .select('*')
            .order('fecha_hora', { ascending: false })
            .limit(20);
          
          if (dbLogs && dbLogs.length > 0) {
            setCallLogs(dbLogs);
            // Extraer callers recientes de la bitácora
            const callersFromLogs = Array.from(new Set(dbLogs.map(l => l.caller_id).filter(Boolean)));
            if (callersFromLogs.length > 0) {
              setRecentIncomingCallers(callersFromLogs);
            }
          }
        } catch (e) {
          console.error('Error cargando datos de Supabase:', e);
        }
      }
    }
    loadInitialData();
  }, []);

  // Búsqueda reactiva ligada a la base de datos (SELECT) con Debounce
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setDbSearchResults(null);
      setIsSearchingDb(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (isSupabaseConfigured()) {
        setIsSearchingDb(true);
        try {
          const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .or(`caller_id.ilike.%${q}%,nombre_completo.ilike.%${q}%,empresa.ilike.%${q}%,numero_tarjeta_mask.ilike.%${q}%,folio_cancelacion.ilike.%${q}%`)
            .order('updated_at', { ascending: false })
            .limit(25);
          
          if (data) {
            setDbSearchResults(data);
          }
        } catch (err) {
          console.error('Error en SELECT de búsqueda Supabase:', err);
        } finally {
          setIsSearchingDb(false);
        }
      } else {
        // Fallback local
        const filtered = customers.filter(c =>
          c.caller_id.toLowerCase().includes(q.toLowerCase()) ||
          c.nombre_completo.toLowerCase().includes(q.toLowerCase()) ||
          c.empresa.toLowerCase().includes(q.toLowerCase()) ||
          c.numero_tarjeta_mask.toLowerCase().includes(q.toLowerCase()) ||
          (c.folio_cancelacion && c.folio_cancelacion.toLowerCase().includes(q.toLowerCase()))
        );
        setDbSearchResults(filtered);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, customers]);

  // Escuchar eventos en tiempo real de Supabase (llamadas entrantes y actualizaciones)
  useEffect(() => {
    if (isSupabaseConfigured()) {
      const channel = supabase
        .channel('realtime_calls')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'llamadas_bitacora' },
          async (payload: any) => {
            const newLog = payload.new as CallLog;
            setCallLogs(prev => [newLog, ...prev]);

            const callerId = newLog.caller_id;
            const cleanCaller = callerId?.startsWith('77') ? callerId.substring(2) : callerId;

            if (callerId) {
              setRecentIncomingCallers(prev => [callerId, cleanCaller, ...prev.filter(id => id !== callerId && id !== cleanCaller)]);
            }

            if (newLog.tipo === 'entrante' && callerId) {
              // Buscar cliente en Supabase con soporte de normalización de prefijo 77
              let targetCustomer = customers.find(c => c.caller_id === callerId || c.caller_id === cleanCaller);
              if (!targetCustomer) {
                try {
                  const { data: dbCusts } = await supabase
                    .from('clientes')
                    .select('*')
                    .or(`caller_id.eq.${callerId},caller_id.eq.${cleanCaller}`);
                  if (dbCusts && dbCusts.length > 0) {
                    targetCustomer = dbCusts[0];
                    setCustomers(prev => [targetCustomer!, ...prev.filter(c => c.id !== targetCustomer!.id)]);
                  }
                } catch (e) {
                  console.warn('Error resolviendo cliente en tiempo real:', e);
                }
              }

              setScreenPopData({
                callerId: callerId,
                callType: 'entrante',
                folio: targetCustomer?.folio_cancelacion || newLog.folio_cancelacion || `INC-IN-${callerId}`,
                reporte: targetCustomer?.estatus_tarjeta === 2
                  ? `Atención Agente: Cliente ${targetCustomer.nombre_completo} cuenta con Tarjeta Cancelada (Estatus 2, Folio: ${targetCustomer.folio_cancelacion || 'CAN'}). Saldo bloqueado en IVR. Requiere atención y aclaración.`
                  : (newLog.resumen_ia || 'Llamada entrante canalizada desde Asterisk IVR hacia agente')
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

  // Manejar Screen-Pop al atender la llamada o desplegar ficha (con consulta asíncrona a Supabase)
  const handleAcceptScreenPop = async (callerId: string) => {
    const cleanCaller = callerId.startsWith('77') ? callerId.substring(2) : callerId;
    
    // 1. Buscar en memoria local primero
    let customer = customers.find(c => 
      c.caller_id === callerId || 
      c.caller_id === cleanCaller || 
      (cleanCaller && c.caller_id === `77${cleanCaller}`)
    );

    // 2. Si no está en memoria o es un placeholder previo con saldo 0, consultar a Supabase
    if ((!customer || customer.saldo === 0) && isSupabaseConfigured()) {
      try {
        const { data: dbMatches } = await supabase
          .from('clientes')
          .select('*')
          .or(`caller_id.eq.${callerId},caller_id.eq.${cleanCaller}`);
        
        if (dbMatches && dbMatches.length > 0) {
          customer = dbMatches[0];
          setCustomers(prev => {
            const filtered = prev.filter(c => c.id !== customer!.id && c.caller_id !== callerId && c.caller_id !== cleanCaller);
            return [customer!, ...filtered];
          });
        }
      } catch (err) {
        console.warn('Error buscando callerId en Supabase:', err);
      }
    }

    // 3. Si aún así no existe en base de datos, crear lead nuevo para registro
    if (!customer) {
      customer = {
        id: `c-${Date.now()}`,
        caller_id: callerId,
        nombre_completo: `Cliente Nuevo (${callerId})`,
        empresa: 'Empresa por registrar',
        direccion: 'Por capturar',
        numero_tarjeta_mask: '**** **** **** 0000',
        saldo: 0.00,
        estatus_tarjeta: 1,
        email: `${callerId}@contacto.mx`,
        telefonos_adicionales: [],
        fecha_nacimiento: '2000-01-01',
        agente_asignado: 'Agente Demo 1',
        compras_previas: []
      };
      setCustomers(prev => [customer!, ...prev]);
    }

    // Colocar al inicio de la lista de recientes
    setRecentIncomingCallers(prev => [callerId, cleanCaller, ...prev.filter(id => id !== callerId && id !== cleanCaller)]);
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
    if (dbSearchResults) {
      setDbSearchResults(prev => prev ? prev.map(c => c.id === updated.id ? updated : c) : null);
    }
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
            folio_cancelacion: updated.folio_cancelacion || null,
            motivo_cancelacion: updated.motivo_cancelacion || null,
            saldo: updated.saldo,
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
        ? `Llamada Outbound: Gestión de Aclaración por Tarjeta Cancelada (Folio: ${cust.folio_cancelacion || 'CAN'}). Saldo bloqueado en IVR Asterisk.`
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
        resumen_ia: 'Notificación automática enviada al cliente confirmando fecha estimada de entrega.',
        fecha_hora: new Date().toISOString()
      };
      setCallLogs(prev => [notifyLog, ...prev]);
    }
  };

  // Crear nuevo cliente / lead y guardar en Supabase
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustPhone.trim()) return;
    const phone = newCustPhone.trim();
    const newCust: Customer = {
      id: `c-${Date.now()}`,
      caller_id: phone,
      nombre_completo: newCustName.trim() || `Contacto ${phone}`,
      empresa: 'Empresa General',
      direccion: 'Dirección por registrar',
      numero_tarjeta_mask: `**** **** **** ${Math.floor(1000 + Math.random() * 9000)}`,
      saldo: 5000.00,
      estatus_tarjeta: 1,
      email: `${phone}@empresa.com`,
      telefonos_adicionales: [],
      fecha_nacimiento: '1990-01-01',
      agente_asignado: 'Agente Demo 1',
      compras_previas: []
    };

    setCustomers(prev => [newCust, ...prev]);
    setRecentIncomingCallers(prev => [phone, ...prev.filter(id => id !== phone)]);
    setSelectedCustomerId(newCust.id);
    setActiveDialNumber(newCust.caller_id);
    setShowNewCustomerForm(false);
    setNewCustName('');
    setNewCustPhone('');

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('clientes').insert({
          caller_id: newCust.caller_id,
          nombre_completo: newCustName.trim() || `Contacto ${phone}`,
          empresa: newCust.empresa,
          direccion: newCust.direccion,
          numero_tarjeta_mask: newCust.numero_tarjeta_mask,
          saldo: newCust.saldo,
          estatus_tarjeta: 1,
          email: newCust.email,
          agente_asignado: newCust.agente_asignado
        });
      } catch (err) {
        console.warn('Error insertando cliente en Supabase:', err);
      }
    }
  };

  // Métricas y conteos por categoría
  const countTotal = customers.length;
  const countCanceladas = customers.filter(c => c.estatus_tarjeta === 2).length;
  const countLeads = customers.filter(c => (c.saldo === 0 || c.nombre_completo.toLowerCase().includes('cliente nuevo')) && c.estatus_tarjeta !== 2).length;
  const countActivos = customers.filter(c => (c.estatus_tarjeta ?? 1) === 1 && !c.nombre_completo.toLowerCase().includes('cliente nuevo') && c.saldo > 0).length;
  const countRecientes = recentIncomingCallers.length;

  // Filtrado y ordenamiento del directorio
  let displayedCustomers: Customer[] = [];

  if (dbSearchResults !== null) {
    // Si hay una búsqueda activa ligada a Supabase, mostrar esos resultados
    displayedCustomers = dbSearchResults;
  } else {
    // Si no hay búsqueda de texto, aplicar filtro de pestaña
    let tabFiltered = [...customers];
    if (directoryTab === 'canceladas') {
      tabFiltered = tabFiltered.filter(c => c.estatus_tarjeta === 2);
    } else if (directoryTab === 'leads') {
      tabFiltered = tabFiltered.filter(c => (c.saldo === 0 || c.nombre_completo.toLowerCase().includes('cliente nuevo')) && c.estatus_tarjeta !== 2);
    } else if (directoryTab === 'activos') {
      tabFiltered = tabFiltered.filter(c => (c.estatus_tarjeta ?? 1) === 1 && !c.nombre_completo.toLowerCase().includes('cliente nuevo') && c.saldo > 0);
    } else if (directoryTab === 'recientes') {
      tabFiltered = tabFiltered.filter(c => 
        recentIncomingCallers.includes(c.caller_id) || 
        (c.caller_id.startsWith('77') && recentIncomingCallers.includes(c.caller_id.substring(2)))
      );
    }

    // Ordenar de forma que los clientes con llamadas recientes o entrantes aparezcan PRIMERO
    displayedCustomers = tabFiltered.sort((a, b) => {
      const idxA = recentIncomingCallers.indexOf(a.caller_id);
      const idxB = recentIncomingCallers.indexOf(b.caller_id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      // Si ambos tienen el mismo estatus de llamada, priorizar tarjetas canceladas para atención
      if (a.estatus_tarjeta === 2 && b.estatus_tarjeta !== 2) return -1;
      if (b.estatus_tarjeta === 2 && a.estatus_tarjeta !== 2) return 1;
      return 0;
    });
  }

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

        {/* Módulos / Pestañas de Navegación */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
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

        {/* Acciones Rápidas: Estado VM, Simulación Screen-Pop y Agente */}
        <div className="flex items-center gap-2.5 flex-wrap">
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
          >
            <Stethoscope className="w-3.5 h-3.5 text-teal-300" /> Citas Médicas (Opción 4)
          </button>

          {/* Botón de Simulación PSTN 7711100921 */}
          <button
            onClick={() => {
              handleAcceptScreenPop('7711100921');
              setScreenPopData({
                callerId: '7711100921',
                callType: 'entrante',
                folio: '2026-11-16-7744-0921',
                reporte: 'Llamada entrante PSTN simulada (7711100921). Lic. Gabriel Morales Ramos (Tarjeta Cancelada Estatus 2 - Folio 2026-11-16-7744-0921). Requiere atención de agente para aclaración y desbloqueo.'
              });
            }}
            className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="Simular llamada entrante PSTN con prefijo 77 (Lic. Gabriel Morales)"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" /> PSTN (7711100921)
          </button>

          {/* Botón de Simulación Screen-Pop 1001 (Anto Krpaz X) */}
          <button
            onClick={() => {
              handleAcceptScreenPop('1001');
              setScreenPopData({
                callerId: '1001',
                callType: 'entrante',
                folio: '2026-11-15-8821-1001',
                reporte: 'Incidencia Entrante: Anto Krpaz X (Extensión 1001) tiene Tarjeta Cancelada (Estatus 2 - Folio 2026-11-15-8821-1001). Saldo bloqueado en IVR Asterisk.'
              });
            }}
            className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="Simular llamada entrante desde la Extensión 1001 (Tarjeta Cancelada)"
          >
            <Sparkles className="w-3.5 h-3.5" /> Pop 1001 (Cancelada)
          </button>

          {/* Pop Outbound con Incidencia */}
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
          >
            <PhoneOutgoing className="w-3.5 h-3.5 text-blue-200" /> Pop Outbound ({activeDialNumber})
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
              <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><Lock className="w-3.5 h-3.5" /></span>
              <span className="text-slate-500 font-medium">Tarjetas Canceladas:</span>
              <span className="font-bold text-rose-700 font-mono">{countCanceladas}</span>
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
            <span>Infraestructura VM: PBX Asterisk + Middleware FastAPI + Supabase REST</span>
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
            {/* Columna Izquierda: Directorio Ordenado y Búsqueda en Base de Datos (3 columnas) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" /> Directorio de Clientes
                  </h3>
                  <button
                    onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
                    title="Dar de alta nuevo lead / cliente"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nuevo Lead
                  </button>
                </div>

                {/* Formulario rápido de nuevo cliente */}
                {showNewCustomerForm && (
                  <form onSubmit={handleCreateCustomer} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs animate-in fade-in">
                    <span className="font-bold text-slate-700 block">Registrar Nuevo Lead / Contacto</span>
                    <input
                      type="text"
                      placeholder="Nombre del cliente"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                    <input
                      type="text"
                      placeholder="CallerID / Teléfono (ej. 7711100921)"
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
                        Guardar Lead
                      </button>
                    </div>
                  </form>
                )}

                {/* Buscador Integrado Ligado a Supabase (SELECT) */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por CallerID, nombre o tarjeta..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl pl-9 pr-8 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-medium"
                  />
                  {isSearchingDb && (
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin absolute right-3 top-2.5" />
                  )}
                </div>

                {/* Pestañas de Filtrado del Directorio */}
                {!searchQuery && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-bold border-b border-slate-100">
                    <button
                      onClick={() => setDirectoryTab('todos')}
                      className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                        directoryTab === 'todos' 
                          ? 'bg-slate-900 text-white shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      Todos ({countTotal})
                    </button>
                    <button
                      onClick={() => setDirectoryTab('canceladas')}
                      className={`px-2 py-1 rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
                        directoryTab === 'canceladas' 
                          ? 'bg-rose-600 text-white shadow-xs' 
                          : 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                      }`}
                      title="Tarjetas bloqueadas en Estatus 2"
                    >
                      <Lock className="w-3 h-3" /> Canceladas ({countCanceladas})
                    </button>
                    <button
                      onClick={() => setDirectoryTab('leads')}
                      className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                        directoryTab === 'leads' 
                          ? 'bg-amber-600 text-white shadow-xs' 
                          : 'text-amber-700 hover:bg-amber-50'
                      }`}
                    >
                      Leads ({countLeads})
                    </button>
                    <button
                      onClick={() => setDirectoryTab('activos')}
                      className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                        directoryTab === 'activos' 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      Activos ({countActivos})
                    </button>
                    <button
                      onClick={() => setDirectoryTab('recientes')}
                      className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                        directoryTab === 'recientes' 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : 'text-blue-700 hover:bg-blue-50'
                      }`}
                    >
                      Recientes ({countRecientes})
                    </button>
                  </div>
                )}

                {/* Aviso de Búsqueda Activa en Base de Datos */}
                {dbSearchResults !== null && (
                  <div className="flex items-center justify-between text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200">
                    <span>Resultados SELECT en BD ({dbSearchResults.length}):</span>
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="text-slate-400 hover:text-slate-600 font-normal"
                    >
                      Limpiar
                    </button>
                  </div>
                )}

                {/* Lista de Clientes Ordenada */}
                <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                  {displayedCustomers.map((cust) => {
                    const isSelected = cust.id === selectedCustomerId;
                    const isCancelled = cust.estatus_tarjeta === 2;
                    const isNewLead = cust.saldo === 0 || cust.nombre_completo.toLowerCase().includes('cliente nuevo');
                    const isRecent = recentIncomingCallers.includes(cust.caller_id) || 
                      (cust.caller_id.startsWith('77') && recentIncomingCallers.includes(cust.caller_id.substring(2)));

                    return (
                      <button
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomerId(cust.id);
                          setActiveDialNumber(cust.caller_id);
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition group relative ${
                          isSelected
                            ? isCancelled 
                              ? 'bg-rose-50/90 border-rose-500 shadow-sm ring-1 ring-rose-400'
                              : 'bg-blue-50/90 border-blue-500 shadow-sm ring-1 ring-blue-400'
                            : isCancelled
                              ? 'bg-rose-50/40 hover:bg-rose-50 border-rose-200'
                              : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200/80'
                        }`}
                      >
                        {/* Cabecera del Item: Nombre y Badges */}
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-slate-800 text-xs truncate max-w-[150px]">
                            {cust.nombre_completo}
                          </span>
                          <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md font-bold shrink-0">
                            {cust.caller_id}
                          </span>
                        </div>

                        {/* Subtítulo y Empresa */}
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{cust.empresa}</p>

                        {/* Badges de Estado y Folio */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {isCancelled ? (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 border border-rose-300 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> CANCELADA (2)
                            </span>
                          ) : isNewLead ? (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              NUEVO LEAD
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ACTIVA (1)
                            </span>
                          )}

                          {isRecent && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" /> En Llamada / Reciente
                            </span>
                          )}
                        </div>

                        {/* Folio de Cancelación si existe */}
                        {isCancelled && cust.folio_cancelacion && (
                          <p className="text-[10px] text-rose-700 font-mono font-bold truncate mt-1">
                            Folio: {cust.folio_cancelacion}
                          </p>
                        )}

                        {/* Saldo Registrado */}
                        <div className="flex justify-between items-center text-[11px] text-slate-600 mt-2 font-medium border-t border-slate-100 pt-1.5">
                          <span className="text-[10px] text-slate-400">Saldo Registrado:</span>
                          <span className={`font-bold font-mono ${isCancelled ? 'text-rose-700 line-through' : 'text-emerald-700'}`}>
                            ${Number(cust.saldo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {displayedCustomers.length === 0 && (
                    <div className="py-8 text-center text-slate-400 text-xs italic space-y-1">
                      <p>No se encontraron registros {searchQuery ? `para "${searchQuery}"` : 'en esta categoría'}.</p>
                      {directoryTab === 'canceladas' && (
                        <p className="text-[11px] text-slate-500">No hay tarjetas con bloqueo de Estatus 2.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Columna Central: Perfil 360 con Gestión de Desbloqueo, Bitácora y Calendario (6 columnas) */}
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
                    cliente_id: cust?.id || undefined,
                    tipo: 'saliente',
                    estado: 'en_curso',
                    duracion_segundos: 0,
                    opcion_ivr_seleccionada: 'Marcación WebRTC Outbound',
                    resumen_ia: `Llamada saliente iniciada hacia ${num} (${cust?.nombre_completo || 'Destino Directo'})`,
                    fecha_hora: new Date().toISOString()
                  };
                  setCallLogs(prev => [newLog, ...prev]);
                  setRecentIncomingCallers(prev => [num, ...prev.filter(id => id !== num)]);
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* Modal de Screen-Pop para Atención de Llamadas */}
      {screenPopData && (
        <ScreenPopModal
          callerId={screenPopData.callerId}
          callType={screenPopData.callType}
          initialFolio={screenPopData.folio}
          initialReporte={screenPopData.reporte}
          onAccept={() => handleAcceptScreenPop(screenPopData.callerId)}
          onClose={() => setScreenPopData(null)}
          onSaveNotes={(notes) => handleSaveIncidentNotes(screenPopData.callerId, notes)}
        />
      )}

      {/* Modal de Configuración VM / Localhost */}
      {isVMModalOpen && (
        <VMConnectionModal
          isOpen={isVMModalOpen}
          onClose={() => setIsVMModalOpen(false)}
          onConfigSaved={(newCfg) => setVmConfig(newCfg)}
        />
      )}
    </div>
  );
}
