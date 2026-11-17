# 🛰️ ROMP-GPS — Guía Maestra de Sustentación Técnica & Ejecutiva
> **Material de preparación oficial para el equipo de desarrollo de RompGPS.**  
> *Diseñado para que cualquier público lo entienda de forma sencilla y se demuestre dominio técnico absoluto.*

---

## 1. ⏱️ El "Elevator Pitch" (Discurso de Apertura - 60 Segundos)
> *"Buenos días / tardes a todos. Hoy en día, la seguridad vehicular y la gestión logística en tiempo real no pueden depender de interfaces lentas o sistemas que pierden datos cuando la red móvil falla. Por eso desarrollamos **RompGPS**: un ecosistema integral de telemetría y rastreo vehicular de grado industrial.*  
>  
> *RompGPS no es una simple aplicación web con un mapa: es una arquitectura distribuida de alto rendimiento capaz de recibir transmisiones binarias directas de dispositivos GPS físicos vía TCP, decodificarlas en milisegundos con servidores no bloqueantes, persistirlas de manera balanceada en tres bases de datos distintas según su naturaleza, y transmitirlas instantáneamente a un panel de control interactivo mediante WebSockets."*

---

## 2. ✈️ Arquitectura del Sistema: La Analogía del Aeropuerto
*(Úsenla para que cualquier persona del público o jurado lo visualice sin tecnicismos complejos).*

```
[Dispositivo GPS GT06] ──(Señal TCP: Puerto 9000)──► [Servidor Ingesta Netty]
                                                           │
                                             (HTTP interno + X-API-Key)
                                                           ▼
[FrontEnd React + Three.js] ◄──(WebSocket STOMP)─── [BackEnd Spring Boot 3.4.3]
  • Mapa satelital en vivo                                 │
  • Modelo 3D de hardware                         ┌────────┼────────┐
  • Panel Administrador y Cliente                 ▼        ▼        ▼
                                              [Redis]  [MongoDB] [PostgreSQL]
                                              Memoria  Histórico Relacional
```

* **El Dispositivo GPS (El Avión):** Emite pulsos binarios compactos para ahorrar batería y datos móviles en la red celular.
* **Servidor TCP Netty (La Torre de Control):** Recibe miles de señales por segundo sin colapsar, valida que no vengan corruptas y traduce el lenguaje de la máquina a coordenadas limpias.
* **El BackEnd Spring Boot (El Centro de Operaciones):** Valida la seguridad, gestiona cobros con Wompi, procesa lógica de negocio y distribuye datos.
* **Las 3 Bases de Datos (Los Archivos Especializados):** Cada dato va a donde mejor rinde (Redis para lo instantáneo, MongoDB para el histórico gigante, PostgreSQL para cuentas y dinero).
* **El FrontEnd React (La Pantalla de Vuelos en Vivo):** El usuario ve su vehículo desplazarse fluidamente en el mapa en tiempo real sin recargar la página.

---

## 3. 🧩 Tabla de Módulos, Puertos y Responsabilidades

| Módulo | Tecnología | Puerto | Responsabilidad Técnica |
|---|---|---|---|
| **Servidor TCP** | Spring Boot + Netty | **TCP: 9000** / HTTP: 8080 | Escucha sockets de hardware, reensambla tramas GT06 fragmentadas, valida CRC-16 y envía posiciones al backend. |
| **BackEnd Central** | Spring Boot 3.4.3 (Java 17) | **HTTP: 8081** | Seguridad JWT, control de roles (RBAC), 2FA, pasarela Wompi, persistencia políglota y servidor WebSocket. |
| **FrontEnd Web** | React 18 + Vite 5 + Three.js | **HTTP: 5173** | Dashboard cliente, mapa interactivo con clustering, visor 3D paramétrico del hardware y panel administrativo. |
| **PostgreSQL** | SQL Relacional (Docker) | **5435** | Entidades transaccionales ACID: Usuarios, roles, vehículos, planes, pagos y auditoría. |
| **MongoDB** | NoSQL Documental | **27017** | Series temporales y telemetría histórica: millones de coordenadas sin degradar el rendimiento relacional. |
| **Redis** | In-Memory Cache & Pub/Sub | **6379** | Caché de última ubicación (<2ms), limitador de tasa de intentos (anti-fuerza bruta) y revocación inmediata de tokens. |

