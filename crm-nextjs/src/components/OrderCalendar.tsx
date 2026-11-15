'use client';

import React, { useState } from 'react';
import { OrderDelivery } from '@/lib/types';
import { 
  Calendar as CalendarIcon, 
  Package, 
  Bell, 
  CheckCircle, 
  Clock, 
  Truck, 
  AlertCircle,
  Plus,
  Send,
  Check,
  MapPin,
  CalendarDays
} from 'lucide-react';

interface Props {
  orders: OrderDelivery[];
  customerId: string;
  onNotifyCustomer: (orderId: string) => void;
  onAddOrder?: (newOrder: OrderDelivery) => void;
}

export default function OrderCalendar({ orders, customerId, onNotifyCustomer, onAddOrder }: Props) {
  const [notifiedMap, setNotifiedMap] = useState<Record<string, boolean>>({});
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [folioInput, setFolioInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [montoInput, setMontoInput] = useState('2500');
  const [fechaEntregaInput, setFechaEntregaInput] = useState('2026-02-20');
  const [notasInput, setNotasInput] = useState('Entregar en horario de oficina');

  const filteredOrders = orders.filter(o => o.cliente_id === customerId);

  const handleNotify = (orderId: string) => {
    onNotifyCustomer(orderId);
    setNotifiedMap(prev => ({ ...prev, [orderId]: true }));
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descInput.trim() || !customerId) return;
    const newOrd: OrderDelivery = {
      id: `ord-${Date.now()}`,
      cliente_id: customerId,
      folio_pedido: folioInput.trim() || `PED-2026-${Math.floor(100 + Math.random() * 900)}`,
      descripcion_compra: descInput.trim(),
      monto_total: parseFloat(montoInput) || 0,
      fecha_pedido: new Date().toISOString().split('T')[0],
      fecha_estimada_entrega: fechaEntregaInput,
      estado_entrega: 'En preparación',
      notificado_al_cliente: false,
      notas_entrega: notasInput
    };
    if (onAddOrder) {
      onAddOrder(newOrd);
    }
    setIsAddingOrder(false);
    setDescInput('');
    setFolioInput('');
  };

  const getStatusBadge = (estado: OrderDelivery['estado_entrega']) => {
    switch (estado) {
      case 'Entregado':
        return (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Entregado
          </span>
        );
      case 'En ruta':
        return (
          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
            <Truck className="w-3 h-3" /> En Ruta
          </span>
        );
      case 'En preparación':
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" /> En Preparación
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {estado}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Calendario de Entregas & Pedidos
            </h3>
            <span className="text-[11px] text-slate-400">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido programado' : 'pedidos programados'}
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsAddingOrder(!isAddingOrder)}
          className="text-xs flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl shadow-sm transition active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" /> Programar Entrega
        </button>
      </div>

      {/* Formulario para Crear / Agendar Pedido */}
      {isAddingOrder && (
        <form onSubmit={handleCreateOrder} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-2.5 animate-in fade-in">
          <div className="text-xs font-bold text-slate-700 uppercase">Nuevo Envío Programado</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-semibold text-slate-500">Folio (Opcional)</label>
              <input
                type="text"
                placeholder="PED-2026-..."
                value={folioInput}
                onChange={(e) => setFolioInput(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500">Fecha Estimada</label>
              <input
                type="date"
                value={fechaEntregaInput}
                onChange={(e) => setFechaEntregaInput(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500">Descripción de Productos</label>
            <input
              type="text"
              placeholder="ej. Teléfono IP Grandstream + Diadema"
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              required
              className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-semibold text-slate-500">Monto Total ($ MXN)</label>
              <input
                type="number"
                value={montoInput}
                onChange={(e) => setMontoInput(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500">Notas de Entrega</label>
              <input
                type="text"
                value={notasInput}
                onChange={(e) => setNotasInput(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingOrder(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm"
            >
              Guardar Pedido
            </button>
          </div>
        </form>
      )}

      {/* Lista de Pedidos */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            const isNotified = notifiedMap[order.id] || order.notificado_al_cliente;

            return (
              <div 
                key={order.id} 
                className="p-4 bg-slate-50/70 border border-slate-200/90 rounded-xl text-xs space-y-3 hover:bg-slate-50 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Package className="w-4 h-4 text-indigo-600" /> Folio: {order.folio_pedido}
                  </span>
                  {getStatusBadge(order.estado_entrega)}
                </div>

                <p className="text-slate-700 font-semibold text-xs">{order.descripcion_compra}</p>

                {/* Tarjetas métricas del pedido */}
                <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200/80 text-slate-600">
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Fecha de Entrega</span>
                    <span className="font-bold text-indigo-800 text-xs flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-indigo-600" /> {order.fecha_estimada_entrega}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Total del Pedido</span>
                    <span className="font-bold text-slate-800 text-xs font-mono">
                      ${order.monto_total.toFixed(2)} MXN
                    </span>
                  </div>
                </div>

                {order.notas_entrega && (
                  <p className="text-slate-500 text-[11px] bg-slate-100/70 px-2 py-1 rounded">
                    <span className="font-semibold text-slate-600">Instrucciones:</span> {order.notas_entrega}
                  </p>
                )}

                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">
                    Sincronizado con CRM
                  </span>

                  <button
                    onClick={() => handleNotify(order.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition active:scale-95 ${
                      isNotified
                        ? 'bg-slate-200 text-slate-600 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                    }`}
                  >
                    {isNotified ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Notificación Enviada
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Notificar al Cliente
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-slate-400 text-xs italic">
            No hay entregas programadas en el calendario para este cliente.
          </div>
        )}
      </div>
    </div>
  );
}
