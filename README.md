# Auralix API - Backend AUR

API robusta y modular diseñada para el ecosistema Auralix, ofreciendo servicios de elecciones en tiempo real, descarga de medios (MediaKeep) y streaming de música.

## 🚀 Arquitectura Modular

El proyecto sigue una estructura profesional que separa la infraestructura de la lógica de negocio:

```
src/
├── Core/               # Infraestructura y Servicios Base
│   ├── Database/       # Conexiones (MongoDB, SQLite, Firebase)
│   ├── Middleware/     # Middlewares de Seguridad y Validación
│   ├── Scraper/        # Motores de extracción (YouTube, Spotify, etc.)
│   ├── System/         # Cargadores, Cache, Config, Flags
│   ├── Logger/         # Sistema de logs (Pino)
│   ├── Security/       # Utilidades criptográficas
│   └── Storage/        # Gestión de archivos (Local/GCS)
├── Modules/            # Lógica de Negocio por Dominio
│   └── Elecciones/     # Sistema de Votación y JNE
├── Routes/             # Endpoints REST (Carga dinámica)
├── Socket/             # Handlers de WebSockets (Carga dinámica)
└── server.ts           # Punto de entrada
```

## 🛠️ Inicio Rápido

### Requisitos Previos

- **Node.js**: >= 20.x
- **Bases de Datos**: MongoDB (Sesiones/Logs) y SQLite (Datos locales/Flags)
- **Firebase**: Proyecto configurado para App Check y Auth

### Instalación

```bash
# Instalar dependencias
npm install

# Generar archivos de base (Proto y GraphQL)
npm run gen:proto
npm run gen:graphql

# Configurar entorno
cp .env.example .env
# Edita .env con tus credenciales
```

### Ejecución

```bash
# Desarrollo (con recarga automática)
npm run dev

# Producción
npm run build
npm start
```

## 🔌 Servicios Principales

### 🗳️ Elecciones
Sistema de votación en tiempo real con validación antibot, integración con JNE para verificación de identidad y actualizaciones via WebSockets.

### 📥 MediaKeep
Descarga de contenido multimedia desde múltiples plataformas (YouTube, TikTok, Instagram, etc.) mediante el motor de scrapers centralizado.

### 🎵 Music
Búsqueda y streaming de pistas de audio optimizado con integración de Spotify.

## 🛡️ Seguridad y Rendimiento

- **Firebase App Check**: Validación de integridad de la aplicación.
- **Rate Limiting**: Protección contra abusos por IP y por usuario.
- **Feature Flags**: Activación/Desactivación de rutas y sockets en caliente via SQLite.
- **Caché Inteligente**: Sistema de caché en memoria para resultados frecuentes.
- **Logging Profesional**: Auditoría de actividad sospechosa y errores.

## 🚢 Despliegue

El proyecto está listo para **Google Cloud Run** mediante el archivo `cloudbuild.yaml` incluido, que automatiza:
1. Construcción de la imagen Docker.
2. Despliegue de reglas de Firestore.
3. Configuración de buckets de Google Cloud Storage.
4. Despliegue del servicio con gestión de secretos.

---
© 2026 Auralix Project. Todos los derechos reservados.