---

## 4. 🧠 Las 4 Decisiones de Ingeniería que Demuestran Dominio Técnico

### 1. Servidor de Ingesta TCP no bloqueante con Netty
* **Por qué es clave:** Los GPS vehiculares no usan JSON/HTTP porque consumirían demasiada batería y ancho de banda celular. Transmiten tramas binarias compactas que inician en `0x78 0x78` y terminan en `0x0D 0x0A`.
* **Fragmentación resuelta:** Implementamos `ByteToMessageDecoder`. Si una trama llega dividida en varios paquetes TCP por mala cobertura celular, el servidor acumula los bytes en memoria y no los pierde.
* **Validación CRC-16 (ITU):** Se calcula matemáticamente el checksum de cada paquete. Si un byte se corrompe por ruido en la red, se descarta antes de inyectar coordenadas falsas.

### 2. Persistencia Políglota (¿Por qué 3 bases de datos?)
* **Argumento Senior:** En sistemas telemáticos, guardar el historial de posiciones en PostgreSQL causa degradación por saturación de índices y bloqueos de tabla.
  * **PostgreSQL:** Integridad referencial estricta para cuentas, pagos y vehículos.
  * **MongoDB:** Colecciones de alto volumen de escritura para telemetría continua sin impacto en el negocio.
  * **Redis:** Respuestas instantáneas para saber "dónde está el vehículo ahora mismo" y control de sesiones activas.

### 3. Streaming WebSocket con STOMP y Seguridad Granular
* En lugar de realizar peticiones periódicas (polling) cada pocos segundos que saturan el servidor:
  * Se establece un túnel bidireccional en `/ws-gps`.
  * **Interceptor de Autorización (`InterceptorAutenticacionStomp`):** Cuando un cliente se suscribe al tópico de un IMEI, el backend verifica que el usuario autenticado sea el dueño real del vehículo, evitando que un cliente espíe la ubicación de otros.

### 4. Seguridad en Capas (Zero Trust & Anti-Brute Force)
* **Ingesta Blindada:** La comunicación entre el Servidor TCP y el BackEnd requiere una cabecera `X-API-Key`.
* **Autenticación Robusta:** Access Tokens JWT de corta duración (15 minutos) con Refresh Token automático.
* **Protección contra Ataques:** Filtro de límite de intentos por IP y por cuenta implementado en Redis, además de soporte para Doble Factor de Autenticación (2FA) por SMS y Correo.

---

## 5. ⏳ Guion de Sustentación Minuto a Minuto (10 - 12 Minutos)

| Tiempo | Fase | Qué decir y qué mostrar en pantalla |
|---|---|---|
| **0:00 - 1:30** | **Introducción & Problema** | Presentar al equipo. Exponer los dolores de la industria logística: pérdidas de señal, sistemas lentos y falta de visibilidad en tiempo real. |
| **1:30 - 3:30** | **Arquitectura Global** | Proyectar el diagrama de flujo. Explicar la *Analogía del Aeropuerto* para que todo el jurado entienda la separación de capas. |
| **3:30 - 5:30** | **Ingeniería Profunda** | Explicar el decodificador binario GT06 en Netty, la persistencia políglota y la seguridad del canal WebSocket. |
| **5:30 - 8:30** | **Demostración en Vivo** | 1. Mostrar la Landing con el **Visor 3D** del rastreador GNXIS.<br>2. Ingresar al panel de usuario y ver el mapa en vivo.<br>3. Enviar una trama de prueba al puerto 9000 y ver cómo el vehículo se mueve en el mapa sin recargar la página.<br>4. Mostrar el panel de administración (gestión de clientes, flota y ventas). |
| **8:30 - 10:00** | **Seguridad & Negocio** | Mencionar el soporte de pagos con Wompi, el 2FA, la revocación de sesiones en Redis y el normalizador automático de esquemas de BD. |
| **10:00 - 11:30** | **Cierre & Conclusiones** | Destacar que el sistema está listo para producción y escalar a flotas masivas. Abrir la ronda de preguntas. |

