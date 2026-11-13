import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CRM ARM - Telefonía SIP & Clientes',
  description: 'Sistema CRM con integración nativa a IVR, Asterisk PBX, Screen-Pop y WebRTC Outbound Dialer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen bg-slate-100">{children}</body>
    </html>
  );
}
