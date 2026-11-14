'use client';

import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  Calendar, 
  Clock, 
  UserCheck, 
  UserX, 
  Sparkles, 
  Brain, 
  AlertTriangle, 
  CheckCircle2, 
  PhoneCall, 
  FileText, 
  Plus, 
  Search, 
  RefreshCw, 
  HeartPulse, 
  Bot, 
  User, 
  ShieldCheck, 
  ArrowRight,
  MessageSquare,
  BookOpen,
  CalendarCheck,
  CalendarX,
  XCircle,
  HelpCircle,
  UserPlus,
  GitBranch,
  Check
} from 'lucide-react';
import { CitaMedica, HistorialClinico, CbrCaso } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

interface MedicalConsultationsProps {
  onCallPatient?: (phone: string) => void;
}

// Plantilla de médicos de la clínica homologada con IVR Asterisk
const PLANTILLA_MEDICOS = [
  { nombre: 'Dra. Mariana Fernández', especialidad: 'Medicina Familiar y Preventiva' },
  { nombre: 'Dr. Fernando Fernández', especialidad: 'Medicina Interna y Cardiología' },
  { nombre: 'Dra. Mariana Gómez', especialidad: 'Medicina General' },
  { nombre: 'Dr. Alejandro Morales', especialidad: 'Cardiología Preventiva' },
  { nombre: 'Dra. Sofía Navarro', especialidad: 'Laboratorio y Diagnóstico Clínico' }
];

