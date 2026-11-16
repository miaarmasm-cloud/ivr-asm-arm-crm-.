'use client';

import React, { useState, useEffect } from 'react';
import { Customer } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { 
  User, 
  Building, 
  MapPin, 
  CreditCard, 
  DollarSign, 
  Mail, 
  Phone, 
  Calendar, 
  ShieldCheck, 
  Save, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  Eye,
  EyeOff,
  UserPlus,
  Edit3,
  Layers
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialCustomer?: Customer | null;
  mode?: 'create' | 'edit';
  existingCustomers?: Customer[];
  onCustomerSaved: (customer: Customer, isNew: boolean) => void;
}

export default function CustomerRegistrationModal({
  isOpen,
  onClose,
  initialCustomer,
  mode = 'create',
  existingCustomers = [],
  onCustomerSaved
}: Props) {
  const [currentMode, setCurrentMode] = useState<'create' | 'edit'>(mode);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<Customer | null>(null);
  
  // Enmascaramiento deshabilitado por defecto para captura clara de dígitos de tarjeta
  const [showCardDigits, setShowCardDigits] = useState(true);

  // Campos del formulario homologados con la tabla 'clientes' de Supabase
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [callerId, setCallerId] = useState('');
  const [telefonosAdicionales, setTelefonosAdicionales] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [direccion, setDireccion] = useState('');
  const [email, setEmail] = useState('');
  const [numeroTarjetaRaw, setNumeroTarjetaRaw] = useState('');
  const [saldo, setSaldo] = useState<number>(0);
  const [estatusTarjeta, setEstatusTarjeta] = useState<number>(1);
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [agenteAsignado, setAgenteAsignado] = useState('Ext. 2001 (Agente Demo)');

  useEffect(() => {
    if (initialCustomer && currentMode === 'edit') {
      setNombreCompleto(initialCustomer.nombre_completo || '');
      setCallerId(initialCustomer.caller_id || '');
      setTelefonosAdicionales((initialCustomer.telefonos_adicionales || []).join(', '));
      setEmpresa(initialCustomer.empresa || '');
      setDireccion(initialCustomer.direccion || '');
      setEmail(initialCustomer.email || '');
      setNumeroTarjetaRaw(initialCustomer.numero_tarjeta_mask || '');
      setSaldo(Number(initialCustomer.saldo) || 0);
      setEstatusTarjeta(initialCustomer.estatus_tarjeta ?? 1);
      setFechaNacimiento(initialCustomer.fecha_nacimiento || '');
      setAgenteAsignado(initialCustomer.agente_asignado || 'Ext. 2001 (Agente Demo)');
    } else {
      // Limpiar o precargar valores por defecto para alta
      setNombreCompleto(initialCustomer?.nombre_completo || '');
      setCallerId(initialCustomer?.caller_id || '');
      setTelefonosAdicionales('');
      setEmpresa(initialCustomer?.empresa !== 'Empresa por registrar' ? (initialCustomer?.empresa || '') : '');
      setDireccion(initialCustomer?.direccion !== 'Por capturar' ? (initialCustomer?.direccion || '') : '');
      setEmail(initialCustomer?.email || '');
      setNumeroTarjetaRaw('');
      setSaldo(initialCustomer?.saldo || 0);
      setEstatusTarjeta(1);
      setFechaNacimiento(initialCustomer?.fecha_nacimiento || '1985-01-01');
      setAgenteAsignado('Ext. 2001 (Agente Demo)');
    }
    setErrorMsg(null);
    setDuplicateWarning(null);
  }, [initialCustomer, currentMode, isOpen]);

  if (!isOpen) return null;

  // Validación de CallerID duplicado en tiempo real
  const handleCallerIdChange = (val: string) => {
    setCallerId(val);
    const clean = val.trim();
    if (clean.length >= 4 && currentMode === 'create') {
      const match = existingCustomers.find(c => 
        c.caller_id === clean || 
        (clean.startsWith('77') && c.caller_id === clean.substring(2)) ||
        (!clean.startsWith('77') && c.caller_id === `77${clean}`) ||
        (c.telefonos_adicionales && c.telefonos_adicionales.includes(clean))
      );
      if (match) {
        setDuplicateWarning(match);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  };

  // Convertir número de tarjeta sin enmascarar a formato homologado con máscara para BD
  const buildCardMask = (raw: string) => {
    const digitos = raw.replace(/\D/g, '');
    if (digitos.length >= 4) {
      const last4 = digitos.slice(-4);
      return `**** **** **** ${last4}`;
    }
    if (raw.trim().length > 0) {
      return raw.trim();
    }
    return 'Pendiente de Asignación';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCompleto.trim() || !callerId.trim() || !empresa.trim()) {
      setErrorMsg('Nombre completo, CallerID y Empresa son campos obligatorios.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const cleanCaller = callerId.trim();
    const maskFinal = buildCardMask(numeroTarjetaRaw);
    const addPhones = telefonosAdicionales
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const payload: Partial<Customer> = {
      caller_id: cleanCaller,
      nombre_completo: nombreCompleto.trim(),
      empresa: empresa.trim(),
      direccion: direccion.trim() || 'Dirección por registrar',
      email: email.trim() || `${cleanCaller}@cliente-arm.com`,
      numero_tarjeta_mask: maskFinal,
      saldo: Number(saldo) || 0,
      estatus_tarjeta: Number(estatusTarjeta) || 1,
      fecha_nacimiento: fechaNacimiento || '1990-01-01',
      agente_asignado: agenteAsignado.trim() || 'Ext. 2001',
      telefonos_adicionales: addPhones
    };

    try {
      if (currentMode === 'create') {
        // MODO INSERT: Alta de nuevo cliente o lead
        if (isSupabaseConfigured()) {
          const { data, error } = await supabase
            .from('clientes')
            .insert({
              caller_id: payload.caller_id,
              nombre_completo: payload.nombre_completo,
              empresa: payload.empresa,
              direccion: payload.direccion,
              email: payload.email,
              numero_tarjeta_mask: payload.numero_tarjeta_mask,
              saldo: payload.saldo,
              estatus_tarjeta: payload.estatus_tarjeta,
              fecha_nacimiento: payload.fecha_nacimiento,
              agente_asignado: payload.agente_asignado,
              telefonos_adicionales: payload.telefonos_adicionales,
              compras_previas: []
            })
            .select()
            .single();

          if (error) {
            throw new Error(error.message);
          }

          // Registrar en bitácora
          await supabase.from('llamadas_bitacora').insert({
            caller_id: cleanCaller,
            cliente_id: data.id,
            tipo: 'entrante',
            estado: 'finalizada',
            opcion_ivr_seleccionada: payload.saldo === 0 ? 'Alta de Lead Nuevo' : 'Alta de Cliente y Tarjeta',
            resumen_ia: `Alta de ${payload.saldo === 0 ? 'Lead Prospecto' : 'Cliente Titular'} ejecutada en CRM por ${payload.agente_asignado}: ${payload.nombre_completo} (${payload.empresa}). Tarjeta: ${maskFinal}. Saldo: $${payload.saldo} MXN.`
          });

          onCustomerSaved(data as Customer, true);
        } else {
          const fakeCustomer: Customer = {
            id: `c-${Date.now()}`,
            ...(payload as Customer),
            compras_previas: []
          };
          onCustomerSaved(fakeCustomer, true);
        }
      } else {
        // MODO UPDATE: Corrección o modificación de expediente existente
        const targetId = initialCustomer?.id;
        if (!targetId) throw new Error('ID de cliente no encontrado para actualización.');

        if (isSupabaseConfigured()) {
          const { data, error } = await supabase
            .from('clientes')
            .update({
              caller_id: payload.caller_id,
              nombre_completo: payload.nombre_completo,
              empresa: payload.empresa,
              direccion: payload.direccion,
              email: payload.email,
              numero_tarjeta_mask: payload.numero_tarjeta_mask,
              saldo: payload.saldo,
              estatus_tarjeta: payload.estatus_tarjeta,
              fecha_nacimiento: payload.fecha_nacimiento,
              agente_asignado: payload.agente_asignado,
              telefonos_adicionales: payload.telefonos_adicionales,
              updated_at: new Date().toISOString()
            })
            .eq('id', targetId)
            .select()
            .single();

          if (error) throw new Error(error.message);

          // Registrar auditoría de actualización
          await supabase.from('llamadas_bitacora').insert({
            caller_id: cleanCaller,
            cliente_id: targetId,
            tipo: 'saliente',
            estado: 'finalizada',
            opcion_ivr_seleccionada: 'Modificación de Expediente',
            resumen_ia: `Modificación de expediente guardada en CRM por asesor: ${payload.nombre_completo}. Tarjeta asignada: ${maskFinal}, Saldo actualizado: $${payload.saldo} MXN.`
          });

          onCustomerSaved(data as Customer, false);
        } else {
          const updated: Customer = {
            ...initialCustomer,
            ...(payload as Customer)
          };
          onCustomerSaved(updated, false);
        }
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(`Error al guardar en base de datos: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-2xl w-full space-y-5 animate-in fade-in zoom-in-95 my-8">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${currentMode === 'create' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {currentMode === 'create' ? <UserPlus className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-800">
                {currentMode === 'create' ? 'Alta de Nuevo Cliente / Prospecto Lead (INSERT)' : 'Modificación y Corrección de Expediente (UPDATE)'}
              </h3>
              <p className="text-xs text-slate-500">
                {currentMode === 'create' 
                  ? 'Capture los datos del nuevo contacto y asigne su tarjeta para habilitar operaciones en el IVR.'
                  : 'Modifique cualquier dato capturado por error tipográfico del asesor.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerta de Coincidencia / Anti-duplicados */}
        {duplicateWarning && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Coincidencia de CallerID detectada: Cliente existente encontrado</span>
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              El número <strong>{callerId}</strong> ya pertenece a: <strong>{duplicateWarning.nombre_completo}</strong> ({duplicateWarning.empresa}) con tarjeta {duplicateWarning.numero_tarjeta_mask}.
            </p>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setCurrentMode('edit');
                  setNombreCompleto(duplicateWarning.nombre_completo);
                  setEmpresa(duplicateWarning.empresa);
                  setSaldo(duplicateWarning.saldo);
                  setNumeroTarjetaRaw(duplicateWarning.numero_tarjeta_mask);
                  setDuplicateWarning(null);
                }}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shadow-xs transition"
              >
                Cargar para Modificar (UPDATE)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTelefonosAdicionales(prev => prev ? `${prev}, ${cleanCaller}` : cleanCaller);
                  setDuplicateWarning(null);
                }}
                className="px-2.5 py-1 bg-white border border-amber-300 text-amber-800 font-bold rounded-lg text-[11px] hover:bg-amber-100 transition"
              >
                Asociar como Teléfono Adicional
              </button>
            </div>
          </div>
        )}

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nombre Completo */}
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">
                Nombre Completo del Titular <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                placeholder="Ej. Lic. Gabriel Morales Ramos"
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* CallerID / Teléfono Principal */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                CallerID Principal (PSTN o Ext.) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={callerId}
                onChange={(e) => handleCallerIdChange(e.target.value)}
                placeholder="Ej. 7711100921 o 1001"
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
            </div>

            {/* Teléfonos Adicionales */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Teléfonos Adicionales (Opcional, separados por coma)
              </label>
              <input
                type="text"
                value={telefonosAdicionales}
                onChange={(e) => setTelefonosAdicionales(e.target.value)}
                placeholder="Ej. 11100921, +527711100921"
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Empresa / Razón Social */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Empresa / Razón Social <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Ej. Corporativo Médico Integral S.A."
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Correo Electrónico */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@empresa.com"
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* ALTA DE TARJETA CON ENMASCARAMIENTO DESHABILITADO */}
            <div className="sm:col-span-2 p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-blue-950 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>Número de Tarjeta (Captura en dígitos visibles sin enmascarar)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowCardDigits(!showCardDigits)}
                  className="text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 bg-white border border-blue-200 px-2 py-0.5 rounded transition"
                >
                  {showCardDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showCardDigits ? 'Ocultar Dígitos' : 'Ver Dígitos'}</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showCardDigits ? 'text' : 'password'}
                  value={numeroTarjetaRaw}
                  onChange={(e) => setNumeroTarjetaRaw(e.target.value)}
                  placeholder="Ej. 4152 8821 7744 0921 (o últimos 4 dígitos)"
                  className="w-full p-2.5 border border-blue-300 rounded-xl bg-white font-mono font-bold text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 tracking-wider"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Al guardar, el CRM almacenará la terminación para validación en el IVR Asterisk por DTMF (Opción 1 y 2).
              </p>
            </div>

            {/* Saldo Inicial */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Saldo Inicial en Cuenta (MXN)
              </label>
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600 absolute left-3 top-3" />
                <input
                  type="number"
                  step="0.01"
                  value={saldo}
                  onChange={(e) => setSaldo(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-emerald-800"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                $0.00 clasifica automáticamente como <strong>Nuevo Lead</strong> en el CRM.
              </span>
            </div>

            {/* Estatus de la Tarjeta */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Estatus Inicial de Tarjeta
              </label>
              <select
                value={estatusTarjeta}
                onChange={(e) => setEstatusTarjeta(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value={1}>Estatus 1: Activa (Habilitada en IVR)</option>
                <option value={2}>Estatus 2: Cancelada / Bloqueada</option>
              </select>
            </div>

            {/* Dirección de Entrega / Facturación */}
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">
                Dirección Completa de Entrega / Facturación
              </label>
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, colonia, alcaldía/municipio, CP"
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Fecha de Nacimiento */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Agente Asignado */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Agente / Asesor Asignado
              </label>
              <input
                type="text"
                value={agenteAsignado}
                onChange={(e) => setAgenteAsignado(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-bold rounded-xl hover:bg-slate-100 transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-xl text-white font-extrabold flex items-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50 ${
                currentMode === 'create'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{currentMode === 'create' ? 'Guardar Cliente en Base de Datos (INSERT)' : 'Guardar Modificaciones (UPDATE)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
