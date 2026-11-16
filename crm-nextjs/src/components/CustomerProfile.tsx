'use client';

import React, { useState } from 'react';
import { Customer } from '@/lib/types';
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
  ShoppingBag, 
  Save, 
  CheckCircle, 
  RefreshCw, 
  AlertCircle,
  FileText,
  UserCheck,
  Send,
  XCircle,
  Clock,
  Sparkles,
  CheckCircle2,
  Lock,
  Unlock,
  AlertTriangle,
  Copy,
  Check,
  Tag
} from 'lucide-react';

interface Props {
  customer: Customer | null;
  onSaveCustomer: (updated: Customer) => void;
  onCallNumber: (phone: string) => void;
  onLogAdded?: (note: string) => void;
}

export default function CustomerProfile({ customer, onSaveCustomer, onCallNumber, onLogAdded }: Props) {
  const [formData, setFormData] = useState<Customer | null>(customer);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedFolio, setCopiedFolio] = useState(false);
  
  // Estados para acciones API directas
  const [isQueryingBalance, setIsQueryingBalance] = useState(false);
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Cliente solicita cancelación por protocolo de seguridad');
  
  // Estado para gestión y notas de aclaración al desbloquear
  const [unblockNotes, setUnblockNotes] = useState('Incidencia aclarada con el cliente. Reactivación y desbloqueo autorizado por ejecutivo.');

  React.useEffect(() => {
    setFormData(customer);
    setIsSaved(false);
    setBalanceMessage(null);
    setStatusMessage(null);
    if (customer?.motivo_cancelacion) {
      setUnblockNotes(`Aclaración sobre "${customer.motivo_cancelacion}": Identidad validada y reactivación autorizada.`);
    } else {
      setUnblockNotes('Incidencia aclarada con el cliente. Reactivación y desbloqueo autorizado por ejecutivo.');
    }
  }, [customer]);

  if (!formData) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 flex flex-col items-center justify-center min-h-[460px] text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 border border-slate-200">
          <User className="w-10 h-10" />
        </div>
        <h3 className="text-base font-bold text-slate-800">Ningún cliente seleccionado</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
          Seleccione un contacto de la barra lateral, busque por CallerID o simule una llamada entrante (Screen-Pop).
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

  const handleCopyFolio = (folio: string) => {
    if (!folio) return;
    navigator.clipboard.writeText(folio);
    setCopiedFolio(true);
    setTimeout(() => setCopiedFolio(false), 2000);
  };

  // Consulta de saldo en vivo contra la API de Next.js / Supabase
  const handleQueryLiveBalance = async () => {
    if (!formData) return;
    setIsQueryingBalance(true);
    setBalanceMessage(null);
    try {
      const res = await fetch(`/api/saldo?caller_id=${encodeURIComponent(formData.caller_id)}`);
      const data = await res.json();
      if (res.ok && data.found) {
        if (data.saldo_bloqueado) {
          setBalanceMessage(`Aviso: ${data.mensaje} (Tarjeta en Estatus 2)`);
        } else {
          setFormData(prev => prev ? ({ ...prev, saldo: data.saldo }) : null);
          setBalanceMessage(`Saldo sincronizado en vivo: ${data.saldo_formateado}`);
          if (onLogAdded) {
            onLogAdded(`Consulta de saldo en vivo vía API: Saldo verificado de $${data.saldo} MXN.`);
          }
        }
      } else {
        setBalanceMessage(`Aviso: ${data.message || 'No se pudo sincronizar el saldo'}`);
      }
    } catch (e: any) {
      setBalanceMessage(`Error al consultar saldo: ${e.message}`);
    } finally {
      setIsQueryingBalance(false);
      setTimeout(() => setBalanceMessage(null), 4000);
    }
  };

  // Desbloquear / Reactivar Tarjeta (Estatus 1) con Notas de Aclaración
  const handleUnblockCard = async () => {
    if (!formData) return;
    setIsUpdatingStatus(true);
    setStatusMessage(null);

    const motivoFinal = unblockNotes.trim() || 'Aclaración de incidencia y reactivación autorizada por ejecutivo';

    try {
      const res = await fetch('/api/cancelacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id: formData.caller_id,
          cliente_id: formData.id,
          nuevo_estatus: 1,
          motivo: motivoFinal,
          canal: 'CRM_AGENTE'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const updatedCustomer: Customer = {
          ...formData,
          estatus_tarjeta: 1,
          folio_cancelacion: undefined,
          fecha_cancelacion: undefined,
          motivo_cancelacion: motivoFinal
        };
        setFormData(updatedCustomer);
        onSaveCustomer(updatedCustomer);

        const msg = `¡TARJETA DESBLOQUEADA Y REACTIVADA (Estatus 1)! El saldo y las operaciones han sido restablecidos en el IVR Asterisk. Nota de aclaración: "${motivoFinal}".`;
        setStatusMessage(msg);
        if (onLogAdded) {
          onLogAdded(msg);
        }
      } else {
        alert(data.error || data.message || 'Error al desbloquear tarjeta');
      }
    } catch (err: any) {
      alert(`Error de conexión: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Cancelar Tarjeta (Estatus 2)
  const handleCancelCard = async () => {
    if (!formData) return;
    setIsUpdatingStatus(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/cancelacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id: formData.caller_id,
          cliente_id: formData.id,
          nuevo_estatus: 2,
          motivo: cancelReason,
          canal: 'CRM_AGENTE'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const folioGen = data.folio_cancelacion || data.folio_operacion;
        const updatedCustomer: Customer = {
          ...formData,
          estatus_tarjeta: 2,
          folio_cancelacion: folioGen,
          fecha_cancelacion: new Date().toISOString(),
          motivo_cancelacion: cancelReason
        };
        setFormData(updatedCustomer);
        onSaveCustomer(updatedCustomer);
        setShowCancelModal(false);

        const msg = `Tarjeta CANCELADA (Estatus 2): Saldo bloqueado en IVR Asterisk. Folio Oficial: ${folioGen}`;
        setStatusMessage(msg);
        if (onLogAdded) {
          onLogAdded(msg);
        }
      } else {
        alert(data.error || data.message || 'Error al cancelar tarjeta');
      }
    } catch (err: any) {
      alert(`Error de conexión: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const isCardActive = (formData.estatus_tarjeta ?? 1) === 1;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col gap-6">
      {/* Encabezado y Acciones Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full font-mono">
              CallerID: {formData.caller_id}
            </span>
            <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verificado por PBX
            </span>
            {isCardActive ? (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Estatus 1: Tarjeta Activa (Saldo Habilitado)
              </span>
            ) : (
              <span className="bg-rose-100 text-rose-800 border-2 border-rose-400 text-xs font-extrabold px-3 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm animate-pulse">
                <Lock className="w-3.5 h-3.5 text-rose-700" /> Estatus 2: Tarjeta Cancelada / Bloqueada
              </span>
            )}
            {formData.folio_cancelacion && !isCardActive && (
              <button
                type="button"
                onClick={() => handleCopyFolio(formData.folio_cancelacion || '')}
                className="bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 text-xs font-mono font-extrabold px-3 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm transition active:scale-95"
                title="Haga clic para copiar el Folio de Cancelación"
              >
                <Tag className="w-3 h-3 text-rose-700" /> Folio: {formData.folio_cancelacion}
                {copiedFolio ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-rose-600" />}
              </button>
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mt-2">{formData.nombre_completo}</h2>
          <p className="text-xs text-slate-500">{formData.empresa || 'Empresa no asignada'}</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => onCallNumber(formData.caller_id)}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
          >
            <Phone className="w-4 h-4" /> Llamar Outbound
          </button>

          {isCardActive ? (
            <button
              onClick={() => setShowCancelModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
            >
              <XCircle className="w-4 h-4" /> Cancelar Tarjeta (Estatus 2)
            </button>
          ) : (
            <button
              onClick={handleUnblockCard}
              disabled={isUpdatingStatus}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95"
              title="Desbloquear tarjeta y restaurar saldo en IVR"
            >
              {isUpdatingStatus ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
              <span>Desbloquear Tarjeta (Estatus 1)</span>
            </button>
          )}

          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 ${
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

      {/* Alertas / Mensajes de Operación */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border text-xs flex items-center justify-between shadow-sm animate-in fade-in ${
          isCardActive 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center gap-2.5 font-bold">
            {isCardActive ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span>{statusMessage}</span>
          </div>
          <span className="text-[10px] font-mono bg-white px-2.5 py-1 rounded-lg border font-bold text-slate-700">
            Base de Datos Sincronizada
          </span>
        </div>
      )}

      {balanceMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-bold shadow-sm">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{balanceMessage}</span>
        </div>
      )}

      {/* MÓDULO DESTACADO: TARJETA CANCELADA Y GESTIÓN DE DESBLOQUEO */}
      {!isCardActive && (
        <div className="p-5 rounded-2xl border-2 border-rose-400 bg-gradient-to-r from-rose-50 via-rose-50/90 to-amber-50/50 text-slate-800 space-y-4 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-200 text-rose-900 rounded-2xl shadow-inner">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-rose-950 uppercase tracking-wider flex items-center gap-2">
                  <span>Tarjeta Cancelada / Bloqueada en Asterisk IVR</span>
                  <span className="text-[10px] bg-rose-200 text-rose-950 font-mono font-extrabold px-2 py-0.5 rounded-full">
                    Estatus 2 • Bloqueada
                  </span>
                </h4>
                <p className="text-xs text-rose-800 mt-0.5">
                  Las consultas de saldo en la Opción 1 del IVR están bloqueadas. El cliente requiere atención del agente para aclaración y reactivación.
                </p>
              </div>
            </div>

            {formData.folio_cancelacion && (
              <button
                type="button"
                onClick={() => handleCopyFolio(formData.folio_cancelacion || '')}
                className="flex items-center gap-1.5 text-xs font-bold bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 px-3.5 py-1.5 rounded-xl transition shadow-sm active:scale-95"
              >
                {copiedFolio ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-rose-700" />}
                <span>{copiedFolio ? '¡Folio Copiado!' : 'Copiar Folio Oficial'}</span>
              </button>
            )}
          </div>

          {/* Ficha del Folio de Cancelación */}
          <div className="p-4 bg-white/95 border border-rose-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Folio Oficial de Cancelación:</span>
              <span className="text-base font-extrabold font-mono text-rose-950 tracking-wider select-all">
                {formData.folio_cancelacion || '2026-11-15-XXXX-XXXX'}
              </span>
            </div>

            {formData.fecha_cancelacion && (
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Fecha / Hora de Cancelación:</span>
                <span className="text-xs font-mono font-bold text-slate-700">
                  {new Date(formData.fecha_cancelacion).toLocaleString('es-MX')}
                </span>
              </div>
            )}

            {formData.motivo_cancelacion && (
              <div className="sm:col-span-2 text-xs text-slate-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                <span className="font-bold text-rose-900">Motivo de Cancelación Registrado:</span> {formData.motivo_cancelacion}
              </div>
            )}
          </div>

          {/* Formulario de Aclaración y Desbloqueo Inmediato */}
          <div className="p-4 bg-emerald-50/70 border-2 border-emerald-300 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs uppercase tracking-wide">
              <Unlock className="w-4 h-4 text-emerald-700" />
              <span>Aclaración y Desbloqueo de Tarjeta por el Agente</span>
            </div>
            <p className="text-[11px] text-emerald-800">
              Si el cliente ya aclaró el motivo (ej. transacción reconocida, falsa alarma o verificación de identidad satisfactoria), registre las notas de resolución y reactive la tarjeta a <strong>Estatus 1 (Activa)</strong> para restaurar su saldo en el IVR:
            </p>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Notas de Aclaración / Validación del Agente:
              </label>
              <input
                type="text"
                value={unblockNotes}
                onChange={(e) => setUnblockNotes(e.target.value)}
                placeholder="Ej. Cliente aclaró la transacción / Se verificó titularidad y se autoriza reactivación"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleUnblockCard}
                disabled={isUpdatingStatus}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50"
              >
                {isUpdatingStatus ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                <span>Desbloquear y Reactivar Tarjeta (Estatus 1 - Activa)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Datos Principales del Cliente */}
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
            className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tarjeta Enmascarada */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Tarjeta Asociada
            </label>
            <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded ${
              isCardActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}>
              {isCardActive ? 'ACTIVA (1)' : 'CANCELADA (2)'}
            </span>
          </div>
          <input
            type="text"
            value={formData.numero_tarjeta_mask}
            onChange={(e) => handleChange('numero_tarjeta_mask', e.target.value)}
            className={`w-full text-sm font-mono border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isCardActive ? 'bg-slate-50 border-slate-300' : 'bg-rose-50/50 border-rose-300 text-rose-900 font-bold'
            }`}
          />
        </div>

        {/* Saldo con Tarjeta */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Saldo Registrado (MXN)
            </label>
            <button
              onClick={handleQueryLiveBalance}
              disabled={isQueryingBalance}
              className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 bg-emerald-100/80 px-2 py-0.5 rounded transition"
              title="Consulta REST en vivo a /api/saldo"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isQueryingBalance ? 'animate-spin' : ''}`} />
              <span>Verificar API</span>
            </button>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              value={formData.saldo}
              onChange={(e) => handleChange('saldo', parseFloat(e.target.value) || 0)}
              className={`w-full text-sm font-bold border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isCardActive ? 'text-emerald-700 border-slate-300' : 'text-rose-700 border-rose-300 bg-rose-50/30'
              }`}
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
            className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Teléfonos Adicionales */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
            <Phone className="w-3.5 h-3.5" /> Teléfonos de Contacto Adicionales
          </label>
          <input
            type="text"
            value={formData.telefonos_adicionales?.join(', ') || ''}
            onChange={(e) => handleChange('telefonos_adicionales', e.target.value.split(',').map(s => s.trim()))}
            placeholder="+52..., +52..."
            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Dirección Completa */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5" /> Dirección de Entrega / Facturación
          </label>
          <input
            type="text"
            value={formData.direccion}
            onChange={(e) => handleChange('direccion', e.target.value)}
            className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Historial de Compras ("Qué Compró") */}
      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
          <ShoppingBag className="w-4 h-4 text-blue-600" /> Historial de Compras Previas
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {formData.compras_previas && formData.compras_previas.length > 0 ? (
            formData.compras_previas.map((c, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
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

      {/* Modal de Confirmación de Cancelación */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-800">Confirmar Cancelación de Tarjeta</h3>
                <p className="text-xs text-slate-500">Se generará un folio oficial y se bloqueará en IVR.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p><span className="font-bold text-slate-700">Cliente:</span> {formData.nombre_completo}</p>
              <p><span className="font-bold text-slate-700">Tarjeta:</span> {formData.numero_tarjeta_mask}</p>
              <p><span className="font-bold text-slate-700">CallerID:</span> {formData.caller_id}</p>
              <p className="text-[11px] text-rose-600 font-bold pt-1">
                Nomenclatura: [YYYY-MM-DD]-{formData.numero_tarjeta_mask?.slice(-4)}-{formData.caller_id?.slice(-4)}
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Motivo de Cancelación:</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancelCard}
                disabled={isUpdatingStatus}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                {isUpdatingStatus ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                <span>Generar Folio y Cancelar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