---

## 6. 🎯 Banco de Preguntas del Jurado (Y cómo responder como un Senior)

#### P1: ¿Qué ocurre si un vehículo entra a un túnel o pierde cobertura celular?
> **Respuesta:** El dispositivo GPS físico cuenta con memoria interna tipo buffer donde almacena las coordenadas. Al recuperar la señal, transmite los paquetes en ráfaga. Nuestro servidor Netty maneja eventos asíncronos y no bloqueantes, por lo que asimila las ráfagas sin saturarse. Además, como cada trama GT06 trae su propia marca de tiempo UTC original, MongoDB guarda las posiciones con la hora real del evento y no con la hora de llegada, preservando la fidelidad cronológica del recorrido.

#### P2: ¿Por qué configuraron PostgreSQL en el puerto 5435 y no en el clásico 5432?
> **Respuesta:** Es una decisión deliberada de compatibilidad en entornos de desarrollo y despliegue: en estaciones de trabajo y servidores donde ya corre un servicio nativo de PostgreSQL en el puerto 5432, mapear el contenedor Docker a 5435 garantiza que no existan conflictos de puertos y que el aplicativo siempre se conecte a la base aislada del proyecto.

#### P3: Si un atacante intercepta la conexión WebSocket, ¿puede ver la ubicación de otros usuarios?
> **Respuesta:** No, es imposible. Diseñamos un interceptor a nivel de protocolo STOMP (`InterceptorAutenticacionStomp`). Al momento de intentar suscribirse a `/topic/vehiculo/{imei}`, el servidor extrae la identidad del token JWT y consulta en la base de datos si ese usuario específico es el propietario registrado de ese vehículo. Si no lo es, la suscripción es abortada inmediatamente en el servidor.

#### P4: ¿Cómo manejan los cambios en la base de datos sin riesgo de borrar información previa?
> **Respuesta:** Implementamos un componente llamado `NormalizadorEsquema` que se ejecuta de forma automática e idempotente en el arranque del backend. Cuenta con un `lock_timeout` de 5 segundos, actualiza roles legados sin elevar privilegios, y agrega restricciones UNIQUE e índices sin destruir los datos existentes.

#### P5: ¿Por qué modelaron el GPS en 3D con Blender por código (Python)?
> **Respuesta:** Creamos un pipeline de ingeniería automatizado mediante scripts de Python en Blender headless. Esto nos permite generar y validar la geometría paramétrica del equipo real GNXIS bajo un presupuesto estricto de menos de 45.000 polígonos, optimizándolo en formato GLB comprimido para que cargue en milisegundos en el navegador sin impactar el rendimiento de la landing page.

---

## 7. 📋 Checklist de Preparación para el Día de la Sustentación

1. **15 minutos antes:** Levantar los contenedores de Docker (`docker compose up -d`) y verificar que Postgres (5435), Mongo (27017) y Redis (6379) estén arriba.
2. **Terminales listas:** Tener corriendo el Servidor TCP en una terminal, el BackEnd en otra y el FrontEnd en otra.
3. **Pestañas del navegador listas:**
   * Landing pública con el modelo 3D (`http://localhost:5173`).
   * Panel de usuario con el mapa centrado.
   * Panel administrativo (`http://localhost:5173/admin`).
   * Swagger UI (`http://localhost:8081/swagger-ui.html`) por si el jurado solicita auditar la API.
4. **Mentalidad:** Usar verbos de acción y propiedad (*"Diseñamos", "Optimizamos", "Elegimos"*). Transmitir serenidad y solvencia técnica.
