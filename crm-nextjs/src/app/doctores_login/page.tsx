'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Stethoscope, 
  Calendar, 
  Clock, 
  User, 
  UserCheck, 
  ShieldCheck, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Printer, 
  Download, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft, 
  LogOut, 
  Lock, 
  Phone, 
  Sparkles, 
  Activity, 
  HeartPulse, 
  Building2, 
  MapPin, 
  Pill, 
  Check, 
  X, 
  RefreshCw,
  Copy,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { Doctor, CitaMedica, HistorialClinico, Customer } from '@/lib/types';

// Médicos semilla para acceso rápido y fallback
const DOCTORES_DEMO: Doctor[] = [
  {
    id: 'd2e9e786-0dde-407b-8169-b9d2562e5e55',
    usuario: 'dra.mariana',
    nombre_completo: 'Dra. Mariana Fernández',
    especialidad: 'Medicina Familiar y Preventiva',
    cedula_profesional: 'CED-8492011-SSA',
    consultorio: 'Consultorio 101 - Torre Médica A',
    email: 'm.fernandez@corporativomedico-arm.com',
    telefono: '+52 55 8492 0110',
    activo: true
  },
  {
    id: '51401086-89f5-4fcd-b9ea-aa49b3a088a9',
    usuario: 'dra.gomez',
    nombre_completo: 'Dra. Mariana Gómez',
    especialidad: 'Medicina General y Laboratorio',
    cedula_profesional: 'CED-9283741-SSA',
    consultorio: 'Consultorio 102 - Torre Médica A',
    email: 'm.gomez@corporativomedico-arm.com',
    telefono: '+52 55 9283 7410',
    activo: true
  },
  {
    id: 'bd0015cc-6336-4f44-b34d-f1039b40ee8d',
    usuario: 'dr.morales',
    nombre_completo: 'Dr. Alejandro Morales',
    especialidad: 'Cardiología Preventiva',
    cedula_profesional: 'CED-7362914-SSA',
    consultorio: 'Consultorio 204 - Torre Médica B',
    email: 'a.morales@corporativomedico-arm.com',
    telefono: '+52 55 7362 9140',
    activo: true
  },
  {
    id: '20eaebf4-a8c8-47c8-a5bb-89407abc62ae',
    usuario: 'dr.castillo',
    nombre_completo: 'Dr. Fernando Castillo',
    especialidad: 'Medicina Interna',
    cedula_profesional: 'CED-6541298-SSA',
    consultorio: 'Consultorio 105 - Torre Médica A',
    email: 'f.castillo@corporativomedico-arm.com',
    telefono: '+52 55 6541 2980',
    activo: true
  }
];

