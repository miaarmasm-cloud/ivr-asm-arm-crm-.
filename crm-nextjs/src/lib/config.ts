'use client';

// Configuración dinámica de entorno para Máquina Virtual (VM) o Localhost
export interface VMConnectionConfig {
  mode: 'localhost' | 'vm_ip' | 'custom';
  vmHost: string;
  middlewarePort: string;
  asteriskWsPort: string;
  asteriskSipPort: string;
  livekitPort: string;
  useSsl: boolean;
}

const STORAGE_KEY = 'crm_arm_vm_config';

export const DEFAULT_VM_CONFIG: VMConnectionConfig = {
  mode: 'vm_ip',
  vmHost: process.env.NEXT_PUBLIC_VM_HOST || '192.168.216.128',
  middlewarePort: '8000',
  asteriskWsPort: '8088',
  asteriskSipPort: '5060',
  livekitPort: '7880',
  useSsl: false,
};

export function getVMConfig(): VMConnectionConfig {
  if (typeof window === 'undefined') return DEFAULT_VM_CONFIG;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_VM_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Error leyendo config de VM:', e);
  }
  return DEFAULT_VM_CONFIG;
}

export function saveVMConfig(config: VMConnectionConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error guardando config de VM:', e);
  }
}

export function getComputedUrls(config: VMConnectionConfig) {
  const host = config.vmHost || 'localhost';
  const httpProtocol = config.useSsl ? 'https' : 'http';
  const wsProtocol = config.useSsl ? 'wss' : 'ws';

  return {
    middlewareUrl: `${httpProtocol}://${host}:${config.middlewarePort}`,
    asteriskWsUrl: `${wsProtocol}://${host}:${config.asteriskWsPort}/ws`,
    livekitWsUrl: `${wsProtocol}://${host}:${config.livekitPort}`,
    asteriskSipAddress: `${host}:${config.asteriskSipPort}`,
  };
}