export default function MedicalConsultations({ onCallPatient }: MedicalConsultationsProps) {
  // Estado del CallerID actual
  const [callerId, setCallerId] = useState<string>('1001');
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Datos del Paciente e Historial
  const [isExistingPatient, setIsExistingPatient] = useState<boolean>(true);
  const [patientName, setPatientName] = useState<string>('Carlos Mendoza Ortiz');
  const [clinicalHistory, setClinicalHistory] = useState<HistorialClinico | null>({
    id: 'hc-1',
    caller_id: '1001',
    paciente_nombre: 'Carlos Mendoza Ortiz',
    fecha_ultima_consulta: '2026-10-12',
    ultimo_motivo: 'Revisión y monitoreo de presión arterial',
    diagnostico_previo: 'Presión arterial sistólica ligeramente elevada (135/88 mmHg). Se recomendó seguimiento mensual y control de sodio.',
    sugerencia_preventiva_ia: 'Validar diagnóstico con un check-up general de sangre (química sanguínea de 24 elementos y perfil lipídico completo)',
    doctor_asignado: 'Dra. Mariana Fernández'
  });

  // Lista de Citas Médicas desde citas_calendario
  const [citas, setCitas] = useState<CitaMedica[]>([]);
  const [loadingCitas, setLoadingCitas] = useState<boolean>(false);

  // Formulario de Nueva Cita
  const [nuevaFecha, setNuevaFecha] = useState<string>('2026-11-16');
  const [nuevaHora, setNuevaHora] = useState<string>('10:00');
  const [nuevaEspecialidad, setNuevaEspecialidad] = useState<string>('Medicina Preventiva y Laboratorio');
  const [nuevoDoctor, setNuevoDoctor] = useState<string>('Dra. Mariana Fernández');
  const [nuevoMotivo, setNuevoMotivo] = useState<string>('Check-up general de sangre y perfil lipídico (Preventivo)');
  const [isBooking, setIsBooking] = useState<boolean>(false);

  // Manejo de Conflicto de Disponibilidad de Médico de Cabecera
  const [conflictDetected, setConflictDetected] = useState<boolean>(false);
  const [proximaFechaCabecera, setProximaFechaCabecera] = useState<string>('2026-11-17');
  const [proximaHoraCabecera, setProximaHoraCabecera] = useState<string>('10:00');
  const [selectedSubstituteDoctor, setSelectedSubstituteDoctor] = useState<string>('Dr. Fernando Fernández');
  const [showInteractiveChatChoices, setShowInteractiveChatChoices] = useState<boolean>(false);

  // Modo de visualización de agenda y filtros sincronizados
  const [agendaViewMode, setAgendaViewMode] = useState<'paciente' | 'doctor' | 'todos'>('paciente');
  const [selectedDoctorAgenda, setSelectedDoctorAgenda] = useState<string>('Dr. Alejandro Morales');

  // Casos CBR y Escalamiento Humano
  const [casosCBR, setCasosCBR] = useState<CbrCaso[]>([]);
  const [resolucionTexto, setResolucionTexto] = useState<{ [id: string]: string }>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Diálogo Interactivo Simulado con Gemini IA (Opción 4 IVR)
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'ai' | 'patient' | 'system'; text: string; time: string }>>([
    {
      role: 'system',
      text: 'Llamada entrante detectada en IVR Asterisk (Opción 4: Citas Médicas). CallerID: 1001 reconocido.',
      time: '10:00:01'
    },
    {
      role: 'ai',
      text: '¡Hola, Carlos Mendoza! Bienvenido al servicio clínico asistido por IA de ARM Salud. Veo que tu última visita fue el 12 de septiembre por control de presión arterial. ¿En qué podemos ayudarte el día de hoy?',
      time: '10:00:03'
    },
    {
      role: 'patient',
      text: 'Hola, doctor IA. He tenido ligeros mareos por la mañana y requiero agendar una cita de seguimiento con mi médico de cabecera, el Dr. Alejandro Morales.',
      time: '10:00:08'
    },
    {
      role: 'ai',
      text: 'Comprendo perfectamente, Carlos. Según tu historial previo de Hipertensión Grado 1, es fundamental evaluar tu régimen actual. Procedo a verificar la disponibilidad del Dr. Alejandro Morales...',
      time: '10:00:12'
    }
  ]);

  const medicoCabeceraActual = clinicalHistory?.doctor_asignado || 'Dr. Alejandro Morales';

  // Cargar datos al cambiar de CallerID o filtros de vista
  useEffect(() => {
    fetchPatientData(callerId);
    fetchCitas(agendaViewMode, callerId, selectedDoctorAgenda);
    fetchCasosCBR();
    setConflictDetected(false);
    setShowInteractiveChatChoices(false);
  }, [callerId, agendaViewMode, selectedDoctorAgenda]);

  // Sincronización en tiempo real vía WebSockets de Supabase (bidireccional CRM <-> Asterisk IVR)
  useEffect(() => {
    if (isSupabaseConfigured()) {
      const channel = supabase
        .channel('realtime_citas_sincronizadas')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'citas_calendario' },
          (payload: any) => {
            console.log('[Supabase Realtime] Sincronización detectada en citas_calendario:', payload);
            fetchCitas(agendaViewMode, callerId, selectedDoctorAgenda);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [agendaViewMode, callerId, selectedDoctorAgenda]);

  const fetchPatientData = async (cid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/historial-clinico?caller_id=${encodeURIComponent(cid)}`);
      const data = await res.json();
      if (data.found && data.historial) {
        setIsExistingPatient(true);
        setPatientName(data.historial.paciente_nombre || 'Paciente Registrado');
        setClinicalHistory(data.historial);
        setNuevoDoctor(data.historial.doctor_asignado || 'Dr. Alejandro Morales');
      } else if (data.cliente) {
        setIsExistingPatient(true);
        setPatientName(data.cliente.nombre_completo || 'Cliente Registrado');
        setClinicalHistory({
          id: `hc-${cid}`,
          caller_id: cid,
          paciente_nombre: data.cliente.nombre_completo,
          fecha_ultima_consulta: '2026-08-15',
          ultimo_motivo: 'Consulta de Valoración General',
          diagnostico_previo: 'Estado clínico estable sin comorbilidades agudas',
          sugerencia_preventiva_ia: 'Paciente registrado sin alertas críticas. Programar chequeo preventivo anual.',
          doctor_asignado: 'Dra. Mariana Gómez'
        });
        setNuevoDoctor('Dra. Mariana Gómez');
      } else {
        setIsExistingPatient(false);
        setPatientName(`Paciente Nuevo (${cid})`);
        setClinicalHistory(null);
        setNuevoDoctor('Dra. Mariana Gómez');
      }
    } catch (err) {
      console.error('Error al consultar historial clínico:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCitas = async (mode = agendaViewMode, cid = callerId, doc = selectedDoctorAgenda) => {
    setLoadingCitas(true);
    try {
      let url = '/api/citas';
      if (mode === 'paciente') {
        url = `/api/citas?caller_id=${encodeURIComponent(cid)}`;
      } else if (mode === 'doctor') {
        url = `/api/citas?doctor_asignado=${encodeURIComponent(doc)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.citas) {
        setCitas(data.citas);
      }
    } catch (err) {
      console.error('Error al cargar citas de calendario:', err);
    } finally {
      setLoadingCitas(false);
    }
  };

  const fetchCasosCBR = async () => {
    try {
      const res = await fetch('/api/cbr-casos');
      const data = await res.json();
      if (data.casos) {
        setCasosCBR(data.casos);
      }
    } catch (err) {
      console.error('Error al cargar casos CBR:', err);
    }
  };

  // Agendar nueva cita
  const handleAgendarCita = async (e?: React.FormEvent, customBooking?: Partial<CitaMedica>) => {
    if (e) e.preventDefault();
    setIsBooking(true);
    setStatusMessage(null);
    try {
      const payload = {
        caller_id: callerId,
        paciente_nombre: patientName,
        fecha: customBooking?.fecha || nuevaFecha,
        hora: customBooking?.hora || nuevaHora,
        especialidad: customBooking?.especialidad || nuevaEspecialidad,
        doctor_asignado: customBooking?.doctor_asignado || nuevoDoctor,
        motivo: customBooking?.motivo || nuevoMotivo,
        notas_ia: customBooking?.notas_ia || `Cita médica programada vía Opción 4 IVR asistida por IA Gemini para CallerID: ${callerId}`
      };

      const res = await fetch('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.cita) {
        setStatusMessage(`¡Cita agendada exitosamente con ${payload.doctor_asignado} el ${payload.fecha} a las ${payload.hora}!`);
        await fetchCitas();
        setConflictDetected(false);
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        setStatusMessage(`Error: ${data.error || 'No se pudo agendar la cita'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error de conexión: ${err.message}`);
    } finally {
      setIsBooking(false);
    }
  };

  // Simular Escenario: Médico de Cabecera con Horario Ocupado
  const handleSimularConflictoCabecera = () => {
    setConflictDetected(true);
    setShowInteractiveChatChoices(true);

    const proximaFecha = '2026-11-17';
    const proximaHora = '10:00';
    setProximaFechaCabecera(proximaFecha);
    setProximaHoraCabecera(proximaHora);

    setChatMessages(prev => [
      ...prev,
      {
        role: 'patient',
        text: `Deseo agendar mi cita para el 16 de Noviembre a las 10:00 hrs con mi doctora de cabecera, la ${medicoCabeceraActual}.`,
        time: new Date().toLocaleTimeString()
      },
      {
        role: 'system',
        text: `⚠️ Verificación en Calendario: La ${medicoCabeceraActual} se encuentra OCUPADA el 2026-11-16 a las 10:00 hrs.`,
        time: new Date().toLocaleTimeString()
      },
      {
        role: 'ai',
        text: `Estimado Carlos, he consultado la agenda y la ${medicoCabeceraActual} ya cuenta con una cita médica confirmada el 16 de Noviembre a las 10:00 hrs. Disponemos de las siguientes dos alternativas:\n\n1) Atenderse hoy mismo con el Dr. Fernando Fernández a las 11:00 hrs.\n2) O agendar con su doctora de cabecera ${medicoCabeceraActual} para el día siguiente (Martes 17 de Noviembre a las 10:00 hrs).`,
        time: new Date().toLocaleTimeString()
      }
    ]);
  };

  // Opción A: Reagendar con Médico de Cabecera en su próximo día libre (Día siguiente)
  const handleElegirReagendarCabecera = async () => {
    setShowInteractiveChatChoices(false);
    setChatMessages(prev => [
      ...prev,
      {
        role: 'patient',
        text: `Prefiero agendar para el día siguiente con mi doctora de cabecera (${medicoCabeceraActual}).`,
        time: new Date().toLocaleTimeString()
      },
      {
        role: 'ai',
        text: `¡Excelente elección, Carlos! Cuidamos la continuidad de su tratamiento. He confirmado su cita con su doctora de cabecera, la ${medicoCabeceraActual}, para el Martes 17 de Noviembre a las 10:00 hrs. Recuerde acudir en ayuno de 8 horas para su check-up de sangre.`,
        time: new Date().toLocaleTimeString()
      }
    ]);

    await handleAgendarCita(undefined, {
      fecha: '2026-11-17',
      hora: '10:00',
      doctor_asignado: medicoCabeceraActual,
      motivo: `Check-up de sangre preventivo agendado con doctora de cabecera (${medicoCabeceraActual}) para el día siguiente`
    });
  };

  // Opción B: Mantener la fecha requerida con el médico disponible de turno
  const handleElegirMantenerHorarioSustituto = async (doctorNombre?: string) => {
    const doc = doctorNombre || 'Dr. Fernando Fernández';
    const docObj = PLANTILLA_MEDICOS.find(m => m.nombre === doc);
    const esp = docObj?.especialidad || 'Medicina Interna y Cardiología';

    setShowInteractiveChatChoices(false);
    setChatMessages(prev => [
      ...prev,
      {
        role: 'patient',
        text: `Prefiero atenderme el mismo día (16 de Noviembre) con el médico disponible: ${doc}.`,
        time: new Date().toLocaleTimeString()
      },
      {
        role: 'ai',
        text: `¡Perfecto! Para asegurar que su valoración preventiva no se demore, su cita ha quedado asignada para el 16 de Noviembre a las 11:00 hrs con el ${doc} (${esp}). Su expediente ha sido compartido con el médico.`,
        time: new Date().toLocaleTimeString()
      }
    ]);

    await handleAgendarCita(undefined, {
      fecha: '2026-11-16',
      hora: '11:00',
      doctor_asignado: doc,
      especialidad: esp,
      motivo: `Check-up preventivo asignado el mismo día con médico de turno (${doc}) por ocupación de médico de cabecera`
    });
  };

  // Simular escalamiento complejo a agente humano
  const handleSimularEscalamiento = async () => {
    const problema = `El paciente ${patientName} (${callerId}) consulta sobre interacción farmacológica adversa entre antihipertensivo y suplemento herbolario, manifestando cefalea aguda. El agente Gemini 1.5 detecta riesgo clínico y transfiere a especialista humano.`;
    
    setChatMessages(prev => [
      ...prev,
      {
        role: 'patient',
        text: '¿Puedo tomar extracto de Ginkgo Biloba junto con mi Losartán? Siento presión en la cabeza desde ayer.',
        time: new Date().toLocaleTimeString()
      },
      {
        role: 'ai',
        text: 'Atención: Detecto una posible interacción farmacodinámica y síntoma de alarma. Para tu seguridad, transfiero esta llamada de inmediato a nuestro médico especialista en línea (Ext. 2001) y abro un caso prioritario.',
        time: new Date().toLocaleTimeString()
      },
      {
        role: 'system',
        text: '⚠️ Desvío SIP REFER ejecutado hacia Extensión 2001. Caso registrado en CBR para aprendizaje automático.',
        time: new Date().toLocaleTimeString()
      }
    ]);

    try {
      await fetch('/api/cbr-casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          caller_id: callerId,
          paciente_nombre: patientName,
          categoria: 'farmacovigilancia_citas',
          problema_descripcion: problema
        })
      });
      await fetchCasosCBR();
    } catch (err) {
      console.error('Error al registrar caso CBR:', err);
    }
  };

  // Resolver caso por el agente humano y auto-entrenar CBR
  const handleResolverCaso = async (casoId: string) => {
    const sol = resolucionTexto[casoId];
    if (!sol || !sol.trim()) return;

    setResolvingId(casoId);
    try {
      const res = await fetch('/api/cbr-casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          id: casoId,
          solucion_aplicada: sol.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage('¡Caso resuelto por el especialista humano! La solución se indexó en la memoria CBR para auto-entrenamiento del agente IA.');
        await fetchCasosCBR();
        setTimeout(() => setStatusMessage(null), 4500);
      }
    } catch (err) {
      console.error('Error al resolver caso:', err);
    } finally {
      setResolvingId(null);
    }
  };

  // Cancelar cita
  const handleCancelarCita = async (citaId: string) => {
    try {
      await fetch('/api/citas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: citaId, estado: 'cancelada' })
      });
      await fetchCitas();
    } catch (err) {
      console.error('Error cancelando cita:', err);
    }
  };

  // Médicos sustitutos disponibles (todos menos el de cabecera)
  const medicosSustitutosDisponibles = PLANTILLA_MEDICOS.filter(
    (m) => m.nombre !== medicoCabeceraActual
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner Principal de Consultas Médicas & Gemini IA */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl border border-teal-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 bg-teal-500/20 text-teal-300 rounded-xl border border-teal-500/30">
                <Stethoscope className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold tracking-tight">Consultas Médicas & Agendamiento de Citas IA</h2>
              <span className="bg-teal-500/20 text-teal-300 text-xs font-mono px-2.5 py-0.5 rounded-full border border-teal-500/40 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" /> Opción 4 IVR • Gemini 1.5
              </span>
              <span className="bg-blue-500/20 text-blue-300 text-xs font-mono px-2.5 py-0.5 rounded-full border border-blue-500/40 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Servidor MCP Calendario
              </span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed max-w-3xl">
              Al ingresar en la <strong>Opción 4</strong>, la IA valida el <strong>CallerID</strong> (antiguo vs. nuevo). Si la fecha/hora con su <strong>médico de cabecera está ocupada</strong>, el agente le ofrece de inmediato la alternativa: <strong>reagendar al próximo día libre con su médico de cabecera</strong> o <strong>asignar la fecha requerida con un médico disponible</strong>.
            </p>
          </div>

          {/* Selector Rápido de Pacientes de Prueba */}
          <div className="bg-slate-900/90 border border-slate-700/80 p-3 rounded-xl space-y-2 text-xs w-full lg:w-auto min-w-[280px]">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              Probar con CallerID:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCallerId('1001')}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold transition text-xs ${
                  callerId === '1001' 
                    ? 'bg-teal-500 text-slate-950 shadow-md' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                1001 (Carlos)
              </button>
              <button
                onClick={() => setCallerId('1002')}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold transition text-xs ${
                  callerId === '1002' 
                    ? 'bg-teal-500 text-slate-950 shadow-md' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                1002 (Mariana)
              </button>
              <button
                onClick={() => setCallerId('1003')}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold transition text-xs ${
                  callerId === '1003' 
                    ? 'bg-teal-500 text-slate-950 shadow-md' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                1003 (Roberto)
              </button>
              <button
                onClick={() => setCallerId('+525544998811')}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold transition text-xs ${
                  callerId === '+525544998811' 
                    ? 'bg-amber-500 text-slate-950 shadow-md' 
                    : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
                }`}
              >
                +525544... (Nuevo)
              </button>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={callerId}
                onChange={(e) => setCallerId(e.target.value)}
                placeholder="Ingresar otro CallerID..."
                className="bg-slate-950 border border-slate-700 text-white px-2.5 py-1 rounded-lg text-xs font-mono w-full focus:outline-none focus:border-teal-400"
              />
              <button
                onClick={() => fetchPatientData(callerId)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 rounded-lg transition"
                title="Actualizar datos"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 p-3 bg-teal-500/20 border border-teal-500/40 rounded-xl text-teal-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Grid Principal de 3 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna 1: Validación CallerID & Historial Clínico (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Tarjeta de Verificación de Paciente */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <User className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Identificación por CallerID
                  </h3>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    ID: {callerId}
                  </span>
                </div>
              </div>

              {isExistingPatient ? (
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
                  <UserCheck className="w-3.5 h-3.5" /> Paciente Antiguo
                </span>
              ) : (
                <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-amber-200">
                  <UserX className="w-3.5 h-3.5" /> Paciente Nuevo
                </span>
              )}
            </div>

            {/* Nombre y Detalles de Identificación */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Nombre del Paciente:</span>
              <p className="text-sm font-bold text-slate-800">{patientName}</p>
            </div>

            {/* Ficha Clínica del Paciente */}
            {isExistingPatient && clinicalHistory ? (
              <div className="space-y-3.5 pt-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> Última Consulta:
                    </span>
                    <span className="font-bold text-slate-700 font-mono">
                      {clinicalHistory.fecha_ultima_consulta}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Último Motivo Registrado:</span>
                    <p className="text-slate-700 font-semibold">{clinicalHistory.ultimo_motivo}</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Diagnóstico Previo:</span>
                    <span className="inline-block mt-0.5 px-2 py-0.5 bg-rose-50 text-rose-700 font-semibold rounded-md border border-rose-200/80">
                      {clinicalHistory.diagnostico_previo}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                    <span>Médico de Cabecera:</span>
                    <strong className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {medicoCabeceraActual}
                    </strong>
                  </div>
                </div>

                {/* Sugerencia Preventiva de la IA Gemini */}
                <div className="p-3.5 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-xl border border-indigo-200 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-indigo-700 font-bold">
                    <Brain className="w-4 h-4 text-purple-600" />
                    <span>Recomendación Preventiva Gemini IA</span>
                  </div>
                  <p className="text-slate-700 text-[11px] leading-relaxed italic bg-white/70 p-2.5 rounded-lg border border-indigo-100">
                    "{clinicalHistory.sugerencia_preventiva_ia}"
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Sin Registro Médico Previo</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  El número <strong>{callerId}</strong> no cuenta con un historial clínico previo. El agente de IA aperturará su expediente clínico durante la llamada y agendará una consulta de Medicina General para primera valoración.
                </p>
              </div>
            )}

            {/* Acción de llamada Outbound directa */}
            {onCallPatient && (
              <button
                onClick={() => onCallPatient(callerId)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow-sm"
              >
                <PhoneCall className="w-3.5 h-3.5 text-teal-400" />
                <span>Llamar a Paciente ({callerId})</span>
              </button>
            )}
          </div>

          {/* Formulario de Agendamiento en Calendario MCP */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                  <CalendarCheck className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Agendar Cita en Calendario
                  </h3>
                  <p className="text-[11px] text-slate-400">Sincronización con Supabase & Servidor MCP</p>
                </div>
              </div>

              {/* Botón para forzar verificación o simular conflicto */}
              <button
                type="button"
                onClick={() => setConflictDetected(!conflictDetected)}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                  conflictDetected 
                    ? 'bg-amber-100 text-amber-800 border-amber-300' 
                    : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                }`}
                title="Simular que el médico de cabecera tiene ocupada la fecha/hora seleccionada"
              >
                {conflictDetected ? '⚠️ Conflicto Activo' : 'Simular Conflicto'}
              </button>
            </div>

            {/* MODAL / BANNER DE CONFLICTO DE DISPONIBILIDAD DEL MÉDICO DE CABECERA */}
            {conflictDetected && (
              <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400 rounded-xl space-y-3 text-xs animate-in fade-in">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-900 text-xs">
                      Horario Ocupado con su Médico de Cabecera
                    </h4>
                    <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                      El <strong>{medicoCabeceraActual}</strong> ya cuenta con una cita confirmada para el <strong>{nuevaFecha}</strong> a las <strong>{nuevaHora}</strong>.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-amber-200/80">
                  <span className="text-[10px] font-bold text-amber-950 uppercase tracking-wider block">
                    ¿Qué prefiere el paciente? (Opciones IA):
                  </span>

                  {/* Opción A: Reagendar con Médico de Cabecera */}
                  <div className="p-2.5 bg-white/90 rounded-lg border border-amber-300 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                        Opción A: Seguir con Médico de Cabecera
                      </span>
                      <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-bold font-mono">
                        {proximaFechaCabecera} • {proximaHoraCabecera}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Reagendar al próximo día libre con el <strong>{medicoCabeceraActual}</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={handleElegirReagendarCabecera}
                      className="w-full py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-[11px] rounded-lg transition active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <CalendarCheck className="w-3.5 h-3.5" />
                      <span>Reagendar con {medicoCabeceraActual}</span>
                    </button>
                  </div>

                  {/* Opción B: Mantener Fecha y Hora con Médico Disponible */}
                  <div className="p-2.5 bg-white/90 rounded-lg border border-amber-300 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                        Opción B: Mantener Fecha/Hora con Médico Disponible
                      </span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold font-mono">
                        {nuevaFecha} • {nuevaHora}
                      </span>
                    </div>
                    <label className="text-[10px] text-slate-500 font-semibold block">
                      Seleccionar médico sustituto disponible en ese horario:
                    </label>
                    <select
                      value={selectedSubstituteDoctor}
                      onChange={(e) => setSelectedSubstituteDoctor(e.target.value)}
                      className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {medicosSustitutosDisponibles.map((m) => (
                        <option key={m.nombre} value={m.nombre}>
                          {m.nombre} — {m.especialidad}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleElegirMantenerHorarioSustituto(selectedSubstituteDoctor)}
                      className="w-full py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-[11px] rounded-lg transition active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <CalendarCheck className="w-3.5 h-3.5" />
                      <span>Asignar Cita con {selectedSubstituteDoctor}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={(e) => handleAgendarCita(e)} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Fecha de la Cita:</label>
                <input
                  type="date"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Horario Solicitado:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['09:00', '10:30', '12:00', '15:30', '17:00', '18:15'].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setNuevaHora(h)}
                      className={`py-1.5 px-2 rounded-lg font-mono text-center font-bold transition ${
                        nuevaHora === h 
                          ? 'bg-teal-600 text-white shadow-xs' 
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Especialidad Médica:</label>
                <select
                  value={nuevaEspecialidad}
                  onChange={(e) => setNuevaEspecialidad(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="Cardiología Preventiva">Cardiología Preventiva</option>
                  <option value="Medicina General">Medicina General</option>
                  <option value="Gastroenterología">Gastroenterología</option>
                  <option value="Endocrinología / Diabetes">Endocrinología / Diabetes</option>
                  <option value="Neumología">Neumología</option>
                  <option value="Pediatría">Pediatría</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-600 font-semibold">Médico Asignado:</label>
                  {nuevoDoctor === medicoCabeceraActual && (
                    <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded">
                      Médico de Cabecera
                    </span>
                  )}
                </div>
                <select
                  value={nuevoDoctor}
                  onChange={(e) => setNuevoDoctor(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {PLANTILLA_MEDICOS.map((m) => (
                    <option key={m.nombre} value={m.nombre}>
                      {m.nombre} ({m.especialidad}) {m.nombre === medicoCabeceraActual ? '★ Cabecera' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Motivo / Notas Clínicas:</label>
                <textarea
                  value={nuevoMotivo}
                  onChange={(e) => setNuevoMotivo(e.target.value)}
                  rows={2}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none text-[11px]"
                />
              </div>

              <button
                type="submit"
                disabled={isBooking}
                className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-bold rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>{isBooking ? 'Agendando Cita...' : 'Confirmar Cita en Calendario'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Columna 2: Simulador Conversacional Opción 4 Gemini IA (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl p-5 space-y-4 flex flex-col h-[780px]">
            {/* Header del Simulador */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
                  <Bot className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Simulador IVR Opción 4 (Gemini IA)
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-teal-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                    <span>Llamada en Curso • PBX Asterisk VM</span>
                  </div>
                </div>
              </div>

              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                CallerID: {callerId}
              </span>
            </div>

            {/* Flujo de Diálogo en Tiempo Real */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {chatMessages.map((msg, idx) => {
                if (msg.role === 'system') {
                  return (
                    <div key={idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-400 font-mono flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                      <span>{msg.text}</span>
                    </div>
                  );
                }

                if (msg.role === 'ai') {
                  return (
                    <div key={idx} className="flex gap-2.5 items-start">
                      <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-sm">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="flex-1 bg-slate-900 border border-teal-500/30 rounded-2xl p-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-teal-300 font-bold">
                          <span>Agente Clínico Gemini IA</span>
                          <span className="font-mono text-slate-500">{msg.time}</span>
                        </div>
                        <p className="text-slate-200 text-xs leading-relaxed whitespace-pre-line">{msg.text}</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="flex gap-2.5 items-start justify-end">
                    <div className="flex-1 bg-blue-950/80 border border-blue-500/30 rounded-2xl p-3 space-y-1 text-right">
                      <div className="flex items-center justify-between text-[10px] text-blue-300 font-bold">
                        <span className="font-mono text-slate-500">{msg.time}</span>
                        <span>Paciente ({callerId})</span>
                      </div>
                      <p className="text-slate-200 text-xs leading-relaxed text-left whitespace-pre-line">{msg.text}</p>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-sm">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}

              {/* Botones de decisión interactiva dentro del chat */}
              {showInteractiveChatChoices && (
                <div className="p-3 bg-slate-900/90 border-2 border-teal-500/60 rounded-2xl space-y-2 animate-in fade-in">
                  <span className="text-[11px] text-teal-300 font-bold flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />
                    Opciones de Respuesta del Paciente (Conflicto de Horario):
                  </span>
                  
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={handleElegirReagendarCabecera}
                      className="w-full text-left p-2.5 bg-teal-950/80 hover:bg-teal-900/80 border border-teal-500/40 rounded-xl text-teal-200 text-xs font-semibold flex items-center justify-between transition active:scale-95 group"
                    >
                      <div className="space-y-0.5">
                        <span className="block font-bold text-white group-hover:text-teal-300">
                          1. Reagendar con Médico de Cabecera
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Próximo día disponible: Lunes 23 de Noviembre, 11:30 AM ({medicoCabeceraActual})
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-teal-400 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleElegirMantenerHorarioSustituto('Dra. Elena Patricia Castillo')}
                      className="w-full text-left p-2.5 bg-blue-950/80 hover:bg-blue-900/80 border border-blue-500/40 rounded-xl text-blue-200 text-xs font-semibold flex items-center justify-between transition active:scale-95 group"
                    >
                      <div className="space-y-0.5">
                        <span className="block font-bold text-white group-hover:text-blue-300">
                          2. Mantener Fecha Solicitada con Médico Disponible
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Viernes 20 de Noviembre, 10:30 AM con Dra. Elena Patricia Castillo
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Controles de Simulación de Diálogo */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                Simular Escenarios del Flujo Clínico:
              </span>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleSimularConflictoCabecera}
                  className="w-full py-2 bg-gradient-to-r from-amber-900/60 to-orange-950/60 hover:from-amber-800/60 hover:to-orange-900/60 border border-amber-500/40 text-amber-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Simular: Médico de Cabecera Ocupado (Ofrecer Alternativas)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSimularEscalamiento}
                  className="w-full py-2 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Simular: Fallo IA / Escalar a Humano (Ext. 2001)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Columna 3: Agenda de Citas & Memoria de Entrenamiento CBR (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Agenda de Citas Programadas (citas_calendario) con soporte Paciente y Doctor */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                  <Calendar className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Agenda de Citas ({citas.length})
                  </h3>
                  <p className="text-[10px] text-slate-400">Tabla: citas_calendario • Supabase Cloud</p>
                </div>
              </div>

              <button
                onClick={() => fetchCitas(agendaViewMode, callerId, selectedDoctorAgenda)}
                className="p-1.5 text-slate-400 hover:text-slate-600 transition"
                title="Refrescar citas"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCitas ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Banner de Sincronización en Tiempo Real */}
            <div className="flex items-center justify-between text-[10px] text-emerald-800 bg-emerald-50/90 px-2.5 py-1 rounded-lg border border-emerald-200">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Sincronizado en Tiempo Real (IVR Asterisk ↔ CRM)
              </span>
              <span className="font-mono text-[9px] bg-emerald-200/60 text-emerald-900 px-1.5 py-0.2 rounded font-bold">
                WebSocket Activo
              </span>
            </div>

            {/* Selector de Vista: Por Paciente vs Por Doctor vs Todos */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAgendaViewMode('paciente');
                    fetchCitas('paciente', callerId, selectedDoctorAgenda);
                  }}
                  className={`py-1 rounded-lg transition text-center ${
                    agendaViewMode === 'paciente' 
                      ? 'bg-white text-teal-800 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Por Paciente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAgendaViewMode('doctor');
                    fetchCitas('doctor', callerId, selectedDoctorAgenda);
                  }}
                  className={`py-1 rounded-lg transition text-center ${
                    agendaViewMode === 'doctor' 
                      ? 'bg-white text-teal-800 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Por Doctor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAgendaViewMode('todos');
                    fetchCitas('todos', callerId, selectedDoctorAgenda);
                  }}
                  className={`py-1 rounded-lg transition text-center ${
                    agendaViewMode === 'todos' 
                      ? 'bg-white text-teal-800 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
              </div>

              {/* Selector de Doctor específico si está en modo Doctor */}
              {agendaViewMode === 'doctor' && (
                <div className="animate-in fade-in space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">
                    Calendario del Doctor:
                  </label>
                  <select
                    value={selectedDoctorAgenda}
                    onChange={(e) => {
                      const doc = e.target.value;
                      setSelectedDoctorAgenda(doc);
                      fetchCitas('doctor', callerId, doc);
                    }}
                    className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    {PLANTILLA_MEDICOS.map((m) => (
                      <option key={m.nombre} value={m.nombre}>
                        {m.nombre} ({m.especialidad})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {citas.map((cita) => {
                const isConfirmed = cita.estado === 'confirmada';
                const isCancelled = cita.estado === 'cancelada';
                const isCabecera = cita.doctor_asignado === medicoCabeceraActual;
                return (
                  <div
                    key={cita.id}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${
                      isConfirmed 
                        ? 'bg-teal-50/60 border-teal-200' 
                        : isCancelled 
                        ? 'bg-rose-50/50 border-rose-200 opacity-70' 
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 truncate max-w-[160px]">
                        {cita.paciente_nombre}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isConfirmed 
                            ? 'bg-teal-100 text-teal-800' 
                            : isCancelled 
                            ? 'bg-rose-100 text-rose-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {cita.estado}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span className="font-mono font-semibold flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" /> {cita.fecha} • {cita.hora}
                      </span>
                      <span className="font-mono text-slate-500 font-bold">
                        {cita.caller_id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>
                        <strong>{cita.especialidad}</strong> — {cita.doctor_asignado || 'Médico Asignado'}
                      </span>
                      {isCabecera && (
                        <span className="text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-bold">
                          Cabecera
                        </span>
                      )}
                    </div>

                    {cita.motivo && (
                      <p className="text-[10px] text-slate-500 italic bg-white/60 p-1.5 rounded border border-slate-200/50">
                        {cita.motivo}
                      </p>
                    )}

                    {isConfirmed && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleCancelarCita(cita.id)}
                          className="text-[10px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" /> Cancelar Cita
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {citas.length === 0 && (
                <div className="py-6 text-center text-slate-400 text-xs italic">
                  No hay citas registradas para este filtro.
                </div>
              )}
            </div>
          </div>

          {/* Escalamiento Humano & Entrenamiento Automático CBR (cbr_casos) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <BookOpen className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Casos Escalados & Memoria CBR
                  </h3>
                  <p className="text-[11px] text-slate-400">Entrenamiento Automático de IA con Feedback Humano</p>
                </div>
              </div>

              <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                {casosCBR.filter(c => c.estado === 'pendiente_humano').length} Pendientes
              </span>
            </div>

            <div className="space-y-3 max-h-[310px] overflow-y-auto pr-1">
              {casosCBR.map((caso) => {
                const isPending = caso.estado === 'pendiente_humano';
                return (
                  <div
                    key={caso.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-2.5 transition ${
                      isPending 
                        ? 'bg-purple-50/60 border-purple-200 ring-1 ring-purple-300' 
                        : 'bg-emerald-50/40 border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        {caso.paciente_nombre || 'Paciente'} ({caso.caller_id})
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isPending 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isPending ? 'Pendiente Humano' : 'Entrenado CBR'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-700 leading-relaxed bg-white/80 p-2 rounded-lg border border-slate-200/60">
                      <strong>Problema Clínico Complejo:</strong> {caso.problema_descripcion}
                    </p>

                    {isPending ? (
                      <div className="space-y-2 pt-1">
                        <label className="text-[10px] font-bold text-purple-900 block uppercase">
                          Solución del Especialista Humano (Ext. 2001):
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Escribe la solución médica para resolver el caso y entrenar a la IA..."
                          value={resolucionTexto[caso.id] || ''}
                          onChange={(e) => setResolucionTexto({ ...resolucionTexto, [caso.id]: e.target.value })}
                          className="w-full p-2 bg-white border border-purple-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleResolverCaso(caso.id)}
                          disabled={resolvingId === caso.id}
                          className="w-full py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
                        >
                          <Brain className="w-3.5 h-3.5 text-purple-300" />
                          <span>{resolvingId === caso.id ? 'Entrenando Memoria CBR...' : 'Resolver y Auto-Entrenar IA'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-2 bg-emerald-100/70 rounded-lg text-[11px] text-emerald-900 space-y-1">
                        <div className="flex items-center gap-1 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Solución Aprendida:</span>
                        </div>
                        <p className="italic text-emerald-800">{caso.solucion_aplicada}</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {casosCBR.length === 0 && (
                <div className="py-6 text-center text-slate-400 text-xs italic">
                  No hay casos clínicos escalados en la memoria.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
