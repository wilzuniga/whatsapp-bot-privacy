# Bot de WhatsApp - Patronato Nueva Tatumbla

Bot automatizado de WhatsApp para consulta de estado de cuenta de cuotas y pagos.

## Descripción

Este bot permite a los miembros del Patronato Nueva Tatumbla consultar su información de pagos vía WhatsApp, buscando por número de teléfono o número de lote.

## Caracteristicas

- Busqueda por numero de telefono
- Busqueda por numero de lote
- Respuestas automaticas inteligentes
- Contexto de conversacion (preguntas de seguimiento)
- Integracion con Google Sheets como base de datos
- Uso de IA solo para extraccion de intencion

## Stack Tecnológico

- **Runtime**: Node.js 20
- **Framework**: Firebase Functions (v2)
- **Base de datos**: Google Sheets
- **Contexto**: Firestore
- **IA**: OpenAI (gpt-4o-mini)
- **Mensajería**: WhatsApp Cloud API

## Número del Bot

**+504 9712-4409**

## Documentacion

Toda la documentacion se encuentra en la carpeta `/docs`:

- [Indice de Documentacion](docs/00-INDICE.md)
- [Arquitectura General](docs/01-ARQUITECTURA-GENERAL.md)
- [Estructura del Proyecto](docs/02-ESTRUCTURA-PROYECTO.md)
- [Flujo de Mensajes](docs/03-FLUJO-MENSAJES.md)
- [Servicios](docs/04-SERVICIOS.md)
- [Deploy](docs/05-DEPLOY.md)
- [Casos Especiales](docs/06-CASOS-ESPECIALES.md)
- [Archivos Clave](docs/07-ARCHIVOS-CLAVE.md)
- [Instructivo General](docs/08-INSTRUCTIVO-GENERAL.md)
- [Cuentas y Servicios](docs/09-CUENTAS-Y-SERVICIOS.md)
- [Factura](docs/10-FACTURA.md)
- [Actualización de Datos](docs/11-ACTUALIZACION-DATOS.md)

## Comandos Rápidos

```bash
# Instalar dependencias
cd functions && npm install

# Compilar
npm run build

# Deploy
cd .. && firebase deploy --only functions

# Ver logs
firebase functions:log --only webhook
```

## Google Sheet

**URL**: https://docs.google.com/spreadsheets/d/12sRLkCSImXssL0vBBWUvuTQpow8osg9s7SRKkPiu8kg/

**Hoja**: Vista_Bot Valores

## Estructura del Proyecto

```
whatsapp-bot/
├── docs/                    # Documentación
├── functions/
│   ├── src/                # Código TypeScript
│   │   ├── index.ts       # Webhook principal
│   │   ├── handlers/      # Lógica de mensajes
│   │   ├── services/      # Integraciones
│   │   └── utils/         # Utilidades
│   ├── .env               # Variables de entorno
│   └── package.json
├── firebase.json
└── README.md
```

## Licencia

Proyecto desarrollado para Patronato Nueva Tatumbla.

## Desarrollador

**Wilmer Zúñiga**  
Febrero 2026
