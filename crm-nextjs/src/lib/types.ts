export interface Customer {
  id: string;
  caller_id: string; // Identificador primario de número telefónico
  nombre_completo: string;
  empresa: string;
  direccion: string;
  numero_tarjeta_mask: string;
  saldo: number;
  estatus_tarjeta?: number; // 1: Activa, 2: Cancelada/Bloqueada
  folio_cancelacion?: string; // Folio Oficial de Cancelación YYYY-MM-DD-XXXX-YYYY
  fecha_cancelacion?: string;
  motivo_cancelacion?: string;
  email: string;
  telefonos_adicionales: string[];
  fecha_nacimiento: string;
  agente_asignado: string;
  compras_previas: Array<{
    item: string;
    fecha: string;
    total: number;
  }>;
}

export interface CallLog {
  id: string;
  caller_id: string;
  cliente_id?: string;
  tipo: 'entrante' | 'saliente';
  estado?: 'en_curso' | 'finalizada' | 'perdida' | 'transferida';
  duracion_segundos: number;
  opcion_ivr_seleccionada?: string;
  folio_cancelacion?: string;
  transcripcion_texto?: string;
  resumen_ia?: string;
  notas_agente?: string;
  grabacion_url?: string;
  fecha_hora: string;
}

export interface CancelacionLog {
  id: string;
  cliente_id: string;
  folio_cancelacion: string;
  caller_id: string;
  numero_tarjeta_mask: string;
  estatus_anterior: number;
  estatus_nuevo: number;
  motivo: string;
  canal: string;
  saldo_al_momento: number;
  created_at: string;
}

export interface OrderDelivery {
  id: string;
  cliente_id: string;
  folio_pedido: string;
  descripcion_compra: string;
  monto_total: number;
  fecha_pedido: string;
  fecha_estimada_entrega: string;
  estado_entrega: 'En preparación' | 'En ruta' | 'Entregado' | 'Reprogramado' | 'Cancelado';
  notificado_al_cliente: boolean;
  notas_entrega?: string;
}

// Modelos para el Módulo de Consultas y Citas Médicas (Opción 4 IVR)
export interface CitaMedica {
  id: string;
  caller_id: string;
  cliente_id?: string | null;
  paciente_nombre: string;
  fecha: string; // YYYY-MM-DD
  hora: string;  // HH:MM
  especialidad: string;
  motivo: string;
  estado: 'confirmada' | 'cancelada' | 'en_espera' | 'completada' | 'atendida' | 'reprogramada';
  doctor_asignado?: string;
  notas_ia?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HistorialClinico {
  id: string;
  caller_id: string;
  cliente_id?: string | null;
  paciente_nombre: string;
  fecha_ultima_consulta: string;
  ultimo_motivo: string;
  diagnostico_previo: string;
  sugerencia_preventiva_ia: string;
  doctor_asignado?: string;
  doctor_id?: string;
  receta_medicamentos?: string;
  notas_evolucion?: string;
  signos_vitales?: {
    presion?: string;
    temperatura?: string;
    fc?: string;
    glucosa?: string;
    peso?: string;
  };
  proxima_cita?: string;
  folio_receta?: string;
  created_at?: string;
}

export interface Doctor {
  id: string;
  usuario: string;
  password_hash?: string;
  nombre_completo: string;
  especialidad: string;
  cedula_profesional: string;
  email?: string;
  telefono?: string;
  consultorio?: string;
  activo?: boolean;
}

export interface CbrCaso {
  id: string;
  categoria: string;
  caller_id?: string;
  paciente_nombre?: string;
  problema_descripcion: string;
  solucion_aplicada?: string;
  resolucion_exitosa: boolean;
  veces_utilizado?: number;
  estado?: 'pendiente_humano' | 'resuelto_entrenado';
  created_at?: string;
}