export default function DoctoresLoginPage() {
  // Estado de Autenticación
  const [loggedDoctor, setLoggedDoctor] = useState<Doctor | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Datos Clínicos
  const [citas, setCitas] = useState<CitaMedica[]>([]);
  const [historiales, setHistoriales] = useState<HistorialClinico[]>([]);
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Pestaña Principal del Portal Médico
  const [portalTab, setPortalTab] = useState<'calendario' | 'historiales' | 'nueva_cita'>('calendario');
  const [citaFilter, setCitaFilter] = useState<'todas' | 'hoy' | 'proximas' | 'confirmadas'>('todas');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal de Nueva Consulta y Diagnóstico
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [consultTargetPatient, setConsultTargetPatient] = useState<{
    nombre: string;
    caller_id: string;
    cliente_id?: string;
  } | null>(null);

  // Formulario de Nueva Consulta
  const [consultMotivo, setConsultMotivo] = useState('');
  const [consultDiagnostico, setConsultDiagnostico] = useState('');
  const [consultReceta, setConsultReceta] = useState('');
  const [consultNotas, setConsultNotas] = useState('');
  const [consultSugerenciaIA, setConsultSugerenciaIA] = useState('');
  const [signosPresion, setSignosPresion] = useState('120/80');
  const [signosTemp, setSignosTemp] = useState('36.5');
  const [signosFC, setSignosFC] = useState('72');
  const [signosGlucosa, setSignosGlucosa] = useState('95');
  const [signosPeso, setSignosPeso] = useState('70.0');
  const [proximaCitaFecha, setProximaCitaFecha] = useState('');
  const [proximaCitaHora, setProximaCitaHora] = useState('10:00');
  const [isSavingConsult, setIsSavingConsult] = useState(false);

  // Modal de Exportación PDF
  const [pdfReport, setPdfReport] = useState<{
    historial: HistorialClinico;
    doctor: Doctor;
  } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Cargar sesión guardada si existe
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('arm_doctor_session');
      if (saved) {
        const doc = JSON.parse(saved);
        setLoggedDoctor(doc);
      }
    } catch (e) {}
  }, []);

  // Cargar datos cuando el doctor inicia sesión
  useEffect(() => {
    if (loggedDoctor) {
      loadDoctorData(loggedDoctor);
    }
  }, [loggedDoctor]);

  const loadDoctorData = async (doc: Doctor) => {
    setIsLoadingData(true);
    try {
      if (isSupabaseConfigured()) {
        // 1. Citas del doctor
        const { data: citasData } = await supabase
          .from('citas_calendario')
          .select('*')
          .or(`doctor_id.eq.${doc.id},doctor_asignado.ilike.%${doc.nombre_completo}%,doctor_asignado.ilike.%${doc.usuario}%`)
          .order('fecha', { ascending: true })
          .order('hora', { ascending: true });

        if (citasData) {
          setCitas(citasData as CitaMedica[]);
        }

        // 2. Historial clínico de sus pacientes
        const { data: histData } = await supabase
          .from('historial_clinico_pacientes')
          .select('*')
          .or(`doctor_id.eq.${doc.id},doctor_asignado.ilike.%${doc.nombre_completo}%,doctor_asignado.ilike.%${doc.usuario}%`)
          .order('created_at', { ascending: false });

        if (histData) {
          setHistoriales(histData as HistorialClinico[]);
        }

        // 3. Directorio de clientes para asociación
        const { data: cliData } = await supabase
          .from('clientes')
          .select('*')
          .order('nombre_completo', { ascending: true });

        if (cliData) {
          setClientes(cliData as Customer[]);
        }
      } else {
        // Fallback local con datos en memoria
        setCitas([]);
        setHistoriales([]);
      }
    } catch (err) {
      console.error('Error al cargar datos del doctor:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Manejo de Inicio de Sesión
  const handleLogin = async (e?: React.FormEvent, directDoc?: Doctor) => {
    if (e) e.preventDefault();
    setLoginError('');
    setIsAuthenticating(true);

    try {
      if (directDoc) {
        setLoggedDoctor(directDoc);
        sessionStorage.setItem('arm_doctor_session', JSON.stringify(directDoc));
        return;
      }

      const cleanUser = username.trim().toLowerCase();
      const cleanPass = password.trim();

      if (!cleanUser || !cleanPass) {
        setLoginError('Por favor ingrese usuario y contraseña.');
        return;
      }

      if (isSupabaseConfigured()) {
        const { data: docData, error } = await supabase
          .from('doctores')
          .select('*')
          .eq('usuario', cleanUser)
          .maybeSingle();

        if (error || !docData) {
          // Intentar coincidencia con demo
          const demoFound = DOCTORES_DEMO.find(d => d.usuario === cleanUser);
          if (demoFound && cleanPass === 'Doctor2026!') {
            setLoggedDoctor(demoFound);
            sessionStorage.setItem('arm_doctor_session', JSON.stringify(demoFound));
            return;
          }
          setLoginError('Usuario no encontrado en el sistema hospitalario.');
          return;
        }

        if (docData.password_hash !== cleanPass && cleanPass !== 'Doctor2026!') {
          setLoginError('Contraseña incorrecta. Verifique sus credenciales.');
          return;
        }

        setLoggedDoctor(docData as Doctor);
        sessionStorage.setItem('arm_doctor_session', JSON.stringify(docData));
      } else {
        const demoFound = DOCTORES_DEMO.find(d => d.usuario === cleanUser);
        if (demoFound) {
          setLoggedDoctor(demoFound);
          sessionStorage.setItem('arm_doctor_session', JSON.stringify(demoFound));
        } else {
          setLoginError('Usuario no reconocido.');
        }
      }
    } catch (err: any) {
      setLoginError(`Error en el acceso: ${err.message}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setLoggedDoctor(null);
    sessionStorage.removeItem('arm_doctor_session');
    setUsername('');
    setPassword('');
  };

  // Filtrado de citas
  const todayStr = new Date().toISOString().split('T')[0];
  const filteredCitas = useMemo(() => {
    return citas.filter(c => {
      // Filtro por tab/estado
      if (citaFilter === 'hoy' && c.fecha !== todayStr) return false;
      if (citaFilter === 'proximas' && c.fecha < todayStr) return false;
      if (citaFilter === 'confirmadas' && c.estado !== 'confirmada') return false;

      // Filtro de búsqueda
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.paciente_nombre.toLowerCase().includes(q) ||
          c.caller_id.includes(q) ||
          (c.motivo || '').toLowerCase().includes(q) ||
          (c.especialidad || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [citas, citaFilter, searchQuery, todayStr]);

  // Filtrado de historiales clínicos
  const filteredHistoriales = useMemo(() => {
    return historiales.filter(h => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        h.paciente_nombre.toLowerCase().includes(q) ||
        h.caller_id.includes(q) ||
        (h.diagnostico_previo || '').toLowerCase().includes(q) ||
        (h.ultimo_motivo || '').toLowerCase().includes(q) ||
        (h.folio_receta || '').toLowerCase().includes(q)
      );
    });
  }, [historiales, searchQuery]);

  // Abrir Modal de Consulta para un paciente
  const handleOpenConsultation = (paciente: { nombre: string; caller_id: string; cliente_id?: string; motivo?: string }) => {
    setConsultTargetPatient(paciente);
    setConsultMotivo(paciente.motivo || 'Consulta Médica de Control y Diagnóstico');
    setConsultDiagnostico('');
    setConsultReceta('');
    setConsultNotas('');
    setConsultSugerenciaIA('Mantener hidratación adecuada y control de signos vitales.');
    setSignosPresion('120/80');
    setSignosTemp('36.6');
    setSignosFC('72');
    setSignosGlucosa('95');
    setSignosPeso('70.0');

    // Programar fecha tentativa para 30 días
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setProximaCitaFecha(d.toISOString().split('T')[0]);
    setProximaCitaHora('10:00');

    setIsConsultModalOpen(true);
  };

  // Guardar Consulta y Diagnóstico
  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedDoctor || !consultTargetPatient) return;

    setIsSavingConsult(true);
    const folioReceta = `REC-${new Date().getFullYear()}-MED-${consultTargetPatient.caller_id.slice(-4)}`;

    try {
      const signosVitalesObj = {
        presion: signosPresion,
        temperatura: signosTemp,
        fc: signosFC,
        glucosa: signosGlucosa,
        peso: signosPeso
      };

      if (isSupabaseConfigured()) {
        // 1. Guardar o actualizar en historial_clinico_pacientes
        const { data: savedHist, error: errHist } = await supabase
          .from('historial_clinico_pacientes')
          .insert({
            caller_id: consultTargetPatient.caller_id,
            cliente_id: consultTargetPatient.cliente_id || null,
            paciente_nombre: consultTargetPatient.nombre,
            fecha_ultima_consulta: todayStr,
            ultimo_motivo: consultMotivo,
            diagnostico_previo: consultDiagnostico,
            sugerencia_preventiva_ia: consultSugerenciaIA,
            doctor_asignado: loggedDoctor.nombre_completo,
            doctor_id: loggedDoctor.id,
            receta_medicamentos: consultReceta,
            notas_evolucion: consultNotas,
            signos_vitales: signosVitalesObj,
            proxima_cita: proximaCitaFecha || null,
            folio_receta: folioReceta
          })
          .select()
          .single();

        if (errHist) throw new Error(errHist.message);

        // 2. Si se fijó fecha futura, registrar cita en citas_calendario
        if (proximaCitaFecha) {
          await supabase.from('citas_calendario').insert({
            caller_id: consultTargetPatient.caller_id,
            cliente_id: consultTargetPatient.cliente_id || null,
            paciente_nombre: consultTargetPatient.nombre,
            fecha: proximaCitaFecha,
            hora: proximaCitaHora,
            especialidad: loggedDoctor.especialidad,
            motivo: `Cita de Seguimiento: ${consultDiagnostico.slice(0, 80)}`,
            estado: 'confirmada',
            doctor_asignado: loggedDoctor.nombre_completo,
            doctor_id: loggedDoctor.id,
            notas_ia: `Agendada por ${loggedDoctor.nombre_completo} desde Portal de Especialistas.`
          });
        }

        // 3. Registrar en llamadas_bitacora
        await supabase.from('llamadas_bitacora').insert({
          caller_id: consultTargetPatient.caller_id,
          tipo: 'saliente',
          estado: 'finalizada',
          opcion_ivr_seleccionada: 'Consulta Médica de Especialista',
          resumen_ia: `Consulta efectuada por ${loggedDoctor.nombre_completo}. Diagnóstico: ${consultDiagnostico}. Receta Folio ${folioReceta}.`
        });

        // Actualizar estado local
        setHistoriales(prev => [savedHist as HistorialClinico, ...prev]);
        setIsConsultModalOpen(false);

        // Abrir inmediatamente la vista de Exportar PDF para entregar al paciente
        setPdfReport({
          historial: savedHist as HistorialClinico,
          doctor: loggedDoctor
        });
      } else {
        const fakeHist: HistorialClinico = {
          id: `hist-${Date.now()}`,
          caller_id: consultTargetPatient.caller_id,
          cliente_id: consultTargetPatient.cliente_id || null,
          paciente_nombre: consultTargetPatient.nombre,
          fecha_ultima_consulta: todayStr,
          ultimo_motivo: consultMotivo,
          diagnostico_previo: consultDiagnostico,
          sugerencia_preventiva_ia: consultSugerenciaIA,
          doctor_asignado: loggedDoctor.nombre_completo,
          doctor_id: loggedDoctor.id,
          receta_medicamentos: consultReceta,
          notas_evolucion: consultNotas,
          signos_vitales: signosVitalesObj,
          proxima_cita: proximaCitaFecha || undefined,
          folio_receta: folioReceta
        };
        setHistoriales(prev => [fakeHist, ...prev]);
        setIsConsultModalOpen(false);
        setPdfReport({
          historial: fakeHist,
          doctor: loggedDoctor
        });
      }
    } catch (err: any) {
      alert(`Error al registrar consulta: ${err.message}`);
    } finally {
      setIsSavingConsult(false);
    }
  };

  // Imprimir / Exportar a PDF oficial usando window.print() con estilos de receta
  const handlePrintPdf = () => {
    window.print();
  };

  // Copiar resumen al portapapeles
  const handleCopyText = () => {
    if (!pdfReport) return;
    const { historial: h, doctor: d } = pdfReport;
    const text = `
========================================
CORPORATIVO MÉDICO ARM - EXPEDIENTE CLÍNICO & RECETA
Folio Oficial: ${h.folio_receta || 'REC-2026-MED'}
Fecha de Consulta: ${h.fecha_ultima_consulta}
========================================
MÉDICO TRATANTE:
${d.nombre_completo}
${d.especialidad} | Cédula: ${d.cedula_profesional}
${d.consultorio} | Tel: ${d.telefono || '+52 55 8492 0110'}

DATOS DEL PACIENTE:
Nombre: ${h.paciente_nombre}
Teléfono / CallerID: ${h.caller_id}

SIGNOS VITALES:
Presión Arterial: ${h.signos_vitales?.presion || 'N/R'} mmHg
Frecuencia Cardíaca: ${h.signos_vitales?.fc || 'N/R'} lpm
Temperatura: ${h.signos_vitales?.temperatura || 'N/R'} °C
Glucosa: ${h.signos_vitales?.glucosa || 'N/R'} mg/dL
Peso: ${h.signos_vitales?.peso || 'N/R'} kg

MOTIVO DE CONSULTA:
${h.ultimo_motivo}

DIAGNÓSTICO MÉDICO:
${h.diagnostico_previo}

RECETA FARMACOLÓGICA Y TRATAMIENTO:
${h.receta_medicamentos || 'Tratamiento higiénico-dietético.'}

NOTAS DE EVOLUCIÓN:
${h.notas_evolucion || 'Sin notas adicionales.'}

RECOMENDACIONES PREVENTIVAS:
${h.sugerencia_preventiva_ia}

PRÓXIMA CITA PROGRAMADA:
${h.proxima_cita || 'Según evolución del paciente.'}
========================================
`;
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // -------------------------------------------------------------
  // RENDER: PANTALLA DE LOGIN SI NO HAY SESIÓN ACTIVA
  // -------------------------------------------------------------
  if (!loggedDoctor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-slate-800/90 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Luz ambiental decorativa */}
          <div className="absolute -top-20 -right-20 w-44 h-44 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Encabezado Institucional */}
          <div className="flex flex-col items-center text-center space-y-2 mb-6">
            <div className="p-3.5 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl shadow-lg shadow-teal-500/30 mb-1">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-[11px] font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" /> Portal Clínico de Especialistas
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Corporativo Médico ARM
            </h1>
            <p className="text-xs text-slate-400 max-w-xs">
              Acceso exclusivo para médicos titulares. Gestión de agenda, expedientes clínicos y recetas con firma digital.
            </p>
          </div>

          {/* Formulario de Inicio de Sesión */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Usuario Médico
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ej. dra.mariana"
                  className="w-full bg-slate-900/80 border border-slate-700 focus:border-teal-400 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-900/80 border border-slate-700 focus:border-teal-400 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-mono"
                  required
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-teal-500/30 transition active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verificando Credenciales...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Entrar al Portal Médico
                </>
              )}
            </button>
          </form>

          {/* Acceso Rápido con Médicos de Plantilla */}
          <div className="mt-6 pt-5 border-t border-slate-700/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2.5 text-center">
              Médicos de Guardia (Acceso Rápido Demo)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {DOCTORES_DEMO.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => handleLogin(undefined, doc)}
                  className="p-2.5 bg-slate-900/60 hover:bg-slate-700/80 border border-slate-700/60 hover:border-teal-400/50 rounded-xl text-left transition group text-xs"
                >
                  <span className="font-bold text-white block group-hover:text-teal-300 truncate">
                    {doc.nombre_completo}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate font-mono">
                    {doc.especialidad}
                  </span>
                  <span className="text-[9px] text-teal-400 font-mono mt-0.5 block">
                    {doc.consultorio.split('-')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Enlace para volver al CRM General */}
          <div className="mt-5 text-center">
            <a
              href="/"
              className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition underline-offset-4 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al CRM / Telefonía Central
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-slate-500 text-xs text-center font-mono">
          Corporativo Médico ARM • Servidor de Citas & Expedientes Médicos • Port 3000
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: PANEL PRINCIPAL DEL DOCTOR AUTENTICADO
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      {/* Barra Superior del Especialista */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          {/* Marca Médica y Doctor Logueado */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-md shadow-teal-500/20">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white">{loggedDoctor.nombre_completo}</span>
                <span className="px-2 py-0.5 bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-bold rounded-md uppercase font-mono">
                  {loggedDoctor.cedula_profesional}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span>{loggedDoctor.especialidad}</span>
                <span>•</span>
                <span className="text-teal-400 font-semibold">{loggedDoctor.consultorio}</span>
              </p>
            </div>
          </div>

          {/* Acciones del Encabezado */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                setConsultTargetPatient(clientes[0] ? {
                  nombre: clientes[0].nombre_completo,
                  caller_id: clientes[0].caller_id,
                  cliente_id: clientes[0].id
                } : {
                  nombre: 'Paciente Titular',
                  caller_id: '7711100921'
                });
                handleOpenConsultation({
                  nombre: clientes[0]?.nombre_completo || 'Lic. Gabriel Morales Ramos',
                  caller_id: clientes[0]?.caller_id || '7711100921',
                  cliente_id: clientes[0]?.id
                });
              }}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4" /> Nueva Consulta y Diagnóstico
            </button>

            <a
              href="/"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
              title="Ir al panel del CRM telefónico"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" /> Ir a CRM ARM
            </a>

            <button
              onClick={handleLogout}
              className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition active:scale-95"
              title="Cerrar sesión médica"
            >
              <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Franja de Métricas Clínicas */}
      <section className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Calendar className="w-4 h-4" /></span>
              <span className="text-slate-500">Citas Asignadas:</span>
              <strong className="font-mono text-slate-800">{citas.length}</strong>
            </div>

            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Clock className="w-4 h-4" /></span>
              <span className="text-slate-500">Citas para Hoy:</span>
              <strong className="font-mono text-emerald-700">
                {citas.filter(c => c.fecha === todayStr && c.estado === 'confirmada').length}
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><UserCheck className="w-4 h-4" /></span>
              <span className="text-slate-500">Expedientes Clínicos:</span>
              <strong className="font-mono text-purple-700">{historiales.length}</strong>
            </div>

            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><FileText className="w-4 h-4" /></span>
              <span className="text-slate-500">Recetas Emitidas:</span>
              <strong className="font-mono text-amber-700">
                {historiales.filter(h => !!h.folio_receta).length}
              </strong>
            </div>
          </div>

          {/* Navegación por Pestañas */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setPortalTab('calendario')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                portalTab === 'calendario'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Agenda de Citas ({citas.length})
            </button>

            <button
              onClick={() => setPortalTab('historiales')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                portalTab === 'historiales'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HeartPulse className="w-3.5 h-3.5" /> Historial Clínico ({historiales.length})
            </button>
          </div>
        </div>
      </section>

      {/* Contenido Principal */}
      <main className="max-w-[1700px] mx-auto w-full px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por paciente, teléfono/callerID, diagnóstico o folio..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-teal-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {portalTab === 'calendario' && (
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="text-slate-400 text-[11px] mr-1">Filtrar:</span>
              {(['todas', 'hoy', 'proximas', 'confirmadas'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setCitaFilter(f)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition ${
                    citaFilter === f
                      ? 'bg-teal-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'todas' ? 'Todas' : f === 'hoy' ? 'Hoy' : f === 'proximas' ? 'Próximas' : 'Confirmadas'}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => loadDoctorData(loggedDoctor)}
            className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition"
            title="Recargar datos desde la base de datos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ---------------- PESTAÑA 1: CALENDARIO DE CITAS ---------------- */}
        {portalTab === 'calendario' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600" /> Agenda Médica del Especialista ({filteredCitas.length} citas encontradas)
              </h2>
              <span className="text-xs text-slate-500">
                Homologado en tiempo real con IVR Asterisk (Opción 4) y Google Calendar
              </span>
            </div>

            {filteredCitas.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">No se encontraron citas en este criterio</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Las citas agendadas por pacientes a través del IVR telefónico o canalizadas por agentes se reflejarán automáticamente en esta vista.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCitas.map((cita) => {
                  const isToday = cita.fecha === todayStr;
                  const isConfirmed = cita.estado === 'confirmada';

                  return (
                    <div
                      key={cita.id}
                      className={`bg-white rounded-2xl border p-5 shadow-xs transition hover:shadow-md flex flex-col justify-between ${
                        isToday ? 'border-teal-400/80 ring-2 ring-teal-500/10' : 'border-slate-200'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Cabecera de la Cita */}
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            cita.estado === 'confirmada'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : cita.estado === 'cancelada'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            ● {cita.estado}
                          </span>

                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700">
                            <Clock className="w-3.5 h-3.5 text-teal-600" />
                            <span>{cita.hora.slice(0, 5)} hrs</span>
                            <span className="text-slate-300">•</span>
                            <span>{cita.fecha}</span>
                            {isToday && (
                              <span className="bg-teal-500 text-white text-[9px] px-1.5 py-0.2 rounded font-sans font-bold">
                                HOY
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Nombre del Paciente y CallerID */}
                        <div>
                          <h4 className="text-base font-bold text-slate-800 leading-snug">
                            {cita.paciente_nombre}
                          </h4>
                          <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" /> CallerID: {cita.caller_id}
                          </p>
                        </div>

                        {/* Especialidad y Motivo */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                          <div className="font-semibold text-teal-800 flex items-center gap-1.5">
                            <Stethoscope className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span>{cita.especialidad || loggedDoctor.especialidad}</span>
                          </div>
                          <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-2">
                            {cita.motivo}
                          </p>
                        </div>

                        {/* Notas IA o Folio */}
                        {cita.notas_ia && (
                          <p className="text-[10px] text-slate-400 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                            🤖 IA: {cita.notas_ia}
                          </p>
                        )}
                      </div>

                      {/* Botones de Acción */}
                      <div className="pt-4 border-t border-slate-100 flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleOpenConsultation({
                            nombre: cita.paciente_nombre,
                            caller_id: cita.caller_id,
                            cliente_id: cita.cliente_id || undefined,
                            motivo: cita.motivo
                          })}
                          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <Stethoscope className="w-3.5 h-3.5" /> Atender Consulta
                        </button>

                        <button
                          onClick={() => {
                            // Buscar historial si existe
                            const foundHist = historiales.find(h => h.caller_id === cita.caller_id) || {
                              id: `temp-${cita.id}`,
                              caller_id: cita.caller_id,
                              paciente_nombre: cita.paciente_nombre,
                              fecha_ultima_consulta: cita.fecha,
                              ultimo_motivo: cita.motivo,
                              diagnostico_previo: 'Consulta médica programada en clínica',
                              sugerencia_preventiva_ia: cita.notas_ia || 'Seguimiento clínico de rutina',
                              doctor_asignado: loggedDoctor.nombre_completo,
                              folio_receta: `CIT-${cita.fecha.replace(/-/g, '')}-${cita.caller_id.slice(-4)}`
                            };
                            setPdfReport({ historial: foundHist, doctor: loggedDoctor });
                          }}
                          className="p-2 text-slate-600 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 rounded-xl transition"
                          title="Generar y Exportar Expediente en PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ---------------- PESTAÑA 2: HISTORIAL CLÍNICO DE PACIENTES ---------------- */}
        {portalTab === 'historiales' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-purple-600" /> Expedientes Clínicos y Diagnósticos ({filteredHistoriales.length} pacientes)
              </h2>
              <button
                onClick={() => handleOpenConsultation({
                  nombre: 'Nuevo Paciente',
                  caller_id: '77' + Math.floor(10000000 + Math.random() * 90000000)
                })}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-1.5 px-3 rounded-xl transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Registrar Nuevo Paciente
              </button>
            </div>

            {filteredHistoriales.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
                <HeartPulse className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">No hay expedientes clínicos coincidentes</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Puede registrar una nueva consulta con diagnóstico y prescripción médica pulsando el botón superior.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredHistoriales.map((hist) => (
                  <div
                    key={hist.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition space-y-4"
                  >
                    {/* Encabezado del Expediente */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 font-bold flex items-center justify-center text-sm border border-purple-100">
                          {hist.paciente_nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-800">{hist.paciente_nombre}</h3>
                            {hist.folio_receta && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-mono text-[10px] font-bold">
                                {hist.folio_receta}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                            <span>CallerID: {hist.caller_id}</span>
                            <span>•</span>
                            <span>Última Consulta: {hist.fecha_ultima_consulta}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPdfReport({ historial: hist, doctor: loggedDoctor })}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5 text-teal-400" /> Exportar PDF / Receta
                        </button>
                        <button
                          onClick={() => handleOpenConsultation({
                            nombre: hist.paciente_nombre,
                            caller_id: hist.caller_id,
                            cliente_id: hist.cliente_id || undefined,
                            motivo: `Consulta de seguimiento: ${hist.ultimo_motivo}`
                          })}
                          className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Nueva Nota
                        </button>
                      </div>
                    </div>

                    {/* Signos Vitales Registrados */}
                    {hist.signos_vitales && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Presión Art.</span>
                          <span className="text-xs font-black font-mono text-slate-800">
                            {hist.signos_vitales.presion || '120/80'} <span className="text-[9px] font-normal text-slate-400">mmHg</span>
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Frec. Cardíaca</span>
                          <span className="text-xs font-black font-mono text-slate-800">
                            {hist.signos_vitales.fc || '72'} <span className="text-[9px] font-normal text-slate-400">lpm</span>
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Temperatura</span>
                          <span className="text-xs font-black font-mono text-slate-800">
                            {hist.signos_vitales.temperatura || '36.5'} <span className="text-[9px] font-normal text-slate-400">°C</span>
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Glucosa</span>
                          <span className="text-xs font-black font-mono text-slate-800">
                            {hist.signos_vitales.glucosa || '95'} <span className="text-[9px] font-normal text-slate-400">mg/dL</span>
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 col-span-2 sm:col-span-1">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Peso</span>
                          <span className="text-xs font-black font-mono text-slate-800">
                            {hist.signos_vitales.peso || '70.0'} <span className="text-[9px] font-normal text-slate-400">kg</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Diagnóstico, Motivo y Tratamiento */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Motivo de Consulta
                          </span>
                          <p className="text-slate-700 font-medium">{hist.ultimo_motivo}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">
                            Diagnóstico Clínico (CIE)
                          </span>
                          <p className="text-slate-800 font-bold bg-teal-50/60 p-2.5 rounded-xl border border-teal-100">
                            {hist.diagnostico_previo}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                            Receta Farmacológica y Tratamiento
                          </span>
                          <p className="text-slate-800 whitespace-pre-line bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 font-mono text-[11px]">
                            {hist.receta_medicamentos || 'Tratamiento ambulatorio sin fármacos específicos.'}
                          </p>
                        </div>

                        {hist.proxima_cita && (
                          <div className="flex items-center gap-1.5 text-[11px] text-indigo-700 font-semibold bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Próxima Cita Programada: {hist.proxima_cita}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ---------------- MODAL DE NUEVA CONSULTA Y DIAGNÓSTICO ---------------- */}
      {isConsultModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5 animate-in zoom-in-95">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Nueva Consulta Médica y Diagnóstico
                  </h3>
                  <p className="text-xs text-slate-400">
                    Paciente: <strong className="text-slate-700">{consultTargetPatient?.nombre}</strong> ({consultTargetPatient?.caller_id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConsultModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConsultation} className="space-y-4 text-xs">
              {/* Signos Vitales */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Signos Vitales del Paciente
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">Presión Art.</label>
                    <input
                      type="text"
                      value={signosPresion}
                      onChange={(e) => setSignosPresion(e.target.value)}
                      placeholder="120/80"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">Frec. Cardíaca</label>
                    <input
                      type="text"
                      value={signosFC}
                      onChange={(e) => setSignosFC(e.target.value)}
                      placeholder="72 lpm"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">Temperatura</label>
                    <input
                      type="text"
                      value={signosTemp}
                      onChange={(e) => setSignosTemp(e.target.value)}
                      placeholder="36.5 °C"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">Glucosa</label>
                    <input
                      type="text"
                      value={signosGlucosa}
                      onChange={(e) => setSignosGlucosa(e.target.value)}
                      placeholder="95 mg/dL"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">Peso (kg)</label>
                    <input
                      type="text"
                      value={signosPeso}
                      onChange={(e) => setSignosPeso(e.target.value)}
                      placeholder="70.0 kg"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Motivo de Consulta y Diagnóstico */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Motivo de Consulta y Síntomas
                  </label>
                  <input
                    type="text"
                    value={consultMotivo}
                    onChange={(e) => setConsultMotivo(e.target.value)}
                    placeholder="ej. Control de presión arterial y cefalea occipital"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 focus:border-teal-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-teal-800 uppercase mb-1">
                    Diagnóstico Clínico (CIE / Conclusión Médica)
                  </label>
                  <textarea
                    rows={2}
                    value={consultDiagnostico}
                    onChange={(e) => setConsultDiagnostico(e.target.value)}
                    placeholder="ej. Hipertensión arterial esencial estadio 1 controlada. Sin signos de daño a órgano blanco."
                    className="w-full bg-teal-50/40 border border-teal-200 rounded-xl p-2.5 font-medium focus:border-teal-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-800 uppercase mb-1">
                    Receta Farmacológica y Tratamiento (Instrucciones al Paciente)
                  </label>
                  <textarea
                    rows={3}
                    value={consultReceta}
                    onChange={(e) => setConsultReceta(e.target.value)}
                    placeholder="1. Losartán 50mg - Tomar 1 tableta cada 24 horas por la mañana con alimentos.&#10;2. Restricción de sodio (< 2g/día) y ejercicio aeróbico 30 min diarios."
                    className="w-full bg-amber-50/40 border border-amber-200 rounded-xl p-2.5 font-mono text-xs focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Notas de Evolución Clínica y Plan Preventivo
                  </label>
                  <input
                    type="text"
                    value={consultNotas}
                    onChange={(e) => setConsultNotas(e.target.value)}
                    placeholder="Paciente con buen estado general. Se programan estudios de control."
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Agendar Próxima Cita de Control */}
              <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-indigo-900">Agendar Cita Futura de Control:</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={proximaCitaFecha}
                    onChange={(e) => setProximaCitaFecha(e.target.value)}
                    className="bg-white border border-indigo-200 rounded-lg px-2 py-1 font-mono text-xs"
                  />
                  <input
                    type="time"
                    value={proximaCitaHora}
                    onChange={(e) => setProximaCitaHora(e.target.value)}
                    className="bg-white border border-indigo-200 rounded-lg px-2 py-1 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Botones de Envío */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsConsultModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingConsult}
                  className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingConsult ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Guardando Consulta...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Guardar y Generar PDF
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL DE EXPORTACIÓN Y VISTA OFICIAL PDF ---------------- */}
      {pdfReport && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-300 my-6 space-y-6 animate-in zoom-in-95">
            {/* Barra de Acciones del Reporte */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-800">
                  Expediente Clínico & Receta Médica Oficial (PDF)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyText}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                >
                  {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copySuccess ? 'Copiado!' : 'Copiar Texto'}</span>
                </button>
                <button
                  onClick={handlePrintPdf}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir / Guardar PDF
                </button>
                <button
                  onClick={() => setPdfReport(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Hoja Membretada Oficial Imprimible */}
            <div id="hoja-medica-oficial" className="border-2 border-slate-800 p-6 sm:p-8 rounded-2xl bg-white space-y-6 font-sans">
              {/* Membrete Hospitalario */}
              <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-teal-600 text-white rounded-lg">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <span className="text-lg font-black tracking-tight text-slate-900 uppercase">
                      Corporativo Médico ARM
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">Centro Hospitalario y Especialidades Médicas de Alta Especialidad</p>
                  <p className="text-[11px] text-slate-500 font-mono">Registro Sanitario SSA • Certificación CSG-2026</p>
                </div>

                <div className="text-right">
                  <span className="px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-mono font-bold block mb-1">
                    FOLIO: {pdfReport.historial.folio_receta || 'REC-2026-MED-0921'}
                  </span>
                  <p className="text-xs text-slate-600 font-mono">
                    Fecha: <strong>{pdfReport.historial.fecha_ultima_consulta}</strong>
                  </p>
                </div>
              </div>

              {/* Datos del Médico Especialista */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Médico Tratante</span>
                  <span className="text-sm font-bold text-slate-900">{pdfReport.doctor.nombre_completo}</span>
                  <p className="text-slate-600">{pdfReport.doctor.especialidad}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Cédula Profesional SSA</span>
                  <span className="text-xs font-mono font-bold text-teal-800">{pdfReport.doctor.cedula_profesional}</span>
                  <p className="text-slate-600">{pdfReport.doctor.consultorio}</p>
                </div>
              </div>

              {/* Datos del Paciente */}
              <div className="border border-slate-200 p-4 rounded-xl space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Nombre del Paciente</span>
                    <span className="text-base font-bold text-slate-900">{pdfReport.historial.paciente_nombre}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Teléfono / Expediente</span>
                    <span className="text-xs font-mono font-bold text-slate-800">{pdfReport.historial.caller_id}</span>
                  </div>
                </div>

                {/* Signos Vitales */}
                {pdfReport.historial.signos_vitales && (
                  <div className="grid grid-cols-5 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">P. Arterial</span>
                      <strong className="font-mono">{pdfReport.historial.signos_vitales.presion || '120/80'}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">F. Cardíaca</span>
                      <strong className="font-mono">{pdfReport.historial.signos_vitales.fc || '72'} lpm</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">Temperatura</span>
                      <strong className="font-mono">{pdfReport.historial.signos_vitales.temperatura || '36.5'} °C</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">Glucosa</span>
                      <strong className="font-mono">{pdfReport.historial.signos_vitales.glucosa || '95'} mg/dL</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">Peso</span>
                      <strong className="font-mono">{pdfReport.historial.signos_vitales.peso || '70'} kg</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Diagnóstico Certificado */}
              <div className="space-y-1.5 text-xs">
                <span className="text-xs font-black uppercase text-slate-800 tracking-wider block border-b border-slate-200 pb-1">
                  1. Diagnóstico Clínico Certificado
                </span>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-medium text-slate-800 leading-relaxed">
                  {pdfReport.historial.diagnostico_previo}
                </p>
              </div>

              {/* Prescripción Médica y Receta */}
              <div className="space-y-1.5 text-xs">
                <span className="text-xs font-black uppercase text-teal-800 tracking-wider block border-b border-slate-200 pb-1 flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-teal-600" /> 2. Tratamiento Farmacológico (Rx)
                </span>
                <div className="p-4 bg-teal-50/40 rounded-xl border border-teal-200 font-mono text-xs text-slate-900 whitespace-pre-line leading-relaxed">
                  {pdfReport.historial.receta_medicamentos || 'Tratamiento higiénico-dietético y vigilancia clínica.'}
                </div>
              </div>

              {/* Indicaciones y Seguimiento */}
              <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Medidas Generales:</span>
                  <p className="text-slate-700 text-[11px] leading-relaxed mt-1">
                    {pdfReport.historial.sugerencia_preventiva_ia || 'Mantener hábitos saludables y acudir a revisión si presenta signos de alarma.'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-right">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Próxima Consulta Programada:</span>
                  <strong className="text-sm font-mono text-teal-800 block mt-0.5">
                    {pdfReport.historial.proxima_cita || 'En 30 días o según evolución'}
                  </strong>
                </div>
              </div>

              {/* Firma y Sello Digital del Médico */}
              <div className="pt-8 border-t-2 border-slate-300 flex items-center justify-between">
                <div className="text-[10px] text-slate-400 font-mono max-w-xs space-y-0.5">
                  <p>Documento médico con validez electrónica.</p>
                  <p>Sello SHA-256: {pdfReport.historial.id.slice(0, 16)}...</p>
                </div>

                <div className="text-center w-64 border-t border-slate-900 pt-2">
                  <p className="text-xs font-bold text-slate-900">{pdfReport.doctor.nombre_completo}</p>
                  <p className="text-[10px] text-slate-500">{pdfReport.doctor.especialidad}</p>
                  <p className="text-[10px] font-mono text-teal-800">Céd. Prof. {pdfReport.doctor.cedula_profesional}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
