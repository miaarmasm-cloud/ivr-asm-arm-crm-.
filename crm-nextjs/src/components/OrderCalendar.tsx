'use client';

import React, { useState } from 'react';
import { OrderDelivery } from '@/lib/types';
import { Calendar as CalendarIcon, Package, Bell, CheckCircle, Clock, Truck, AlertCircle } from 'lucide-react';

interface Props {
  orders: OrderDelivery[];
  customerId: string;
  onNotifyCustomer: (orderId: string) => void;
}

export default function OrderCalendar({ orders, customerId, onNotifyCustomer }: Props) {
  const [notifiedMap, setNotifiedMap] = useState<Record<string, boolean>>({});

  const filteredOrders = orders.filter(o => o.cliente_id === customerId);

  const handleNotify = (orderId: string) => {
    onNotifyCustomer(orderId);
    setNotifiedMap(prev => ({ ...prev, [orderId]: true }));
  };

  const getStatusBadge = (estado: OrderDelivery['estado_entrega']) => {
    switch (estado) {
      case 'Entregado':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Entregado</span>;
      case 'En ruta':
        return <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><Truck className="w-3 h-3" /> En Ruta</span>;
      case 'En preparación':
        return <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><Clock className="w-3 h-3" /> En Preparación</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded">{estado}</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-indigo-600" /> Calendario de Pedidos y Fechas de Entrega
        </h3>
        <span className="text-xs text-slate-500 font-medium">
          {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido programado' : 'pedidos programados'}
        </span>
      </div>

      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            const isNotified = notifiedMap[order.id] || order.notificado_al_cliente;
            return (
              <div key={order.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                    <Package className="w-4 h-4 text-indigo-600" /> Folio: {order.folio_pedido}
                  </span>
                  {getStatusBadge(order.estado_entrega)}
                </div>

                <p className="text-slate-700 font-medium">{order.descripcion_compra}</p>

                <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded border border-slate-200 text-slate-600">
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-semibold">Fecha Estimada Entrega</span>
                    <span className="font-bold text-slate-800 text-sm flex items-center gap-1 text-indigo-700">
                      <CalendarIcon className="w-3.5 h-3.5" /> {order.fecha_estimada_entrega}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-semibold">Total del Pedido</span>
                    <span className="font-bold text-slate-800 text-sm">
                      ${order.monto_total.toFixed(2)} MXN
                    </span>
                  </div>
                </div>

                {order.notas_entrega && (
                  <p className="text-slate-500 italic text-[11px]">
                    <span className="font-semibold text-slate-600">Indicaciones:</span> {order.notas_entrega}
                  </p>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleNotify(order.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition ${
                      isNotified
                        ? 'bg-slate-200 text-slate-600 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    {isNotified ? 'Notificación Enviada al Cliente' : 'Notificar Fecha de Entrega'}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-slate-400 italic py-4 text-center">
            No hay entregas programadas en el calendario para este cliente.
          </p>
        )}
      </div>
    </div>
  );
}
