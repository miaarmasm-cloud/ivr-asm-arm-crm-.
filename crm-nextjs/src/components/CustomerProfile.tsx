'use client';

import React, { useState } from 'react';
import { Customer } from '@/lib/types';
import { User, Building, MapPin, CreditCard, DollarSign, Mail, Phone, Calendar, ShieldCheck, ShoppingBag, Save, CheckCircle } from 'lucide-react';

interface Props {
  customer: Customer | null;
  onSaveCustomer: (updated: Customer) => void;
  onCallNumber: (phone: string) => void;
}

export default function CustomerProfile({ customer, onSaveCustomer, onCallNumber }: Props) {
  const [formData, setFormData] = useState<Customer | null>(customer);
  const [isSaved, setIsSaved] = useState(false);

  React.useEffect(() => {
    setFormData(customer);
    setIsSaved(false);
  }, [customer]);

  if (!formData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[420px] text-center">
        <User className="w-16 h-16 text-slate-300 mb-3" />
        <h3 className="text-lg font-semibold text-slate-700">Ningún cliente seleccionado</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-1">
          Busque por CallerID (teléfono), espere una llamada entrante (Screen-Pop) o seleccione uno de la lista.
        </p>
      </div>
    );
  }

  const handleChange = (field: keyof Customer, value: any) => {
    setFormData(prev => prev ? ({ ...prev, [field]: value }) : null);
    setIsSaved(false);
  };

  const handleSave = () => {
    if (formData) {
      onSaveCustomer(formData);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
      {/* Encabezado y Acción Guardar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              CallerID Primario: {formData.caller_id}
            </span>
            <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verificado por IVR
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mt-1">{formData.nombre_completo}</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onCallNumber(formData.caller_id)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
          >
            <Phone className="w-4 h-4" /> Llamar Outbound
          </button>

          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm ${
              isSaved 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSaved ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Save className="w-4 h-4" />}
            {isSaved ? 'Guardado con éxito' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* Grid de Datos del Cliente */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Nombre Completo */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
            <User className="w-3.5 h-3.5" /> Nombre Completo
          </label>
          <input
            type="text"
            value={formData.nombre_completo}
            onChange={(e) => handleChange('nombre_completo', e.target.value)}
            className="w-full text-sm font-medium border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Empresa */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
            <Building className="w-3.5 h-3.5" /> Empresa
          </label>
          <input
            type="text"
            value={formData.empresa}
            onChange={(e) => handleChange('empresa', e.target.value)}
            className="w-full text-sm font-medium border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Correo Electrónico */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
            <Mail className="w-3.5 h-3.5" /> Correo Electrónico
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="w-full text-sm font-medium border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tarjeta Enmascarada */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
            <CreditCard className="w-3.5 h-3.5" /> Número de Tarjeta (Enmascarada)
          </label>
          <input
            type="text"
            value={formData.numero_tarjeta_mask}
            onChange={(e) => handleChange('numero_tarjeta_mask', e.target.value)}
            className="w-full text-sm font-mono border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
          />
        </div>

        {/* Saldo con Tarjeta */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Saldo Disponible (MXN)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              value={formData.saldo}
              onChange={(e) => handleChange('saldo', parseFloat(e.target.value) || 0)}
              className="w-full text-sm font-bold text-emerald-700 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Fecha de Nacimiento */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
            <Calendar className="w-3.5 h-3.5" /> Fecha de Nacimiento
          </label>
          <input
            type="date"
            value={formData.fecha_nacimiento}
            onChange={(e) => handleChange('fecha_nacimiento', e.target.value)}
            className="w-full text-sm font-medium border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Agente Asignado */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Agente Asignado
          </label>
          <input
            type="text"
            value={formData.agente_asignado}
            onChange={(e) => handleChange('agente_asignado', e.target.value)}
            className="w-full text-sm font-medium border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Teléfonos Adicionales */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
            <Phone className="w-3.5 h-3.5" /> Teléfonos de Contacto Adicionales
          </label>
          <input
            type="text"
            value={formData.telefonos_adicionales.join(', ')}
            onChange={(e) => handleChange('telefonos_adicionales', e.target.value.split(',').map(s => s.trim()))}
            placeholder="+52..., +52..."
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Dirección Completa */}
        <div className="md:col-span-2 lg:col-span-1">
          <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5" /> Dirección de Entrega / Facturación
          </label>
          <input
            type="text"
            value={formData.direccion}
            onChange={(e) => handleChange('direccion', e.target.value)}
            className="w-full text-sm font-medium border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Historial de Compras ("Qué Compró") */}
      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
          <ShoppingBag className="w-4 h-4 text-blue-600" /> Historial de Compras Previas
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {formData.compras_previas.length > 0 ? (
            formData.compras_previas.map((c, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <p className="font-semibold text-slate-800">{c.item}</p>
                <div className="flex justify-between items-center text-slate-500 mt-1">
                  <span>{c.fecha}</span>
                  <span className="font-bold text-slate-700">${c.total.toFixed(2)} MXN</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic">No hay compras registradas para este cliente.</p>
          )}
        </div>
      </div>
    </div>
  );
}
