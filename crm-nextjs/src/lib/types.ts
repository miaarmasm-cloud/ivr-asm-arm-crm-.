export interface Customer {
  id: string;
  caller_id: string; // Identificador primario de número telefónico
  nombre_completo: string;
  empresa: string;
  direccion: string;
  numero_tarjeta_mask: string;
  saldo: number;
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
  transcripcion_texto?: string;
  resumen_ia?: string;
  notas_agente?: string;
  grabacion_url?: string;
  fecha_hora: string;
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
