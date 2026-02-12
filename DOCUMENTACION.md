# Documentacion Completa - Bot de WhatsApp
## Patronato Nueva Tatumbla

**Fecha de generacion**: 11 de Febrero de 2026  
**Desarrollador**: Wilmer Zuniga  
**Numero del Bot**: +504 9712-4409

---

# INDICE

1. [Arquitectura General](#1-arquitectura-general)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Flujo de Procesamiento de Mensajes](#3-flujo-de-procesamiento-de-mensajes)
4. [Implementacion de Servicios](#4-implementacion-de-servicios)
5. [Guia de Deploy](#5-guia-de-deploy)
6. [Casos Especiales y Manejo de Errores](#6-casos-especiales-y-manejo-de-errores)
7. [Archivos Clave del Proyecto](#7-archivos-clave-del-proyecto)
8. [Instructivo General](#8-instructivo-general)
9. [Funcionamiento de Cuentas y Servicios](#9-funcionamiento-de-cuentas-y-servicios)
10. [Guia para Actualizacion de Datos](#10-guia-para-actualizacion-de-datos)

---

# 1. ARQUITECTURA GENERAL

## 1.1 Descripcion General

Bot de WhatsApp para consulta de informacion de cuotas y pagos del Patronato Nueva Tatumbla. Permite a los usuarios consultar su estado de cuenta mediante numero de telefono o numero de lote.

## 1.2 Diagrama de Arquitectura

```mermaid
flowchart TB
    subgraph Usuario
        U[Usuario WhatsApp]
    end
    
    subgraph Meta
        WA[WhatsApp Cloud API]
    end
    
    subgraph Firebase
        WH[Firebase Functions - Webhook]
        FS[Firestore - Contexto]
    end
    
    subgraph Externos
        GS[Google Sheets - Base de datos]
        OA[OpenAI API - Extraccion de intencion]
    end
    
    U <--> WA
    WA <--> WH
    WH --> FS
    WH --> GS
    WH --> OA
```

## 1.3 Componentes del Sistema

### WhatsApp Cloud API (Meta)
- **Funcion**: Recibir y enviar mensajes de WhatsApp
- **Webhook**: Recibe notificaciones de mensajes entrantes
- **API de Mensajes**: Envia respuestas al usuario

### Firebase Functions
- **Runtime**: Node.js 20
- **Region**: us-central1
- **Funcion**: `webhook` - Procesa mensajes entrantes y envia respuestas

### Google Sheets
- **Funcion**: Base de datos de registros de usuarios
- **Estructura**: 8 columnas (WhatsApp, Lote, Nombre, Apellido, Cuota, SaldoActual, MesUltimoPago, MontoUltimoPago)
- **Acceso**: Via Google Sheets API con Service Account

### Firestore
- **Funcion**: Almacenar contexto de conversacion
- **TTL**: 24 horas
- **Datos**: Ultimo registro consultado por usuario

### OpenAI API
- **Modelo**: gpt-4o-mini
- **Funcion**: Extraer intencion del mensaje (telefono, lote, o ninguno)
- **Uso limitado**: Solo para extraccion de intencion, no para generar respuestas

## 1.4 Flujo de Datos

1. **Usuario envia mensaje** -> WhatsApp Cloud API
2. **Meta envia webhook** -> Firebase Function
3. **Function procesa mensaje**:
   - Verifica si es respuesta rapida (saludo, gracias, ayuda)
   - Si no, extrae intencion con OpenAI
   - Busca en Google Sheets
   - Guarda contexto en Firestore
4. **Function envia respuesta** -> WhatsApp Cloud API -> Usuario

## 1.5 Seguridad

- **Tokens**: Almacenados como variables de entorno en Firebase
- **Service Account**: Acceso limitado solo a lectura de Sheets
- **Firestore Rules**: Acceso restringido (solo desde Functions)
- **Webhook Verification**: Token de verificacion para validar solicitudes de Meta

## 1.6 Escalabilidad

- **Firebase Functions**: Auto-escalado automatico
- **Limites configurados**:
  - Max instances: 20
  - Timeout: 60 segundos
  - Memory: 256 MiB
  - Concurrency: 80 requests por instancia

---

# 2. ESTRUCTURA DEL PROYECTO

## 2.1 Arbol de Directorios

```
whatsapp-bot/
├── docs/                          # Documentacion
│   ├── index.html                 # Politica de privacidad (GitHub Pages)
│   └── *.md                       # Documentos de documentacion
│
├── functions/                     # Codigo fuente de Firebase Functions
│   ├── src/                       # Codigo TypeScript
│   │   ├── index.ts              # Punto de entrada, webhook principal
│   │   ├── config.ts             # Configuracion y variables de entorno
│   │   ├── types.ts              # Definiciones de tipos TypeScript
│   │   │
│   │   ├── handlers/             # Manejadores de logica
│   │   │   └── message.ts        # Procesamiento de mensajes
│   │   │
│   │   ├── services/             # Servicios externos
│   │   │   ├── sheets.ts         # Google Sheets API
│   │   │   ├── openai.ts         # OpenAI API
│   │   │   ├── whatsapp.ts       # WhatsApp Cloud API
│   │   │   └── context.ts        # Firestore (contexto)
│   │   │
│   │   └── utils/                # Utilidades
│   │       ├── normalize.ts      # Normalizacion de datos
│   │       ├── formatResponse.ts # Formateo de respuestas
│   │       └── quickResponses.ts # Respuestas rapidas sin IA
│   │
│   ├── lib/                      # Codigo compilado (generado)
│   ├── node_modules/             # Dependencias (generado)
│   ├── package.json              # Dependencias y scripts
│   ├── tsconfig.json             # Configuracion TypeScript
│   ├── .env                      # Variables de entorno (NO subir a git)
│   └── .env.example              # Plantilla de variables de entorno
│
├── firebase.json                 # Configuracion de Firebase
├── firestore.rules               # Reglas de seguridad Firestore
├── .firebaserc                   # Proyecto Firebase vinculado
├── .gitignore                    # Archivos ignorados por Git
└── README.md                     # Documentacion principal
```

## 2.2 Descripcion de Archivos Principales

### `/functions/src/index.ts`
Punto de entrada de la funcion. Define el webhook HTTP que:
- Maneja verificacion de webhook (GET)
- Procesa mensajes entrantes (POST)
- Implementa deduplicacion de mensajes

### `/functions/src/config.ts`
Carga y exporta todas las variables de entorno necesarias:
- Credenciales de OpenAI
- Credenciales de Google Sheets
- Credenciales de WhatsApp

### `/functions/src/types.ts`
Define interfaces TypeScript:
- `SheetRecord`: Estructura de un registro del Sheet
- `IntentResult`: Resultado de extraccion de intencion
- `ConversationContext`: Contexto de conversacion
- `WhatsAppMessage`: Mensaje de WhatsApp
- `WhatsAppWebhookPayload`: Payload del webhook

### `/functions/src/handlers/message.ts`
Logica principal de procesamiento:
- Respuestas rapidas
- Extraccion de intencion
- Busqueda en Sheet
- Manejo de contexto
- Envio de respuestas

### `/functions/src/services/`
Integraciones con servicios externos:
- `sheets.ts`: Lectura y busqueda en Google Sheets
- `openai.ts`: Extraccion de intencion con GPT
- `whatsapp.ts`: Envio de mensajes
- `context.ts`: Gestion de contexto en Firestore

### `/functions/src/utils/`
Funciones auxiliares:
- `normalize.ts`: Normaliza telefonos y lotes
- `formatResponse.ts`: Formatea respuestas para WhatsApp
- `quickResponses.ts`: Respuestas sin usar IA

---

# 3. FLUJO DE PROCESAMIENTO DE MENSAJES

## 3.1 Diagrama de Flujo

```mermaid
flowchart TD
    A[Usuario envia mensaje] --> B[Webhook recibe POST]
    B --> C[Responder 200 OK inmediatamente]
    C --> D{Mensaje duplicado?}
    D -->|Si| E[Ignorar - ya procesado]
    D -->|No| F{Es respuesta rapida?}
    F -->|Si| G[Enviar respuesta predefinida]
    F -->|No| H{Contiene numero de telefono?}
    H -->|Si| I[Buscar por telefono]
    H -->|No| J{Contiene 'lote' + numero?}
    J -->|Si| K[Buscar por lote]
    J -->|No| L[Extraer intencion con OpenAI]
    L --> M[Buscar en Google Sheets]
    I --> M
    K --> M
    M --> N{Encontrado?}
    N -->|Si| O[Formatear y enviar datos]
    N -->|No| P[Enviar mensaje 'No encontrado']
    O --> Q[Guardar contexto en Firestore]
```

## 3.2 Respuestas Rapidas (Sin IA)

El sistema detecta patrones comunes y responde sin usar OpenAI:

### Saludos
- Patrones: `hola`, `buenos dias`, `buenas tardes`, `buenas noches`, `hi`, `hello`
- Respuesta: Mensaje de bienvenida con saludo segun hora del dia

### Agradecimientos
- Patrones: `gracias`, `muchas gracias`, `thanks`
- Respuesta: Mensaje de despedida

### Ayuda
- Patrones: `ayuda`, `help`, `como funciona`, `que puedo hacer`
- Respuesta: Instrucciones de uso

### Busqueda Directa por Telefono
- Patron: Solo digitos (8+ caracteres)
- Accion: Buscar directamente por telefono

### Busqueda Directa por Lote
- Patron: `lote X`, `lote: X`, `lote #X`
- Accion: Buscar directamente por lote

## 3.3 Extraccion de Intencion (OpenAI)

Cuando no se detecta un patron rapido, se usa OpenAI:

### Prompt del Sistema
```
Tu tarea es identificar si el usuario esta solicitando informacion por:
- numero de telefono
- numero de lote

Responde unicamente en JSON valido, sin texto adicional.

Formato:
{
  "tipo": "telefono" | "lote" | "ninguno",
  "valor": "string"
}
```

### Ejemplos de Extraccion
| Entrada | Salida |
|---------|--------|
| "Dame los datos del lote 87" | `{"tipo":"lote","valor":"87"}` |
| "50499907652" | `{"tipo":"telefono","valor":"50499907652"}` |
| "Informacion del 9990-7652" | `{"tipo":"telefono","valor":"99907652"}` |
| "Como esta el tiempo?" | `{"tipo":"ninguno","valor":""}` |

## 3.4 Busqueda en Google Sheets

### Por Telefono
1. Normalizar numero (solo digitos)
2. Buscar coincidencia exacta
3. Si no encuentra y son 8 digitos, buscar por ultimos 8 digitos
4. Retornar registro o null

### Por Lote
1. Normalizar lote (minusculas, sin espacios)
2. Buscar usando `includes()` en la columna lote
3. Ejemplo: "87" encuentra "87,88"
4. Retornar registro o null

## 3.5 Formato de Respuesta

### Registro Encontrado
```
Informacion encontrada:

Carlos Alberto Argenal Osorto
Lote: 68
Telefono: 50499907652

Cuota mensual: L 400
Saldo actual: L 0
Ultimo pago: Dic-2025

Puedes preguntarme:
- "Cuanto debo?"
- "Cuando fue mi ultimo pago?"
```

### No Encontrado
```
No encontre informacion para el telefono: 50499999999

Por favor verifica el numero e intenta de nuevo.

Tambien puedes buscar por numero de lote escribiendo "lote" seguido del numero.
```

## 3.6 Contexto de Conversacion

Despues de una busqueda exitosa, se guarda en Firestore:
- Numero de WhatsApp del usuario
- Ultimo registro encontrado
- Timestamp

Esto permite preguntas de seguimiento como:
- "Cuanto debo?"
- "Esta al dia?"
- "Cuando fue el ultimo pago?"

El contexto expira despues de 24 horas.

---

# 4. IMPLEMENTACION DE SERVICIOS

## 4.1 Google Sheets Service (`sheets.ts`)

### Configuracion
```typescript
const SHEET_RANGE = "'Vista_Bot Valores'!A2:H";
```

### Autenticacion
- Usa Google Service Account
- Credenciales: email y private key desde variables de entorno
- Scope: `https://www.googleapis.com/auth/spreadsheets.readonly`

### Mapeo de Columnas
| Indice | Columna Sheet | Campo |
|--------|---------------|-------|
| 0 | A | WhatsApp (telefono) |
| 1 | B | Lote |
| 2 | C | Nombre |
| 3 | D | Apellido |
| 4 | E | Cuota |
| 5 | F | SaldoActual |
| 6 | G | MesUltimoPago |
| 7 | H | MontoUltimoPago |

### Funciones Principales

#### `getSheetData()`
- Obtiene todos los registros del Sheet
- Cachea datos por 5 minutos para optimizar
- Retorna array de `SheetRecord`

#### `findByPhone(phone: string)`
- Normaliza el telefono (solo digitos)
- Busca coincidencia exacta
- Si son 8 digitos, busca por ultimos 8
- Retorna `SheetRecord | null`

#### `findByLote(lote: string)`
- Normaliza el lote
- Usa `includes()` para buscar
- Permite encontrar "87" en "87,88"
- Retorna `SheetRecord | null`

### Parseo de Moneda
```typescript
function parseCurrency(value: string): number {
  // Maneja formatos: "L 200,00", "L200.00", "-L 100,00"
  // Retorna 0 para valores vacios, guiones, o "Sin pagos..."
}
```

---

## 4.2 OpenAI Service (`openai.ts`)

### Configuracion
- Modelo: `gpt-4o-mini`
- Temperatura: 0 (respuestas deterministicas)
- Max tokens: 100

### Prompt del Sistema
```typescript
const SYSTEM_PROMPT = `Tu tarea es identificar si el usuario esta solicitando informacion por:
- numero de telefono
- numero de lote

Responde unicamente en JSON valido, sin texto adicional.

Formato:
{
  "tipo": "telefono" | "lote" | "ninguno",
  "valor": "string"
}`;
```

### Funcion Principal

#### `extractIntent(message: string)`
- Envia mensaje a OpenAI
- Parsea respuesta JSON
- Retorna `IntentResult` con tipo y valor
- Maneja errores y retorna `ninguno` si falla

---

## 4.3 WhatsApp Service (`whatsapp.ts`)

### Configuracion
- API Version: v21.0
- Base URL: `https://graph.facebook.com/v21.0`

### Funciones Principales

#### `sendMessage(to: string, message: string)`
```typescript
// POST a /{phone_id}/messages
// Headers: Authorization: Bearer {token}
// Body: { messaging_product: "whatsapp", to, type: "text", text: { body: message } }
```

#### `parseWebhookPayload(payload)`
- Extrae mensajes del payload de webhook
- Filtra solo mensajes de texto
- Retorna array de `WhatsAppMessage`

#### `verifyWebhook(mode, token, challenge)`
- Verifica que el token coincida
- Retorna challenge si es valido
- Usado para verificacion inicial del webhook

---

## 4.4 Context Service (`context.ts`)

### Configuracion Firestore
- Coleccion: `conversations`
- Documento ID: numero de WhatsApp del usuario

### Estructura del Documento
```typescript
interface ConversationContext {
  lastRecord: SheetRecord;
  timestamp: number;
}
```

### Funciones Principales

#### `getContext(from: string)`
- Obtiene contexto guardado
- Verifica TTL (24 horas)
- Retorna `SheetRecord | null`

#### `saveContext(from: string, record: SheetRecord)`
- Guarda registro en Firestore
- Incluye timestamp actual
- Operacion no bloqueante (fire and forget)

### TTL (Time To Live)
```typescript
const CONTEXT_TTL = 24 * 60 * 60 * 1000; // 24 horas en ms
```

---

## 4.5 Utilidades

### `normalize.ts`

#### `normalizePhone(phone: string)`
- Elimina todo excepto digitos
- Ejemplo: "+504 9990-7652" -> "50499907652"

#### `normalizeLote(lote: string)`
- Convierte a minusculas
- Elimina espacios extras
- Ejemplo: " Lote 87 " -> "lote 87"

### `formatResponse.ts`

#### `formatRecordResponse(record: SheetRecord)`
- Formatea registro para WhatsApp
- Incluye estructura clara
- Agrega sugerencias de seguimiento

#### `formatNotFoundResponse(type, value)`
- Mensaje de no encontrado
- Sugiere alternativas de busqueda

#### `formatFollowUpResponse(question, record)`
- Responde preguntas de seguimiento
- Usa contexto previo

#### `getTimeGreeting()`
- Retorna saludo segun hora
- "Buenos dias" / "Buenas tardes" / "Buenas noches"

### `quickResponses.ts`

#### `getQuickResponse(message: string)`
- Detecta patrones conocidos
- Retorna respuesta o null
- Tipos: greeting, thanks, help, phone, lote, none

---

# 5. GUIA DE DEPLOY

## 5.1 Requisitos Previos

### Software
- Node.js 20 o superior
- npm
- Firebase CLI (`npm install -g firebase-tools`)
- Git (opcional)

### Cuentas
- Cuenta de Firebase (plan Blaze)
- Cuenta de Meta for Developers
- Cuenta de OpenAI
- Cuenta de Google Cloud (para Service Account)

---

## 5.2 Configuracion Inicial

### Clonar/Obtener el Proyecto
```bash
cd C:\Users\wilme\whatsapp-bot
```

### Instalar Dependencias
```bash
cd functions
npm install
```

### Login en Firebase
```bash
firebase login
```

### Verificar Proyecto
```bash
firebase projects:list
```

---

## 5.3 Variables de Entorno

### Crear archivo `.env`
```bash
# En la carpeta functions/
cp .env.example .env
```

### Configurar Variables
Editar `functions/.env`:
```env
OPENAI_API_KEY=sk-proj-xxxxx
GOOGLE_SHEETS_ID=12sRLkCSImXssL0vBBWUvuTQpow8osg9s7SRKkPiu8kg
GOOGLE_SERVICE_ACCOUNT_EMAIL=sheets-reader@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nxxxxx\n-----END PRIVATE KEY-----
WHATSAPP_TOKEN=EAAxxxxx
WHATSAPP_PHONE_ID=986420331224785
WHATSAPP_VERIFY_TOKEN=tu_token_de_verificacion
```

---

## 5.4 Deploy

### Compilar TypeScript
```bash
cd functions
npm run build
```

### Deploy a Firebase
```bash
cd ..
firebase deploy --only functions
```

### Verificar Deploy
La consola mostrara:
```
Function URL (webhook(us-central1)): https://us-central1-PROYECTO.cloudfunctions.net/webhook
```

---

## 5.5 Configuracion del Webhook en Meta

### URL del Webhook
```
https://us-central1-whatsapp-bot-prod-6ccee.cloudfunctions.net/webhook
```

### Token de Verificacion
```
Patronato_tesoreria_el_gato_sube_a_la_silla
```

### Campos Suscritos
- messages (activado)

### Suscripcion del WABA
Si los mensajes no llegan, ejecutar:
```powershell
$headers = @{ 
  "Authorization" = "Bearer TU_TOKEN"
  "Content-Type" = "application/json" 
}
$body = '{
  "override_callback_uri":"https://us-central1-whatsapp-bot-prod-6ccee.cloudfunctions.net/webhook",
  "verify_token":"Patronato_tesoreria_el_gato_sube_a_la_silla"
}'
Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/WABA_ID/subscribed_apps" -Method POST -Headers $headers -Body $body
```

---

## 5.6 Verificar Funcionamiento

### Ver Logs
```bash
firebase functions:log --only webhook
```

### Ver Logs en Tiempo Real
```bash
firebase functions:log --only webhook --follow
```

### Probar Envio de Mensaje
```powershell
$headers = @{ "Authorization" = "Bearer TU_TOKEN"; "Content-Type" = "application/json" }
$body = '{"messaging_product":"whatsapp","to":"NUMERO","type":"text","text":{"body":"Test"}}'
Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/PHONE_ID/messages" -Method POST -Headers $headers -Body $body
```

---

## 5.7 Actualizar el Bot

### Hacer Cambios
Editar archivos en `functions/src/`

### Compilar y Deploy
```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

---

## 5.8 Monitoreo

### Firebase Console
- https://console.firebase.google.com/project/whatsapp-bot-prod-6ccee/functions

### Google Cloud Console
- https://console.cloud.google.com/functions/list?project=whatsapp-bot-prod-6ccee

### Metricas Disponibles
- Invocaciones
- Errores
- Latencia
- Memoria usada

---

# 6. CASOS ESPECIALES Y MANEJO DE ERRORES

## 6.1 Casos de Datos del Sheet

### Registro sin Telefono
- **Situacion**: Columna WhatsApp vacia
- **Manejo**: Solo accesible por numero de lote

### Registro sin Lote
- **Situacion**: Columna Lote vacia o con "---"
- **Manejo**: Solo accesible por numero de telefono

### Multiples Lotes
- **Situacion**: Un registro tiene varios lotes (ej: "87,88" o "A1,A2,A3")
- **Manejo**: Busqueda por `includes()` encuentra cualquiera
- **Ejemplo**: Buscar "87" encuentra "87,88"

### Deuda Vacia o con Guiones
- **Situacion**: SaldoActual vacio, "-", o "L -"
- **Manejo**: Se muestra como "L 0"
- **Codigo**:
```typescript
if (!value || value === '-' || value === 'L -') return 0;
```

### Deuda Negativa (Saldo a Favor)
- **Situacion**: SaldoActual con valor negativo (ej: "-L 100,00")
- **Manejo**: Se muestra el saldo a favor
- **Ejemplo**: "Saldo actual: -L 100 (saldo a favor)"

### Sin Pagos Registrados
- **Situacion**: MesUltimoPago = "Sin pagos registrados desde Enero 2024"
- **Manejo**: Se muestra el texto tal cual
- **No se modifica**: El usuario ve el mensaje original del Sheet

### Formato de Moneda Variable
- **Situacion**: "L 200,00", "L200.00", "L 200"
- **Manejo**: Parser flexible que maneja todos los formatos

---

## 6.2 Casos de Busqueda

### Busqueda por 8 Digitos
- **Situacion**: Usuario envia "99907652" (sin codigo de pais)
- **Manejo**: Busca coincidencia en ultimos 8 digitos
- **Ejemplo**: "99907652" encuentra "50499907652"

### Telefono con Formato
- **Situacion**: Usuario envia "9990-7652" o "+504 9990-7652"
- **Manejo**: Normaliza eliminando todo excepto digitos
- **Resultado**: "50499907652"

### Lote con Prefijo
- **Situacion**: Usuario escribe "lote 87", "Lote: 87", "LOTE #87"
- **Manejo**: Extrae el numero/codigo del lote
- **Patrones detectados**:
  - `lote 87`
  - `lote: 87`
  - `lote #87`
  - `lote87`

### No Encontrado
- **Situacion**: Telefono o lote no existe en el Sheet
- **Manejo**: Mensaje amigable con sugerencias

---

## 6.3 Casos de Contexto

### Pregunta de Seguimiento
- **Situacion**: Usuario pregunta "Cuanto debo?" despues de una busqueda
- **Manejo**: Usa contexto guardado en Firestore
- **Respuestas soportadas**:
  - "Cuanto debo?" -> Muestra saldo actual
  - "Esta al dia?" -> Indica si hay deuda
  - "Cuando fue el ultimo pago?" -> Muestra mes de ultimo pago

### Contexto Expirado
- **Situacion**: Han pasado mas de 24 horas
- **Manejo**: Se pide buscar de nuevo
- **Mensaje**: "No tengo contexto previo. Por favor busca primero por telefono o lote."

### Sin Contexto Previo
- **Situacion**: Usuario pregunta sin haber buscado
- **Manejo**: Igual que contexto expirado

---

## 6.4 Casos de Error

### Error de Google Sheets
- **Situacion**: API de Sheets no responde
- **Manejo**: Mensaje de error al usuario
- **Log**: Se registra el error completo

### Error de OpenAI
- **Situacion**: API de OpenAI falla
- **Manejo**: Se asume intencion "ninguno"
- **Fallback**: Muestra mensaje de ayuda

### Error de WhatsApp API
- **Situacion**: No se puede enviar mensaje
- **Manejo**: Se registra en logs
- **Comun**: Token expirado (error 401)

### Token Expirado
- **Situacion**: Token de WhatsApp expirado
- **Sintoma**: Error 190, "Session has expired"
- **Solucion**: Generar nuevo token permanente

### Mensaje Duplicado
- **Situacion**: Meta envia el mismo mensaje dos veces
- **Manejo**: Deduplicacion por ID de mensaje
- **Implementacion**: Set en memoria con ultimos 1000 IDs

---

## 6.5 Casos de Formato de Respuesta

### Nombre Muy Largo
- **Situacion**: Nombre completo excede lo normal
- **Manejo**: Se muestra completo sin truncar

### Caracteres Especiales
- **Situacion**: Nombres con acentos, n, etc.
- **Manejo**: UTF-8, se muestran correctamente
- **Ejemplo**: "Argenal", "Garcia", "Suarez"

### Formato en WhatsApp
- **Situacion**: Formateo de mensajes
- **Manejo**: Texto plano con estructura clara
- **Elementos**: Titulos, listas, separadores

---

## 6.6 Casos de Horario

### Saludo por Hora
- **05:00 - 11:59**: "Buenos dias"
- **12:00 - 17:59**: "Buenas tardes"  
- **18:00 - 04:59**: "Buenas noches"

### Zona Horaria
- **Configuracion**: America/Tegucigalpa (Honduras)
- **Nota**: Firebase Functions usa UTC, se convierte

---

# 7. ARCHIVOS CLAVE DEL PROYECTO

## 7.1 Configuracion

### `firebase.json`
```json
{
  "functions": {
    "source": "functions"
  },
  "firestore": {
    "rules": "firestore.rules"
  }
}
```
**Proposito**: Configura Firebase para usar la carpeta `functions` y las reglas de Firestore.

---

### `.firebaserc`
```json
{
  "projects": {
    "default": "whatsapp-bot-prod-6ccee"
  }
}
```
**Proposito**: Vincula el proyecto local con el proyecto de Firebase.

---

### `functions/package.json`
```json
{
  "name": "whatsapp-bot-functions",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions"
  },
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "googleapis": "^140.0.0",
    "openai": "^4.52.0"
  }
}
```
**Proposito**: Define dependencias y scripts del proyecto.

---

### `functions/.env`
```env
OPENAI_API_KEY=sk-proj-xxxxx
GOOGLE_SHEETS_ID=12sRLkCSImXssL0vBBWUvuTQpow8osg9s7SRKkPiu8kg
GOOGLE_SERVICE_ACCOUNT_EMAIL=sheets-reader@whatsapp-bot-prod-6ccee.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
WHATSAPP_TOKEN=EAAZCEeo7k5qkBQvCyaHbRAsHE3Xgdls...
WHATSAPP_PHONE_ID=986420331224785
WHATSAPP_VERIFY_TOKEN=Patronato_tesoreria_el_gato_sube_a_la_silla
```
**Proposito**: Variables de entorno sensibles. **NO SUBIR A GIT**.

---

## 7.2 Codigo Fuente Principal

### `functions/src/index.ts`
**Proposito**: Punto de entrada del webhook.

**Funciones clave**:
- Manejo de GET (verificacion de webhook)
- Manejo de POST (mensajes entrantes)
- Deduplicacion de mensajes
- Respuesta inmediata 200 OK

---

### `functions/src/config.ts`
**Proposito**: Centraliza la carga de variables de entorno.

```typescript
export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  googleSheetsId: process.env.GOOGLE_SHEETS_ID || '',
  // ...
};
```

---

### `functions/src/types.ts`
**Proposito**: Define tipos TypeScript.

**Interfaces principales**:
- `SheetRecord`: Registro del Google Sheet
- `IntentResult`: Resultado de OpenAI
- `ConversationContext`: Contexto de Firestore
- `WhatsAppMessage`: Mensaje de WhatsApp

---

### `functions/src/handlers/message.ts`
**Proposito**: Logica principal de procesamiento de mensajes.

**Flujo**:
1. Verificar respuestas rapidas
2. Verificar busqueda directa (telefono/lote)
3. Extraer intencion con OpenAI
4. Buscar en Sheet
5. Enviar respuesta
6. Guardar contexto

---

## 7.3 Servicios

### `functions/src/services/sheets.ts`
**Proposito**: Integracion con Google Sheets API.

**Funciones**:
- `getSheetData()`: Obtener todos los registros
- `findByPhone()`: Buscar por telefono
- `findByLote()`: Buscar por lote

---

### `functions/src/services/openai.ts`
**Proposito**: Extraccion de intencion con GPT.

**Funcion principal**:
- `extractIntent(message)`: Retorna tipo y valor

---

### `functions/src/services/whatsapp.ts`
**Proposito**: Envio de mensajes via WhatsApp API.

**Funciones**:
- `sendMessage()`: Enviar mensaje de texto
- `parseWebhookPayload()`: Parsear payload entrante
- `verifyWebhook()`: Verificar webhook

---

### `functions/src/services/context.ts`
**Proposito**: Manejo de contexto en Firestore.

**Funciones**:
- `getContext()`: Obtener contexto previo
- `saveContext()`: Guardar contexto

---

## 7.4 Utilidades

### `functions/src/utils/quickResponses.ts`
**Proposito**: Respuestas rapidas sin usar IA.

**Patrones detectados**:
- Saludos
- Agradecimientos
- Solicitudes de ayuda
- Busquedas directas

---

### `functions/src/utils/formatResponse.ts`
**Proposito**: Formatear respuestas para WhatsApp.

**Funciones**:
- `formatRecordResponse()`: Formato de registro encontrado
- `formatNotFoundResponse()`: Formato de no encontrado
- `getTimeGreeting()`: Saludo segun hora

---

### `functions/src/utils/normalize.ts`
**Proposito**: Normalizacion de datos.

**Funciones**:
- `normalizePhone()`: Limpiar telefonos
- `normalizeLote()`: Limpiar lotes

---

## 7.5 Seguridad

### `firestore.rules`
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```
**Proposito**: Bloquea acceso directo a Firestore. Solo accesible desde Functions.

---

### `.gitignore`
```
node_modules/
lib/
.env
*.log
```
**Proposito**: Evita subir archivos sensibles o generados a Git.

---

## 7.6 Documentacion

### `docs/index.html`
**Proposito**: Politica de privacidad para Meta.
**URL**: https://wilzuniga.github.io/whatsapp-bot-privacy/

### `README.md`
**Proposito**: Documentacion principal del proyecto.

---

# 8. INSTRUCTIVO GENERAL

## 8.1 Que es este Bot?

Es un sistema automatizado de consultas via WhatsApp que permite a los miembros del Patronato Nueva Tatumbla consultar su estado de cuenta de cuotas y pagos.

## 8.2 Como Funciona?

### Para el Usuario Final

1. **Abrir WhatsApp** y buscar el numero del bot: **+504 9712-4409**
2. **Enviar un mensaje** con:
   - Su numero de telefono (ej: "99907652")
   - O escribir "lote" seguido del numero (ej: "lote 87")
3. **Recibir la informacion** de su cuenta
4. **Hacer preguntas de seguimiento** como "Cuanto debo?"

### Ejemplo de Conversacion

```
Usuario: Hola
Bot: Buenas tardes! Bienvenido al sistema de consultas.
     Para consultar tu informacion, enviame:
     - Tu numero de telefono
     - O escribe "lote" seguido del numero (ej: lote 87)

Usuario: 99907652
Bot: Un momento, revisando la base de datos...

Bot: Informacion encontrada:
     Carlos Alberto Argenal Osorto
     Lote: 68
     Telefono: 50499907652
     Cuota mensual: L 400
     Saldo actual: L 0
     Ultimo pago: Dic-2025

Usuario: Esta al dia?
Bot: Si, Carlos Alberto esta al dia con sus pagos.
     Saldo actual: L 0
```

## 8.3 Comandos Disponibles

| Comando | Ejemplo | Resultado |
|---------|---------|-----------|
| Numero de telefono | `99907652` | Busca por telefono |
| Lote | `lote 87` | Busca por numero de lote |
| Saludo | `hola`, `buenos dias` | Mensaje de bienvenida |
| Ayuda | `ayuda`, `help` | Instrucciones de uso |
| Gracias | `gracias` | Mensaje de despedida |

## 8.4 Preguntas de Seguimiento

Despues de una busqueda exitosa, el usuario puede preguntar:
- "Cuanto debo?"
- "Esta al dia?"
- "Cuando fue el ultimo pago?"
- "Cual es mi cuota?"

## 8.5 Mantenimiento Basico

### Ver si el Bot esta Funcionando
1. Enviar un mensaje de prueba al bot
2. Si no responde en 30 segundos, revisar los logs

### Ver Logs del Sistema
```bash
firebase functions:log --only webhook
```

### Reiniciar el Bot (Redeploy)
```bash
cd C:\Users\wilme\whatsapp-bot
firebase deploy --only functions
```

## 8.6 Actualizacion de Datos

Los datos se actualizan automaticamente desde el Google Sheet:
- **URL**: https://docs.google.com/spreadsheets/d/12sRLkCSImXssL0vBBWUvuTQpow8osg9s7SRKkPiu8kg/
- **Hoja**: "Vista_Bot Valores"

### Para Actualizar un Registro:
1. Abrir el Google Sheet
2. Ir a la hoja "Vista_Bot Valores"
3. Modificar los datos necesarios
4. Los cambios se reflejan automaticamente (sin necesidad de reiniciar el bot)

## 8.7 Solucion de Problemas Comunes

### El bot no responde
1. Verificar conexion a internet
2. Revisar logs: `firebase functions:log --only webhook`
3. Si hay error de token, generar uno nuevo

### El usuario no encuentra su registro
1. Verificar que el telefono/lote esta en el Sheet
2. Probar con diferentes formatos de busqueda
3. Verificar que la columna correcta tiene el dato

### Mensajes duplicados
- El sistema tiene deduplicacion automatica
- Si persiste, puede ser problema de Meta (esperar unos minutos)

## 8.8 Contacto de Soporte Tecnico

Para problemas tecnicos que no se puedan resolver con este instructivo, contactar al desarrollador.

## 8.9 Costos Mensuales Estimados

| Servicio | Costo Estimado |
|----------|----------------|
| Firebase Functions | ~$0 - $5 USD (uso bajo) |
| OpenAI API | ~$1 - $5 USD |
| Google Sheets API | Gratis |
| WhatsApp Cloud API | Gratis (primeras 1000 conv/mes) |
| **Total Mensual** | **~$1 - $10 USD** |

*Los costos pueden variar segun el volumen de mensajes.*

---

# 9. FUNCIONAMIENTO DE CUENTAS Y SERVICIOS

## 9.1 Meta for Developers (WhatsApp)

### Datos de la Cuenta
- **App Name**: Bot Tesoreria
- **App ID**: 4438155313079977
- **WhatsApp Business Account ID**: 1842733373100366
- **Phone Number ID**: 986420331224785
- **Numero de WhatsApp**: +504 9712-4409

### Acceso
- **URL**: https://developers.facebook.com/
- **Email**: (cuenta del administrador)

### Token de Acceso
- **Tipo**: Token permanente (System User)
- **Permisos**: whatsapp_business_messaging, whatsapp_business_management
- **Ubicacion**: `functions/.env` -> `WHATSAPP_TOKEN`

### Renovacion de Token
Si el token expira:
1. Ir a Meta Business Suite -> Settings -> Users -> System Users
2. Seleccionar el System User
3. Generate New Token
4. Seleccionar permisos de WhatsApp
5. Token Expiration: Never
6. Copiar token y actualizar `.env`
7. Redeploy: `firebase deploy --only functions`

### Webhook
- **URL**: https://us-central1-whatsapp-bot-prod-6ccee.cloudfunctions.net/webhook
- **Verify Token**: Patronato_tesoreria_el_gato_sube_a_la_silla
- **Campos suscritos**: messages

---

## 9.2 Firebase

### Datos del Proyecto
- **Project ID**: whatsapp-bot-prod-6ccee
- **Project Name**: whatsapp-bot-prod
- **Region**: us-central1

### Acceso
- **Console**: https://console.firebase.google.com/project/whatsapp-bot-prod-6ccee
- **Email**: wilmerzuniga.ant@gmail.com

### Servicios Utilizados
1. **Cloud Functions**: Ejecuta el webhook
2. **Firestore**: Almacena contexto de conversaciones
3. **Cloud Logging**: Logs del sistema

### Plan de Facturacion
- **Plan**: Blaze (pay as you go)
- **Estimado mensual**: $0 - $5 USD (uso bajo)

### Limites Gratuitos
- 2 millones de invocaciones/mes
- 400,000 GB-segundos/mes
- 200,000 CPU-segundos/mes

---

## 9.3 Google Cloud (Sheets API)

### Service Account
- **Email**: sheets-reader@whatsapp-bot-prod-6ccee.iam.gserviceaccount.com
- **Project**: whatsapp-bot-prod-6ccee

### Credenciales
- **Private Key**: Almacenada en `functions/.env` -> `GOOGLE_PRIVATE_KEY`
- **Formato**: JSON key file convertido a string

### Google Sheet
- **ID**: 12sRLkCSImXssL0vBBWUvuTQpow8osg9s7SRKkPiu8kg
- **URL**: https://docs.google.com/spreadsheets/d/12sRLkCSImXssL0vBBWUvuTQpow8osg9s7SRKkPiu8kg/
- **Hoja**: Vista_Bot Valores
- **Permisos**: El Service Account tiene acceso de lectura

### Renovacion de Credenciales
Si se necesita nueva key:
1. Ir a Google Cloud Console -> IAM -> Service Accounts
2. Seleccionar sheets-reader@...
3. Keys -> Add Key -> Create new key -> JSON
4. Copiar `client_email` y `private_key`
5. Actualizar `.env`
6. Redeploy

---

## 9.4 OpenAI

### Datos de la Cuenta
- **API Key**: sk-proj-xxxxx (en `.env`)
- **Modelo utilizado**: gpt-4o-mini

### Acceso
- **URL**: https://platform.openai.com/
- **Dashboard**: https://platform.openai.com/usage

### Uso y Costos
- **Modelo**: gpt-4o-mini
- **Costo**: ~$0.15 por millon de tokens input, ~$0.60 por millon output
- **Uso estimado**: 100-500 consultas/dia = ~$1-5 USD/mes

### Limites
- Rate limits segun tier de cuenta
- Monitorear en dashboard de OpenAI

### Renovacion de API Key
1. Ir a https://platform.openai.com/api-keys
2. Create new secret key
3. Copiar key
4. Actualizar `.env` -> `OPENAI_API_KEY`
5. Redeploy

---

## 9.5 GitHub (Politica de Privacidad)

### Repositorio
- **URL**: https://github.com/wilzuniga/whatsapp-bot-privacy
- **GitHub Pages**: https://wilzuniga.github.io/whatsapp-bot-privacy/

### Proposito
Hospedar la politica de privacidad requerida por Meta para apps de WhatsApp Business.

---

## 9.6 Resumen de Variables de Entorno

| Variable | Servicio | Descripcion |
|----------|----------|-------------|
| `OPENAI_API_KEY` | OpenAI | API key para GPT |
| `GOOGLE_SHEETS_ID` | Google | ID del spreadsheet |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google | Email del service account |
| `GOOGLE_PRIVATE_KEY` | Google | Private key del service account |
| `WHATSAPP_TOKEN` | Meta | Token de acceso permanente |
| `WHATSAPP_PHONE_ID` | Meta | ID del numero de telefono |
| `WHATSAPP_VERIFY_TOKEN` | Meta | Token de verificacion del webhook |

---

## 9.7 Checklist de Mantenimiento Mensual

- [ ] Verificar que el bot responde correctamente
- [ ] Revisar costos en Firebase Console
- [ ] Revisar uso en OpenAI Dashboard
- [ ] Verificar que el token de WhatsApp no ha expirado
- [ ] Revisar logs por errores recurrentes
- [ ] Verificar que el Google Sheet esta actualizado

---

# 10. GUIA PARA ACTUALIZACION DE DATOS

## 10.1 Acceso al Google Sheet

### URL del Sheet
```
https://docs.google.com/spreadsheets/d/12sRLkCSImXssL0vBBWUvuTQpow8osg9s7SRKkPiu8kg/edit?usp=sharing
```

### Hoja a Utilizar
**Vista_Bot Valores** (tercera pestana del documento)

---

## 10.2 Estructura de la Hoja

| Columna | Nombre | Descripcion | Formato |
|---------|--------|-------------|---------|
| A | WhatsApp | Numero de telefono | `50499999999` (sin espacios ni guiones) |
| B | Lote | Numero(s) de lote | `87` o `87,88` (multiples separados por coma) |
| C | Nombre | Nombre del propietario | Texto |
| D | Apellido | Apellido del propietario | Texto |
| E | Cuota | Cuota mensual | `L 200,00` o `L 400,00` |
| F | SaldoActual | Deuda actual | `L 0,00` o `L 1.200,00` o `-L 100,00` |
| G | MesUltimoPago | Mes del ultimo pago | `Dic-2025` o `Sin pagos registrados desde Enero 2024` |
| H | MontoUltimoPago | Monto del ultimo pago | `L200,00` |

---

## 10.3 Como Actualizar Datos

### Paso 1: Abrir el Sheet
1. Abrir el enlace del Google Sheet
2. Iniciar sesion con cuenta autorizada
3. Seleccionar la hoja "Vista_Bot Valores"

### Paso 2: Buscar el Registro
- Usar `Ctrl+F` para buscar por nombre, telefono o lote
- O navegar manualmente por la lista

### Paso 3: Modificar el Dato
1. Hacer clic en la celda a modificar
2. Escribir el nuevo valor
3. Presionar Enter

### Paso 4: Verificar
- Los cambios se guardan automaticamente
- El bot leera los nuevos datos en la proxima consulta

---

## 10.4 Agregar Nuevo Registro

### Paso 1: Ir al Final de la Lista
Buscar la primera fila vacia despues del ultimo registro.

### Paso 2: Completar los Datos
Llenar cada columna con el formato correcto:

| Campo | Ejemplo |
|-------|---------|
| WhatsApp | `50499123456` |
| Lote | `99` |
| Nombre | `Juan` |
| Apellido | `Perez` |
| Cuota | `L 400,00` |
| SaldoActual | `L 0,00` |
| MesUltimoPago | `Ene-2026` |
| MontoUltimoPago | `L400,00` |

---

## 10.5 Formatos Validos

### Telefono (Columna A)
**Correcto:**
- `50499123456`
- `50432123456`

**Incorrecto:**
- `9912-3456` (le falta codigo de pais)
- `+504 9912-3456` (tiene espacios y guiones)
- `504-9912-3456` (tiene guiones)

### Lote (Columna B)
**Correcto:**
- `87`
- `87,88` (multiples lotes)
- `A1,A2,A3`
- `5A`

**Incorrecto:**
- `Lote 87` (no poner la palabra "Lote")

### Cuota y Montos (Columnas E, F, H)
**Correcto:**
- `L 200,00`
- `L 400,00`
- `-L 100,00` (saldo a favor)
- `L -` (sin cuota)

### Ultimo Pago (Columna G)
**Correcto:**
- `Dic-2025`
- `Ene-2026`
- `Sin pagos registrados desde Enero 2024`

---

## 10.6 Casos Especiales

### Registro sin Telefono
- Dejar la columna A vacia
- El usuario solo podra consultar por lote

### Registro sin Lote
- Poner `---` en la columna B
- El usuario solo podra consultar por telefono

### Saldo a Favor
- Usar numero negativo: `-L 100,00`
- El bot mostrara "Saldo a favor"

### Sin Pagos
- En columna G poner: `Sin pagos registrados desde Enero 2024`
- Se mostrara tal cual al usuario

### Cuota Cero
- Poner `L -` o dejar vacio
- Se mostrara como "L 0"

---

## 10.7 Verificacion de Cambios

Despues de hacer cambios, verificar que el bot lee correctamente:

1. Abrir WhatsApp
2. Enviar mensaje al bot con el telefono o lote modificado
3. Verificar que muestra los datos actualizados

**Nota**: No es necesario reiniciar el bot. Los cambios se leen en tiempo real.

---

## 10.8 Recomendaciones

1. **Hacer backup** antes de cambios masivos
2. **Mantener el formato** consistente
3. **No eliminar** la fila de encabezados
4. **No agregar** columnas adicionales
5. **No cambiar** el nombre de la hoja

---

## 10.9 Errores Comunes

| Error | Causa | Solucion |
|-------|-------|----------|
| Usuario no encuentra su registro | Telefono mal formateado | Verificar formato sin espacios ni guiones |
| Datos incorrectos | Columnas desordenadas | Verificar que cada dato este en su columna |
| Bot no lee cambios | Cache del Sheet | Esperar 5 minutos o hacer un cambio menor |

---

## 10.10 Contacto

Si hay problemas con la actualizacion de datos que no se pueden resolver, contactar al desarrollador.

---

# FIN DE LA DOCUMENTACION

**Documento generado el 11 de Febrero de 2026**  
**Desarrollador: Wilmer Zuniga**
