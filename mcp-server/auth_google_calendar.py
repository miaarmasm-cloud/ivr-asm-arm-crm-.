import os
import sys
import json

# Forzar flush de stdout
sys.stdout.reconfigure(line_buffering=True)

from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, 'google_credentials.json')
TOKEN_FILE = os.path.join(BASE_DIR, 'google_token.json')

def authenticate():
    creds = None
    if os.path.exists(TOKEN_FILE):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
            if creds and creds.valid:
                print(f"[AUTH] Token existente y valido en: {TOKEN_FILE}")
        except Exception as e:
            print(f"[AUTH] Error al cargar token existente: {e}")
            creds = None

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("[AUTH] Refrescando token expirado...")
            creds.refresh(Request())
        else:
            print("[AUTH] Preparando flujo OAuth 2.0...")
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            print("[AUTH] Abriendo navegador para autorizacion con Google Calendar...")
            creds = flow.run_local_server(
                port=0,
                open_browser=True,
                access_type='offline',
                prompt='consent',
                success_message="Autorizacion completada con exito para MIA ARM / MCP! Puedes cerrar esta ventana."
            )

        with open(TOKEN_FILE, 'w', encoding='utf-8') as token:
            token.write(creds.to_json())
            print(f"[AUTH] Token guardado exitosamente en: {TOKEN_FILE}")

    # Probar servicio
    service = build('calendar', 'v3', credentials=creds)
    calendars = service.calendarList().list().execute()
    primary = next((c for c in calendars.get('items', []) if c.get('primary')), None)
    print(f"[SUCCESS] Conexion exitosa con Google Calendar! Calendario principal: {primary.get('summary') if primary else 'OK'}")
    return creds

if __name__ == '__main__':
    authenticate()
