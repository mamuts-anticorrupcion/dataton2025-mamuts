'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Landmark, Clock3, FileSearch, Network, AlertTriangle } from 'lucide-react';
import TimelinePage from '@/components/timeline/TimelinePage';

const COLORS = {
  primary: '#215aab', // azul
  accent:  '#7a2f7e', // morado
  text:    '#0f172a',
  weak:    '#4b5563',
  border:  '#e2e8f0',
  bg:      '#f3f6fb',

  inicio:  '#059669', // verde contratos antes
  fin:     '#dc2626', // rojo contratos después
  toma:    '#7a467b', // 💜 morado toma de posesión (elige el mismo que en TimelinePage)
};

export default function Landing() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: COLORS.bg, color: COLORS.text }}
    >
      {/* ===================== HERO — radial desde el centro ===================== */}
      <section className="relative overflow-hidden py-20 md:py-28 px-4">
        {/* Fondo hero: radial centrado muy suave */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at center,
                rgba(33, 90, 171, 0.18) 0%,
                rgba(122, 47, 126, 0.10) 32%,
                rgba(243, 246, 251, 0.96) 70%,
                ${COLORS.bg} 100%)`,
            }}
          />
          {/* Ruido muy discreto */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `
                url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 20 20'%3E%3Cg fill='%23cbd5e1' fill-opacity='0.28'%3E%3Crect width='1' height='1'/%3E%3C/g%3E%3C/svg%3E")
              `,
              backgroundSize: '24px 24px',
              mixBlendMode: 'soft-light',
            }}
          />
        </div>

        {/* Contenido hero */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          <span
  className="
    inline-flex items-center gap-2 text-xs md:text-sm px-3.5 py-1.5
    rounded-full mb-5 border backdrop-blur-md
  "
  style={{
    background: `linear-gradient(135deg,
      ${COLORS.primary}15,
      ${COLORS.accent}10
    )`,
    color: COLORS.primary,
    borderColor: COLORS.primary + '33',
  }}
>
  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
    <Landmark className="h-5 w-5" />
  </span>
  Secretaría Ejecutiva del Sistema Nacional Anticorrupción
</span>

        <h1
          className="
            text-4xl md:text-6xl lg:text-7xl
            font-semibold
            tracking-tight
            max-w-5xl mx-auto
          "
          style={{ lineHeight: 1.12, paddingBottom: '0.4em' }}
        >

          {/* 1) Nombre del equipo — clip + gradiente (como tenías Mamuts) */}
          <span
            className="block bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
              backgroundSize: '300% auto',
              animation: `
                gradientSweep 2.8s ease-in-out 0.2s forwards,
                clipReveal 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards
              `,
              opacity: 0,
            }}
          >
            Mamuts 🦣
          </span>

          {/* 2) Nombre del proyecto — slideUpClean (como tenías el proyecto) */}
          <span
            className="block"
            style={{
              color: '#36455aff',
              animation: 'slideUpClean 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards',
              animationDelay: '1.4s', // empieza después de la animación del equipo
              opacity: 0,
            }}
          >
            Umbral de Riesgo Patrimonial Anticorrupción
          </span>
        </h1>

          <p
            className="mt-6 text-base md:text-l leading-relaxed max-w-3xl mx-auto"
            style={{
              color: COLORS.weak,
            }}
          >
            Herramienta tecnológica que identifica patrones de riesgo al cruzar, en una sola línea de tiempo, la información de las declaraciones patrimoniales (S1), los ingresos declarados, las participaciones empresariales y los contratos públicos (S6).
            Visualiza con precisión cuándo un servidor público toma posesión, qué empresas declara, cuánto ingresa y cómo se distribuyen los contratos asociados antes y después del nombramiento.
            La plataforma facilita detectar posibles conflictos de interés, concentraciones atípicas de contratos y señales tempranas de riesgo, apoyando ejercicios de auditoría, análisis institucional y periodismo de datos.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#timeline"
              className="
                inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium
                shadow-md hover:shadow-lg transition-all duration-200
                hover:-translate-y-0.5
              "
              style={{
                background: `linear-gradient(100deg, ${COLORS.primary}, ${COLORS.accent})`,
                color: '#ffffff',
              }}
            >
              Explorar herramienta de análisis
            </a>

           <a
              href="https://github.com/mamuts-anticorrupcion/mamuts-dataton2025"
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium
                border bg-white/95 backdrop-blur-sm
                hover:bg-white hover:-translate-y-0.5 hover:shadow-sm
                transition-all duration-200
              "
              style={{ borderColor: '#cbd5e1', color: COLORS.weak }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 .5C5.65.5.5 5.64.5 12c0 5.1 3.29 9.43 7.86 10.96.58.11.79-.25.79-.56v-2.01c-3.2.7-3.87-1.38-3.87-1.38-.53-1.34-1.29-1.7-1.29-1.7-1.06-.73.08-.71.08-.71 1.17.08 1.78 1.21 1.78 1.21 1.04 1.77 2.73 1.26 3.4.96.11-.76.41-1.26.74-1.55-2.55-.29-5.24-1.27-5.24-5.65 0-1.25.45-2.27 1.18-3.07-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.19 1.17a11.07 11.07 0 0 1 5.8 0c2.22-1.48 3.19-1.17 3.19-1.17.63 1.59.23 2.76.11 3.05.73.8 1.18 1.82 1.18 3.07 0 4.4-2.7 5.36-5.27 5.65.42.36.8 1.08.8 2.19v3.25c0 .31.21.68.8.56A10.99 10.99 0 0 0 23.5 12C23.5 5.64 18.35.5 12 .5Z" />
              </svg>
              Ver repositorio en GitHub
            </a>

          </div>

          <div
            className="mt-10 flex flex-col items-center gap-2 text-[11px]"
            style={{ color: COLORS.weak }}
          >
            <span>Desliza para ver cómo funciona</span>
            <div className="h-8 w-4 rounded-full border border-slate-300/80 flex items-start justify-center p-0.5 bg-white/60 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
            </div>
          </div>
        </div>
      </section>

            {/* =========== ESPECIFICACIONES TÉCNICAS — gradientes en los lados =========== */}
      <section
        className="relative overflow-hidden py-20 border-t"
        style={{ borderColor: COLORS.border }}
      >
        {/* Fondo: laterales muy sutiles */}
        <div className="pointer-events-none absolute inset-0 z-0">
          {/* Base clara casi plana */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg,
                rgba(249, 250, 251, 1) 0%,
                rgba(243, 246, 251, 1) 100%)`,
            }}
          />
          {/* Izquierda */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 0% 50%,
                rgba(33, 90, 171, 0.12) 0%,
                transparent 55%)`,
            }}
          />
          {/* Derecha */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 100% 50%,
                rgba(122, 47, 126, 0.12) 0%,
                transparent 55%)`,
            }}
          />
          {/* Grid ultra sutil */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: `
                linear-gradient(135deg, rgba(148,163,184,0.25) 1px, transparent 1px),
                linear-gradient(315deg, rgba(148,163,184,0.14) 1px, transparent 1px)
              `,
              backgroundSize: '30px 30px',
              mixBlendMode: 'soft-light',
            }}
          />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start">
            {/* Lado izquierdo: narrativa técnica + leyenda + bullets */}
            <div className="space-y-6">
              <div className="space-y-3">
                <Badge
                  variant="outline"
                  className="
                    inline-flex items-center
                    rounded-full border px-3 py-1
                    uppercase tracking-wide text-[17px] md:text-[15px]
                    bg-white/80 backdrop-blur-sm
                  "
                  style={{
                    borderColor: COLORS.primary + '33',
                    color: COLORS.primary,
                    backgroundImage: `linear-gradient(
                      90deg,
                      rgba(33, 90, 171, 0.08),
                      rgba(122, 47, 126, 0.10)
                    )`,
                  }}
                >
                  Especificaciones técnicas
                </Badge>

                <h2
                  className="text-2xl md:text-3xl font-semibold tracking-tight"
                  style={{ color: COLORS.text }}
                >
                  Motor de cruce patrimonial–contractual orientado a riesgo.
                </h2>

                <p
                  className="text-sm md:text-base leading-relaxed"
                  style={{ color: COLORS.weak }}
                >
                  El backend expone una API sobre FastAPI que lee un{' '}
                  <span className="font-mono text-[12px] bg-slate-100 px-1 rounded">
                    dataset.json
                  </span>{' '}
                  normalizado y construye, para cada declarante, una línea de tiempo que cruza:
                  fecha de toma de posesión, contratos públicos asociados (S6), empresa declarada,
                  posibles conflictos ente/comprador e información de ingresos declarados (S1).
                </p>
              </div>

              {/* Mini leyenda timeline (codificación visual) */}
              <div
                className="mt-4 rounded-xl border bg-white/95 backdrop-blur-sm px-4 py-3 shadow-sm"
                style={{ borderColor: COLORS.border }}
              >
                <div className="flex flex-col gap-2 text-[11px] font-medium text-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: COLORS.toma }}
                      />
                      <span>Toma de posesión (S1)</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Generada desde <span className="font-mono">fechaTomaPosesion</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: COLORS.inicio }}
                      />
                      <span>Inicio de contrato (S6)</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Campo base: <span className="font-mono">fechaInicioContrato</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: COLORS.fin }}
                      />
                      <span>Fin de contrato (S6)</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Campo base: <span className="font-mono">fechaFinContrato</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de funcionalidades técnicas (vinculadas a endpoints) */}
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 h-5 w-5 rounded-full flex items-center justify-center text-xs"
                    style={{ backgroundColor: '#dbeafe', color: COLORS.primary }}
                  >
                    API
                  </span>
                  <p className="leading-relaxed" style={{ color: COLORS.weak }}>
                    <span className="font-mono text-[11px]">GET /timeline/by-nombre</span>{' '}
                    construye la ficha completa de un declarante: encargo público, ente, empresa
                    relacionada, sector, posibles conflictos ente/comprador y todos los contratos
                    vinculados ordenados temporalmente.
                  </p>
                </div>

                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 h-5 w-5 rounded-full flex items-center justify-center text-xs"
                    style={{ backgroundColor: '#dbeafe', color: COLORS.primary }}
                  >
                    🔎
                  </span>
                  <p className="leading-relaxed" style={{ color: COLORS.weak }}>
                    <span className="font-mono text-[11px]">
                      GET /timeline/declarantes&nbsp;/&nbsp;suggest
                    </span>{' '}
                    proveen padrón y autocompletado de nombres, filtrando sólo quienes tienen fecha
                    de toma de posesión válida para garantizar visualizaciones útiles.
                  </p>
                </div>

                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 h-5 w-5 rounded-full flex items-center justify-center text-xs"
                    style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
                  >
                    ⏱
                  </span>
                  <p className="leading-relaxed" style={{ color: COLORS.weak }}>
                    <span className="font-mono text-[11px]">
                      GET /timeline/declarantes-cruce-toma
                    </span>{' '}
                    identifica declarantes con contratos antes y después de la toma de posesión y
                    entrega métricas agregadas: número de contratos, montos y resumen de ingresos
                    declarados.
                  </p>
                </div>

                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 h-5 w-5 rounded-full flex items-center justify-center text-xs"
                    style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
                  >
                    ⚠️
                  </span>
                  <p className="leading-relaxed" style={{ color: COLORS.weak }}>
                    <span className="font-mono text-[11px]">
                      GET /timeline/declarantes-conflicto
                    </span>{' '}
                    agrupa casos en los que el ente del declarante coincide con la institución
                    compradora, devolviendo número de contratos, monto total en posible conflicto e
                    ingresos del declarante para análisis de riesgo patrimonial.
                  </p>
                </div>
              </div>
            </div>

            {/* Lado derecho: feature cards técnicas */}
            <div className="grid gap-4">
              {/* Card 1: Cruce S1–S6 por declarante */}
              <Card
                className="
                  relative overflow-hidden border bg-white/95
                  shadow-sm group transition-all duration-200
                  hover:shadow-md hover:-translate-y-1 hover:border-slate-300
                  min-h-[132px] flex flex-col
                "
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.55]"
                  style={{
                    background:
                      'radial-gradient(circle at 0 0, rgba(34,197,94,0.18), transparent 70%)',
                  }}
                />
                <CardHeader className="relative pb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: '#dcfce7', color: COLORS.inicio }}
                    >
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <CardTitle
                      className="text-sm font-semibold"
                      style={{ color: COLORS.primary }}
                    >
                      Cruce patrimonial–contractual por persona
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-600">
                    Para cada nombre, el backend consolida: encargo público, empresa declarada,
                    sector de actividad, contratos vinculados y coincidencia ente/comprador, listo
                    para ser representado en un eje temporal único con ECharts.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Card 2: Normalización de fechas, montos e ingresos */}
              <Card
                className="
                  relative overflow-hidden border bg-white/95
                  shadow-sm group transition-all duration-200
                  hover:shadow-md hover:-translate-y-1 hover:border-slate-300
                  min-h-[132px] flex flex-col
                "
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.55]"
                  style={{
                    background:
                      'radial-gradient(circle at 100% 0, rgba(59,130,246,0.20), transparent 70%)',
                  }}
                />
                <CardHeader className="relative pb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: '#dbeafe', color: COLORS.primary }}
                    >
                      <FileSearch className="h-4 w-4" />
                    </div>
                    <CardTitle
                      className="text-sm font-semibold"
                      style={{ color: COLORS.primary }}
                    >
                      Normalización de datos e ingresos
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-600">
                    Funciones internas convierten fechas heterogéneas a{' '}
                    <span className="font-mono">ISO-8601</span>, limpian montos y generan un
                    diccionario homogéneo de ingresos (cargo público, actividad empresarial, otros
                    ingresos), que el front usa para calcular composición de ingresos anuales.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Card 3: Exploración interactiva y patrones de riesgo */}
              <Card
                className="
                  relative overflow-hidden border bg-white/95
                  shadow-sm group transition-all duration-200
                  hover:shadow-md hover:-translate-y-1 hover:border-slate-300
                  min-h-[132px] flex flex-col
                "
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.55]"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 0, rgba(113,57,114,0.22), transparent 70%)',
                  }}
                />
                <CardHeader className="relative pb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: '#f3e8ff', color: COLORS.accent }}
                    >
                      <Network className="h-4 w-4" />
                    </div>
                    <CardTitle
                      className="text-sm font-semibold"
                      style={{ color: COLORS.primary }}
                    >
                      Visualización de riesgo y explorador de casos
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-600">
                    El front en Next.js consume la API para mostrar la nube de contratos, líneas de
                    toma de posesión, explorador de declarantes (padrón, cruce antes/después y
                    posibles conflictos) y una ficha pegajosa que resume vínculos privados e
                    ingresos del declarante en el periodo analizado.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Card 4: Trazabilidad y monitoreo del módulo timeline */}
              <Card
                className="
                  relative overflow-hidden border bg-white/95
                  shadow-sm group transition-all duration-200
                  hover:shadow-md hover:-translate-y-1 hover:border-slate-300
                  min-h-[132px] flex flex-col
                "
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.55]"
                  style={{
                    background:
                      'radial-gradient(circle at 100% 100%, rgba(148,163,184,0.26), transparent 70%)',
                  }}
                />
                <CardHeader className="relative pb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <CardTitle
                      className="text-sm font-semibold"
                      style={{ color: COLORS.primary }}
                    >
                      Trazabilidad y monitoreo del timeline
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-600">
                    El router utiliza una <span className="font-mono">LoggingRoute</span> dedicada
                    para registrar queries, tiempos de respuesta y errores por endpoint{' '}
                    <span className="font-mono">/timeline</span>, facilitando la auditoría técnica,
                    el seguimiento de casos analizados y la identificación de cuellos de botella en
                    el cruce S1–S6.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>



      {/* ===================== TIMELINE DEMO — sobrio tipo data-viz ===================== */}
      <section
        id="timeline"
        className="relative overflow-hidden px-6 py-20 border-t"
        style={{ borderColor: COLORS.border }}
      >
        {/* Fondo: muy plano con un solo halo abajo */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg,
                rgba(243, 246, 251, 1) 0%,
                rgba(238, 242, 255, 1) 45%,
                rgba(229, 231, 235, 1) 100%)`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 120%,
                rgba(122, 47, 126, 0.14) 0%,
                transparent 65%)`,
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(148,163,184,0.28) 1px, transparent 1px)",
              backgroundSize: '32px 32px',
              mixBlendMode: 'soft-light',
            }}
          />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto">
          <Card className="rounded-2xl border shadow-xl bg-white/96 backdrop-blur flex flex-col">
            <CardContent className="p-6 min-h-[65vh]">
              <TimelinePage embedded />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer
        className="relative overflow-hidden py-8 border-t mt-10"
        style={{ borderColor: COLORS.border }}
      >
        {/* Fondo sutil con gradiente profesional */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-90"
          style={{
            background: `linear-gradient(135deg,
              ${COLORS.primary}12 0%,
              ${COLORS.accent}12 35%,
              ${COLORS.toma}12 70%,
              ${COLORS.fin}10 100%)`,
          }}
        />

        {/* Contenido */}
        <div className="relative z-10 mx-auto w-full max-w-screen-xl px-6 flex flex-col items-center text-center">
          {/* Línea delgada decorativa */}
          <div className="w-16 h-[2px] rounded-full mb-3"
            style={{ background: COLORS.primary }}
          />

          {/* Texto principal */}
          <p
            className="text-[13px] font-semibold tracking-wide"
            style={{ color: COLORS.text }}
          >
            Datatón Anticorrupción 2025
          </p>

          {/* Subtítulo profesional */}
          <p
            className="mt-1 text-[11px] text-slate-500"
            style={{ maxWidth: '480px' }}
          >
            Plataforma de análisis y visualización para identificar patrones de
            riesgo en declaraciones patrimoniales y contrataciones públicas.
          </p>

          {/* Línea final muy suave */}
          <div
            className="mt-4 w-24 h-[1px] rounded-full opacity-60"
            style={{ background: COLORS.border }}
          />
        </div>
      </footer>

    </div>
  );
}
