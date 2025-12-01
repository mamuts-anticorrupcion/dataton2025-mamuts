# 🦣 **Mamuts — Umbral de Riesgo Patrimonial Anticorrupción**
### Datatón Anticorrupción 2025 — Secretaría Ejecutiva del Sistema Nacional Anticorrupción

## 🚀 **Descripción general**
**Umbral de Riesgo Patrimonial Anticorrupción** es una plataforma analítica diseñada para identificar señales tempranas de riesgo, posibles conflictos de interés, patrones atípicos en contrataciones públicas (S6) y discrepancias relevantes en declaraciones patrimoniales (S1).

Desarrollado por el equipo **Mamuts**, este sistema integra datos de:

- Declaraciones patrimoniales y de intereses (S1)
- Contratos públicos (S6)
- Empresas relacionadas declaradas
- Sectores de actividad económica
- Ingresos desagregados por actividad
- Información del encargo público (toma de posesión)

Todo se unifica en un motor de cruce temporal que genera una **línea de tiempo por declarante** y un **panel exploratorio de riesgo institucional**.

## 🎯 **Objetivo**
Brindar una herramienta que permita:

- Detectar contratos antes y después del nombramiento.
- Identificar coincidencia ente público ↔ institución compradora.
- Evaluar incrementos súbitos de ingresos o actividad empresarial relevante.
- Facilitar análisis para auditorías, periodismo de investigación, áreas de cumplimiento y contralorías internas.

Contribuir a un México más transparente, honesto y sin corrupción mediante tecnología accesible y auditable.

# 🧩 **Arquitectura del Proyecto**

## 🟣 Backend — FastAPI
Endpoints principales:

### `/timeline/by-nombre`
Ficha completa del declarante.

### `/timeline/declarantes`
Padrón completo o filtrado.

### `/timeline/suggest`
Autocompletado eficiente.

### `/timeline/declarantes-cruce-toma`
Patrones de riesgo antes/después del nombramiento.

### `/timeline/declarantes-conflicto`
Identificación de conflicto de interés.

## 🟦 Frontend — Next.js 16
Visualización moderna con ECharts, TailwindCSS, App Router y panel de análisis.

# 📊 **Visualizaciones**
- Línea de tiempo individual
- Nube de contratos
- Panel de conflicto de interés
- Cruce patrimonial–contractual

# 🗂️ **Estructura del repositorio**
```
dataton2025-mamuts/
├── back-dataton/
├── front-dataton/
└── README.md
```

# ⚙️ **Instalación**

## Backend
```
cd back-dataton
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Frontend
```
cd front-dataton
npm install
npm run dev
```

# 🧠 **Equipo Mamuts**
Contacto: **mamuts.anticorrupcion@gmail.com**

## 📄 Licencia

Este proyecto se publica bajo la licencia **Creative Commons Attribution–NonCommercial (CC BY-NC)**.

De acuerdo con los lineamientos del Datatón Anticorrupción 2025:

- Se permite el uso, copia, modificación y redistribución del código con fines **no comerciales**.
- Se debe otorgar crédito al equipo **Mamuts** como autor original.
- La Secretaría Ejecutiva del Sistema Nacional Anticorrupción (SESNA) recibe derechos de uso y modificación del prototipo conforme a la convocatoria.
