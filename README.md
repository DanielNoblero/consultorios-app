# 🧠 Analyse — Sistema Profesional de Reservas de Consultorios Psicológicos

Analyse es una plataforma web desarrollada en **React + Firebase** que permite a psicólogos y profesionales de la salud reservar consultorios de forma rápida, segura y organizada.  
Incluye gestión automática de horarios, control de pagos, historial, panel administrativo y reportes mensuales.

---

## 🚀 Funcionalidades Principales

### 👤 **Usuarios / Profesionales**
- Registro con **Email/Password** o **Google**  
- Completar y editar perfil profesional  
- Reservar consultorios por día y hora  
- Sistema de **cancelación con más de 24 horas de anticipación**  
- Visualización de:
  - Próximas reservas  
  - Deuda semanal  
  - Deuda mensual  
  - Historial completo de reservas  
- Interfaz moderna, clara y adaptada para **celular** y escritorio

---

## 🛠️ **Panel Administrativo**
Solo disponible para usuarios con rol **admin**.

Incluye:
- Gestión completa de reservas
- Ajuste del precio base de las sesiones
- Visualización de reservas por profesional
- Generación de **reporte mensual en Excel**:
  - Agrupado por profesional  
  - Total por profesional  
  - Total general  
  - Incluye limpieza automática de reservas pagas del mes anterior  

---

## 📅 **Sistema de Reservas Avanzado**

### ✔ Horarios dinámicos con reglas inteligentes:
- Calcula disponibilidad real  
- Evita superposición de horarios  
- Bloquea horarios pasados  
- Bloquea horarios que terminarían después de las **22:00**  
- Distinción por colores:
  - 🟢 Disponible  
  - 🔴 Ocupado  
  - ⏳ Pasado  

### 🗓 Calendario personalizado:
- Navegación por meses  
- Días ocupados resaltados  
- Día seleccionado marcado visualmente  
- Totalmente adaptado al estilo del sistema

---

## 💸 Sistema de Precios y Pagos

- Precio global configurable desde el panel admin  
- Cada reserva tiene un precio asignado  
- Cálculo automático de:
  - Total semanal
  - Total mensual
- Estado de pago por reserva:
  - “Pendiente”
  - “Pagado”

---

## 🧩 Tecnologías Utilizadas

| Tecnología | Uso |
|-----------|-----|
| **React + Vite** | Interfaz moderna y rendimiento optimizado |
| **TailwindCSS** | Estilos rápidos, limpios y responsivos |
| **Firebase Auth** | Registro y login seguro |
| **Firestore** | Base de datos en tiempo real |
| **Firebase Storage** | Guardado seguro de imágenes |
| **Firebase Functions** | Lógica backend (reportes, limpieza, admin) |
| **ExcelJS** | Generación del reporte mensual |
| **React DatePicker** | Selección visual de fechas |

---
