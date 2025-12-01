'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Calendar, Search, Users, AlertTriangle } from 'lucide-react';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

/** ─────────────────────────── Config ─────────────────────────── **/
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://127.0.0.1:8000';
const ENDPOINT = `${API_BASE}/timeline/by-nombre`;
const SUGGEST = `${API_BASE}/timeline/suggest`;
const LIST_NOMBRES = `${API_BASE}/timeline/declarantes`; // padrón completo
const LIST_CRUCE = `${API_BASE}/timeline/declarantes-cruce-toma`; // nuevo endpoint de muestreo
const LIST_CONFLICTO = `${API_BASE}/timeline/declarantes-conflicto`; // 🔴 nuevo endpoint

const COLORS = {
  primary: '#2a78c3',
  accent: '#713972',
  bg: '#f7f9fc',
  surface: '#ffffff',
  border: '#e5e7eb',
  text: '#0f172a',
  textWeak: '#4b5563',
  grid: '#e5e7eb',
  tick: '#374151',
  toma: '#7a467b',
  inicio: '#10b981',
  fin: '#ef4444',
  monthBand: '#e5e7eb',
};

type Ingresos = {
  remuneracionMensualCargoPublico?: number | null;
  remuneracionAnualCargoPublico?: number | null;
  ingresoMensualNetoDeclarante?: number | null;
  ingresoAnualNetoDeclarante?: number | null;
  totalIngresosMensualesNetos?: number | null;
  totalIngresosAnualesNetos?: number | null;
  actividadEmpresarial?: number | null;
  actividadFinanciera?: number | null;
  serviciosProfesionales?: number | null;
  otrosIngresos?: number | null;
  enajenacionBienes?: number | null;
};

type Contrato = {
  nombreDeclarante: string;
  fechaTomaPosesion?: string;
  fechaInicioContrato?: string;
  fechaFinContrato?: string;
  montoContrato?: number;
  descripcionContrato?: string;
  institucionCompradora?: string;
  institucionDeclarante?: string;
  nombreEntePublico?: string;
  nivelOrdenGobierno?: string;
  puesto?: string;
  funcionPrincipal?: string;
  empresaRelacionada?: string;
  tipoParticipacion?: string;
  porcentajeParticipacion?: number | null;
  remuneracion?: boolean;
  sector?: string;
  mismoEnteDeclaranteComprador?: boolean;
  // ➕ Nuevo bloque: ingresos normalizados desde el backend
  ingresos?: Ingresos;
};

type DeclaranteCruce = {
  nombreDeclarante: string;
  fechaTomaPosesion?: string;
  totalContratos: number;
  contratosAntes: number;
  contratosDespues: number;
  montoTotal: number;
};

type DeclaranteConflicto = {
  nombreDeclarante: string;
  fechaTomaPosesion?: string;
  totalContratos: number;
  montoTotal: number;
  enteCoincidente?: string;
};

/** ─────────────────────── Utilidades ─────────────────────── **/
const fmtMoney = (v?: number) =>
  typeof v === 'number' && isFinite(v)
    ? v.toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN',
        maximumFractionDigits: 2,
      })
    : '—';

const fmtFull = (d: Date) =>
  d.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  });

const fmtMonthYear = (d: Date) =>
  d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }).replace('.', '');

/** A fecha → timestamp (ms). Acepta ISO o YYYY-MM-DD. Devuelve null si no parsea. */
function toTs(s?: string | null): number | null {
  if (!s) return null;
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return new Date(t + 'T00:00:00Z').getTime();
  }
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

const useDebounced = <T,>(value: T, delay = 250) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

function monthBands(from: Date, to: Date) {
  const bands: { start: Date; end: Date; label: string; i: number }[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  const cursor = new Date(start);
  let i = 0;
  while (cursor <= end) {
    const s = new Date(cursor);
    const e = new Date(cursor);
    e.setMonth(e.getMonth() + 1);
    bands.push({ start: s, end: e, label: fmtMonthYear(s), i });
    cursor.setMonth(cursor.getMonth() + 1);
    i++;
  }
  return bands;
}

/** Props del componente timeline */
type TimelinePageProps = {
  embedded?: boolean;
};

/** ─────────────────────── Componente ─────────────────────── **/
export default function TimelineScatterEChartsPage({ embedded }: TimelinePageProps) {
  // Búsqueda + suggest
  const [nombre, setNombre] = useState('');
  const debouncedNombre = useDebounced(nombre, 250);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [openSuggest, setOpenSuggest] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sheet de lista de declarantes
  const [sheetOpen, setSheetOpen] = useState(false);

  const [allDeclarantes, setAllDeclarantes] = useState<string[]>([]);
  const [cruceDeclarantes, setCruceDeclarantes] = useState<DeclaranteCruce[]>([]);
  const [conflictoDeclarantes, setConflictoDeclarantes] = useState<DeclaranteConflicto[]>([]);

  const [sheetMode, setSheetMode] = useState<'todos' | 'cruce' | 'conflicto'>('todos');
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState('');

  // Nuevo: criterio de ordenamiento para el cruce
  const [cruceSortBy, setCruceSortBy] = useState<'monto' | 'contratos'>('monto');

  // Datos de la gráfica
  const [rows, setRows] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emptySearch, setEmptySearch] = useState<string>('');

  // Ref de ECharts
  const chartRef = useRef<any>(null);

  /** ───────── Cargar solo padrón completo ───────── **/
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        setLoadingList(true);
        setListError('');

        const resTodos = await fetch(LIST_NOMBRES);

        if (!active) return;

        if (!resTodos.ok) {
          throw new Error('Error en listado de declarantes');
        }

        const jsonTodos = await resTodos.json();
        const itemsTodos: string[] = Array.isArray(jsonTodos?.items)
          ? jsonTodos.items
          : Array.isArray(jsonTodos)
          ? jsonTodos
          : [];
        setAllDeclarantes(itemsTodos);
      } catch (e) {
        if (!active) return;
        setListError('No se pudo obtener el padrón de declarantes.');
      } finally {
        if (active) setLoadingList(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

  /** ───────── Cargar muestreo de cruce (ordenable) ───────── **/
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const url = `${LIST_CRUCE}?sort_by=${encodeURIComponent(cruceSortBy)}&sort_dir=desc`;
        const resCruce = await fetch(url);

        if (!active) return;

        if (!resCruce.ok) {
          // No rompemos el padrón si falla solo este
          console.warn('Error en /declarantes-cruce-toma', resCruce.status);
          return;
        }

        const jsonCruce = await resCruce.json();
        const itemsCruce: DeclaranteCruce[] = Array.isArray(jsonCruce?.items)
          ? jsonCruce.items
          : [];
        setCruceDeclarantes(itemsCruce);
      } catch (e) {
        if (!active) return;
        console.warn('Error obteniendo /declarantes-cruce-toma', e);
        // No tocamos listError aquí
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [cruceSortBy]);

  /** ───────── Cargar declarantes con posible conflicto ente/comprador ───────── **/
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const url = `${LIST_CONFLICTO}?sort_by=monto&sort_dir=desc`;
        const res = await fetch(url);
        if (!active) return;

        if (!res.ok) {
          console.warn('Error en /declarantes-conflicto', res.status);
          return;
        }

        const json = await res.json();
        const items: DeclaranteConflicto[] = Array.isArray(json?.items) ? json.items : [];
        setConflictoDeclarantes(items);
      } catch (e) {
        if (!active) return;
        console.warn('Error obteniendo /declarantes-conflicto', e);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

  /** ───────── Autocomplete (sólo para búsqueda rápida) ───────── **/
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!debouncedNombre || debouncedNombre.trim().length < 2) {
        setSuggestions([]);
        setOpenSuggest(false);
        setActiveIndex(-1);
        return;
      }
      try {
        const res = await fetch(`${SUGGEST}?query=${encodeURIComponent(debouncedNombre)}`);
        if (!res.ok) throw new Error('Error en suggest');
        const json = await res.json();
        if (!active) return;
        const items: string[] = Array.isArray(json.items) ? json.items : [];
        setSuggestions(items);
        setActiveIndex(items.length ? 0 : -1);
        setOpenSuggest(items.length > 0);
      } catch {
        if (!active) return;
        setSuggestions([]);
        setActiveIndex(-1);
        setOpenSuggest(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [debouncedNombre]);

  /** ───────── Fetch principal ───────── **/
  const fetchData = useCallback(
    async (n: string) => {
      const q = n?.trim();
      if (!q) {
        setError('Ingresa un nombre para buscar');
        return;
      }
      setLoading(true);
      setError('');
      setEmptySearch('');
      try {
        const url = `${ENDPOINT}?nombre=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
        const json = await res.json();

        const arr = Array.isArray(json.contratos) ? (json.contratos as Contrato[]) : [];
        setRows(arr);
        if (arr.length === 0) setEmptySearch(q);
      } catch {
        setError('No se pudieron obtener los datos. Intenta de nuevo.');
        setRows([]);
      } finally {
        setLoading(false);
        setOpenSuggest(false);
        // 👉 limpiar el cuadro de búsqueda después de cualquier consulta
        setNombre('');
      }
    },
    []
  );

  /** Seleccionar nombre desde autocomplete (se puede ver un momento, pero luego se limpia) */
  const selectNombre = useCallback(
    (s: string) => {
      setNombre(s);
      setOpenSuggest(false);
      setSheetOpen(false);
      fetchData(s);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [fetchData]
  );

  /** Seleccionar nombre desde el sheet (no es necesario reflejarlo en el input) */
  const selectNombreFromSheet = useCallback(
    (s: string) => {
      setOpenSuggest(false);
      setSheetOpen(false);
      fetchData(s);
      setNombre('');
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [fetchData]
  );

  const onKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (openSuggest && suggestions.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        selectNombre(suggestions[activeIndex]);
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchData(nombre);
    }
    if (e.key === 'Escape') {
      setOpenSuggest(false);
    }
  };

  /** ───────── Puntos de inicio/fin (timestamps) ───────── **/
  const { puntosInicio, puntosFin } = useMemo(() => {
    const inicio: { x: number; y: number; c: Contrato }[] = [];
    const fin: { x: number; y: number; c: Contrato }[] = [];

    rows.forEach((c) => {
      const monto = typeof c.montoContrato === 'number' ? c.montoContrato : NaN;
      if (!isFinite(monto) || monto <= 0) return;

      const xi = toTs(c.fechaInicioContrato);
      if (xi != null) inicio.push({ x: xi, y: monto, c });

      const xf = toTs(c.fechaFinContrato);
      if (xf != null) fin.push({ x: xf, y: monto, c });
    });

    return { puntosInicio: inicio, puntosFin: fin };
  }, [rows]);

  /** ───────── Fechas de toma de posesión (timestamps) ───────── **/
  const tomaTs = useMemo(() => {
    const raw = rows.map((r) => r.fechaTomaPosesion).filter(Boolean) as string[];
    const ts = raw.map(toTs).filter((n): n is number => n != null);
    return Array.from(new Set(ts)).sort((a, b) => a - b);
  }, [rows]);

  /** ───────── Rango X (incluye tomas) ───────── **/
  const xRange = useMemo(() => {
    const xs = [...puntosInicio.map((p) => p.x), ...puntosFin.map((p) => p.x), ...tomaTs];
    if (xs.length === 0) return null;
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    const pad = Math.max(15 * 24 * 3600 * 1000, (max - min) * 0.05);
    return { min: min - pad, max: max + pad };
  }, [puntosInicio, puntosFin, tomaTs]);

  /** ───────── Bandas mensuales ───────── **/
  const bandsInfo = useMemo(() => {
    if (!xRange) return null;
    const from = new Date(xRange.min);
    const to = new Date(xRange.max);
    return { from, to, bands: monthBands(from, to) };
  }, [xRange]);

  const markAreaData = useMemo(() => {
    if (!bandsInfo) return [];
    return bandsInfo.bands
      .filter((_, i) => i % 2 === 0)
      .map((b) => [
        { xAxis: b.start.getTime() },
        { xAxis: b.end.getTime() },
      ]);
  }, [bandsInfo]);

  /** ───────── Series de puntos ───────── **/
  const serieInicio = useMemo(() => {
    if (puntosInicio.length === 0) return null;
    const data = puntosInicio.map((p) => ({ value: [p.x, p.y], contrato: p.c }));
    return {
      type: 'scatter' as const,
      name: 'Fecha Inicio',
      data,
      symbolSize: (val: any) => {
        const y = Number(val[1] ?? 0);
        const base = 10 + Math.sqrt(Math.max(0, y)) / 180;
        return Math.max(8, Math.min(base, 24));
      },
      itemStyle: {
        color: COLORS.inicio,
        borderColor: '#fff',
        borderWidth: 2,
        shadowBlur: 4,
        shadowColor: 'rgba(16,185,129,0.3)',
      },
      emphasis: { focus: 'series', itemStyle: { borderWidth: 3, shadowBlur: 8 } },
      z: 5,
    };
  }, [puntosInicio]);

  const serieFin = useMemo(() => {
    if (puntosFin.length === 0) return null;
    const data = puntosFin.map((p) => ({ value: [p.x, p.y], contrato: p.c }));
    return {
      type: 'scatter' as const,
      name: 'Fecha Fin',
      data,
      symbolSize: (val: any) => {
        const y = Number(val[1] ?? 0);
        const base = 10 + Math.sqrt(Math.max(0, y)) / 180;
        return Math.max(8, Math.min(base, 24));
      },
      itemStyle: {
        color: COLORS.fin,
        borderColor: '#fff',
        borderWidth: 2,
        shadowBlur: 4,
        shadowColor: 'rgba(239,68,68,0.3)',
      },
      emphasis: { focus: 'series', itemStyle: { borderWidth: 3, shadowBlur: 8 } },
      z: 5,
    };
  }, [puntosFin]);

  /** ───────── Bandas mensuales como serie vacía ───────── **/
  const bandsSeries = useMemo(() => {
    if (!markAreaData.length) return null;
    return {
      type: 'scatter' as const,
      name: 'Bandas',
      data: [],
      markArea: {
        silent: true,
        itemStyle: { color: COLORS.monthBand, opacity: 0.15 },
        data: markAreaData,
      },
      z: 0,
      zlevel: 0,
    };
  }, [markAreaData]);

  /** ───────── Líneas verticales (markLine con ms) ───────── **/
  const tomaMarkSeries = useMemo(() => {
    if (tomaTs.length === 0) return null;
    return {
      type: 'scatter' as const, // serie vacía; solo se usa markLine
      name: 'Toma de Posesión',
      data: [],
      itemStyle: {
        color: COLORS.toma, // mismo color que la línea -> coincide en la leyenda
      },
      markLine: {
        symbol: 'none',
        silent: true,
        lineStyle: {
          color: COLORS.toma,
          width: 2,
          type: 'solid',
          opacity: 0.95,
        },
        label: {
          show: true,
          position: 'end',
          formatter: (p: any) => {
            const x = p?.data?.xAxis as number | undefined;
            return x ? `Toma del cargo · ${fmtFull(new Date(x))}` : 'Toma del cargo';
          },
          color: '#ffffff',
          backgroundColor: COLORS.toma,
          padding: [3, 8],
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 500,
        },
        data: tomaTs.map((x) => ({ xAxis: x })),
      },
      z: 10,
      zlevel: 0,
    };
  }, [tomaTs]);

  /** ───────── OPTION de ECharts ───────── **/
  const option = useMemo(() => {
    const series = [bandsSeries, tomaMarkSeries, serieInicio, serieFin].filter(Boolean);

    return {
      backgroundColor: 'transparent',
      grid: { top: 64, right: 80, bottom: 96, left: 96, containLabel: true },
      legend: {
        data: ['Fecha Inicio', 'Fecha Fin', 'Toma de Posesión'],
        top: 10,
        textStyle: { color: COLORS.text },
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        borderColor: COLORS.border,
        backgroundColor: '#fff',
        textStyle: { color: COLORS.text },
        formatter: (params: any) => {
          const name = params?.seriesName as string | undefined;
          if (name === 'Fecha Inicio') return tooltipFormatter('inicio')(params);
          if (name === 'Fecha Fin') return tooltipFormatter('fin')(params);
          return '';
        },
      },
      xAxis: {
        type: 'time',
        min: xRange?.min,
        max: xRange?.max,
        name: 'Fecha (mes/año)',
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: { color: COLORS.text, fontSize: 13, fontWeight: 600 },
        axisLabel: {
          color: COLORS.tick,
          fontSize: 11,
          hideOverlap: true,
          formatter: (val: number) => {
            const d = new Date(val);
            return d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
          },
        },
        axisLine: { lineStyle: { color: COLORS.grid } },
        splitLine: { show: false },
        axisPointer: { type: 'line' },
      },
      yAxis: {
        type: 'value',
        name: 'Monto del Contrato (MXN)',
        nameLocation: 'middle',
        nameGap: 60,
        nameTextStyle: { color: COLORS.text, fontSize: 13, fontWeight: 600 },
        axisLabel: {
          color: COLORS.tick,
          fontSize: 11,
          formatter: (v: number) => {
            const n = Number(v);
            const abs = Math.abs(n);
            if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
            if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
            if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
            return `$${n.toFixed(0)}`;
          },
        },
        axisLine: { lineStyle: { color: COLORS.grid } },
        splitLine: { lineStyle: { color: COLORS.grid, type: 'dashed', opacity: 0.4 } },
        scale: true,
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        {
          xAxisIndex: 0,
          type: 'slider',
          height: 26,
          bottom: 56,
          handleIcon: 'path://M8,0 L12,0 L12,24 L8,24 z',
          handleStyle: { color: COLORS.primary },
          textStyle: { color: COLORS.tick },
        },
      ],
      series,
      animationDuration: 400,
      animationEasing: 'cubicOut',
    };
  }, [bandsSeries, tomaMarkSeries, serieInicio, serieFin, xRange]);

  const totalPuntos = puntosInicio.length + puntosFin.length;

  /** ───────── Vista ───────── **/
  return (
    <main
      className="min-h-screen w-full flex flex-col items-center py-8 overflow-x-hidden"
      style={{ background: COLORS.bg, color: COLORS.text }}
    >
      <div className="w-full max-w-screen-2xl px-4 min-w-0">
        <Card
          className="border rounded-xl shadow-sm overflow-hidden max-w-full"
          style={{ background: COLORS.surface, borderColor: COLORS.border }}
        >
          <CardHeader className="pb-3 border-b border-slate-200/70 bg-gradient-to-r from-slate-50 to-transparent">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Lado izquierdo: título + descripción */}
              <div className="flex items-start gap-3 min-w-0">
                {/* Icono en contenedor suave */}
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{
                    background: `radial-gradient(circle at 30% 0%, ${COLORS.primary}22, transparent 60%), #ffffff`,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.primary,
                  }}
                >
                  <Calendar className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  {/* Eyebrow / contexto */}
                  <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                    <span>
                      Cruce de los Sistemas de Declaración Patrimonial (S1) y Contrataciones Públicas
                      (S6)
                    </span>
                  </div>

                  {/* Título principal */}
                  <CardTitle
                    className="mt-1 text-[15px] sm:text-[16px] font-semibold tracking-tight text-slate-900"
                    style={{ color: COLORS.primary }}
                  >
                    Línea de tiempo de contratos por declarante
                  </CardTitle>

                  {/* Descripción corta y profesional */}
                  <p className="mt-1 text-[11px] sm:text-xs leading-snug text-slate-500">
                    Explora la secuencia temporal de los contratos asociados a un servidor público,
                    contrastando fechas de{' '}
                    <span className="font-semibold text-emerald-600">inicio</span>,{' '}
                    <span className="font-semibold text-red-600">fin</span> y{' '}
                    <span className="font-semibold" style={{ color: COLORS.toma }}>
                      toma de posesión
                    </span>
                    . Además, visualiza la composición de sus ingresos declarados.
                  </p>
                </div>
              </div>

              {/* Lado derecho: mini leyenda / estado */}
              <div className="flex flex-col items-start sm:items-end gap-1 text-[10px]">
                {/* Etiqueta de módulo */}
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 bg-white text-[10px] font-medium text-slate-600 shadow-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COLORS.toma }} />
                  <span className="ml-1">Codificación de eventos</span>
                </span>

                <span className="text-[10px] text-slate-400">
                  Selecciona un declarante para activar la visualización.
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {/* Buscador + Sheet */}
            <div className="relative z-30 mt-1 flex flex-col sm:flex-row items-stretch gap-2 min-w-0">
              <Popover open={openSuggest} onOpenChange={setOpenSuggest}>
                <PopoverTrigger asChild>
                  <div className="flex-1 min-w-0">
                    <Input
                      ref={inputRef}
                      placeholder="Buscar declarante…"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      onKeyDown={onKeyDownInput}
                      onFocus={() => {
                        if (suggestions.length > 0) setOpenSuggest(true);
                      }}
                      className="h-10 text-[15px] rounded-lg w-full"
                      style={{
                        background: '#ffffff',
                        borderColor: COLORS.border,
                        color: COLORS.text,
                      }}
                    />
                  </div>
                </PopoverTrigger>
                {suggestions.length > 0 && (
                  <PopoverContent
                    side="bottom"
                    align="start"
                    className="p-0 rounded-lg overflow-hidden border z-50 w-[--radix-popover-trigger-width] max-w-[90vw]"
                    style={{ background: '#ffffff', borderColor: COLORS.border }}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    sideOffset={6}
                  >
                    <ScrollArea className="max-h-64">
                      <ul className="divide-y" style={{ borderColor: COLORS.border }}>
                        {suggestions.map((s, i) => (
                          <li
                            key={`${s}-${i}`}
                            className={`px-3 sm:px-4 py-2.5 text-sm cursor-pointer hover:bg-gray-50 transition-colors ${
                              i === activeIndex ? 'bg-gray-50' : ''
                            }`}
                            onMouseEnter={() => setActiveIndex(i)}
                            onClick={() => selectNombre(s)}
                            style={{ color: COLORS.text }}
                          >
                            {s}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </PopoverContent>
                )}
              </Popover>

              <div className="flex gap-2 justify-end">
                <Button
                  onClick={() => fetchData(nombre)}
                  disabled={loading}
                  className="h-10 px-4 font-medium rounded-lg shrink-0 disabled:opacity-50"
                  style={{
                    background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
                    color: 'white',
                    borderColor: 'transparent',
                  }}
                >
                  {loading ? 'Buscando...' : 'Buscar'}
                </Button>

                {/* Sheet con listado de declarantes (padrón + muestreo) */}
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      className="h-10 px-3 text-xs sm:text-sm whitespace-nowrap rounded-lg font-medium shrink-0 disabled:opacity-50 flex items-center"
                      style={{
                        background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
                        color: 'white',
                        borderColor: 'transparent',
                      }}
                    >
                      <Users className="h-4 w-4 mr-1.5" />
                      Listado de declarantes
                    </Button>
                  </SheetTrigger>

                  <SheetContent side="left" className="p-0 flex flex-col sm:max-w-[480px]">
                    <SheetHeader className="px-5 pt-4 pb-2 border-b">
                      <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Users className="h-4 w-4" />
                        Explorador de declarantes
                      </SheetTitle>
                      <p className="text-[11px] text-muted-foreground text-left">
                        Recorre el padrón, revisa casos con contratos antes y después de la toma o
                        enfócate en posibles conflictos donde el ente del declarante coincide con la
                        institución compradora.
                      </p>

                      {/* ───── Toggle modo de listado ───── */}
                      <div className="mt-4 flex flex-col gap-1">
                        <span className="text-[10px] font-semibold tracking-[0.15em] text-slate-400 uppercase">
                          Vista
                        </span>

                        <div
                          className="
                            inline-flex w-full items-center gap-1
                            rounded-2xl p-1
                            bg-white/60 backdrop-blur-md
                            border border-slate-200/60 shadow-sm
                          "
                        >
                          {/* Opción 1 */}
                          <button
                            type="button"
                            onClick={() => setSheetMode('todos')}
                            className={`
                              flex-1 inline-flex items-center justify-center gap-2
                              rounded-xl px-3 py-1.5
                              text-[11px] font-medium
                              transition-all duration-200
                              ${
                                sheetMode === 'todos'
                                  ? 'bg-white shadow-md text-slate-900 border border-slate-200'
                                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/70'
                              }
                            `}
                          >
                            <span
                              className="
                                h-3 w-3 rounded-full shrink-0
                                border border-slate-400/60 bg-slate-500
                              "
                            />
                            Padrón completo
                          </button>

                          {/* Opción 2 */}
                          <button
                            type="button"
                            onClick={() => setSheetMode('cruce')}
                            className={`
                              flex-1 inline-flex items-center justify-center gap-2
                              rounded-xl px-3 py-1.5
                              text-[11px] font-medium
                              transition-all duration-200
                              ${
                                sheetMode === 'cruce'
                                  ? 'bg-white shadow-md text-slate-900 border border-purple-200'
                                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/70'
                              }
                            `}
                          >
                            <span
                              className="
                                h-3 w-3 rounded-full shrink-0
                                border border-red-500/50 bg-red-500
                              "
                            />
                            Contratos antes / después
                          </button>

                          {/* Opción 3 */}
                          <button
                            type="button"
                            onClick={() => setSheetMode('conflicto')}
                            className={`
                              flex-1 inline-flex items-center justify-center gap-2
                              rounded-xl px-3 py-1.5
                              text-[11px] font-medium
                              transition-all duration-200
                              ${
                                sheetMode === 'conflicto'
                                  ? 'bg-white shadow-md text-slate-900 border border-red-300'
                                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/70'
                              }
                            `}
                          >
                            <span
                              className="
                                h-3 w-3 rounded-full shrink-0
                                border border-red-600/60 bg-red-600
                              "
                            />
                            Conflicto ente / comprador
                          </button>
                        </div>
                      </div>

                      {/* ───── Ordenamiento (solo para modo cruce) ───── */}
                      {sheetMode === 'cruce' && (
                        <div className="mt-3 flex flex-col gap-1">
                          <span className="text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                            Ordenar por
                          </span>

                          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100/80 p-0.5">
                            {/* Monto total */}
                            <button
                              type="button"
                              onClick={() => setCruceSortBy('monto')}
                              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all
                                ${
                                  cruceSortBy === 'monto'
                                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-emerald-200'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                                }
                              `}
                            >
                              {/* icono money */}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5 text-emerald-600"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                                <path d="M8 12h8M9 9h1M14 15h1" />
                              </svg>
                              Monto total
                            </button>

                            {/* Número de contratos */}
                            <button
                              type="button"
                              onClick={() => setCruceSortBy('contratos')}
                              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all
                                ${
                                  cruceSortBy === 'contratos'
                                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                                }
                              `}
                            >
                              {/* icono conteo */}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5 text-slate-600"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M5 7h14M5 12h9M5 17h6" />
                              </svg>
                              Núm. de contratos
                            </button>
                          </div>
                        </div>
                      )}
                    </SheetHeader>

                    <div className="px-5 py-3 border-b bg-muted/40 flex items-center justify-between">
                      <div className="text-[11px] text-muted-foreground">
                        {loadingList
                          ? 'Cargando padrón de declarantes…'
                          : listError
                          ? listError
                          : sheetMode === 'todos'
                          ? allDeclarantes.length === 0
                            ? 'No se encontraron declarantes en el padrón.'
                            : `${allDeclarantes.length.toLocaleString(
                                'es-MX'
                              )} declarantes en el padrón.`
                          : sheetMode === 'cruce'
                          ? cruceDeclarantes.length === 0
                            ? 'No se encontraron casos con contratos antes y después de la toma.'
                            : `${cruceDeclarantes.length.toLocaleString(
                                'es-MX'
                              )} casos con contratos antes y después de la toma.`
                          : conflictoDeclarantes.length === 0
                          ? 'No se encontraron casos donde el ente del declarante coincide con la institución compradora.'
                          : `${conflictoDeclarantes.length.toLocaleString(
                              'es-MX'
                            )} casos con posible conflicto ente / comprador.`}
                      </div>
                    </div>

                    <ScrollArea className="flex-1">
                      {loadingList ? (
                        <div className="px-5 py-8 text-xs text-slate-500">
                          Preparando el padrón para exploración…
                        </div>
                      ) : listError ? (
                        <div className="px-5 py-8 text-xs text-red-500">{listError}</div>
                      ) : sheetMode === 'todos' ? (
                        allDeclarantes.length > 0 ? (
                          <ul className="divide-y">
                            {allDeclarantes.map((s, i) => (
                              <li
                                key={`${s}-${i}`}
                                className="px-5 py-3 text-sm cursor-pointer hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                                onClick={() => selectNombreFromSheet(s)}
                              >
                                <div className="flex flex-col items-start">
                                  <span className="font-medium text-slate-900">{s}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="px-5 py-8 text-center text-xs text-slate-500">
                            El padrón está vacío (verifica el endpoint{' '}
                            <code className="mx-1 text-[10px] bg-slate-100 px-1 rounded">
                              /timeline/declarantes
                            </code>
                            ).
                          </div>
                        )
                      ) : sheetMode === 'cruce' ? (
                        cruceDeclarantes.length > 0 ? (
                          <ul className="divide-y">
                            {cruceDeclarantes.map((item, i) => (
                              <li
                                key={`${item.nombreDeclarante}-${i}`}
                                className="px-5 py-3 text-sm cursor-pointer hover:bg-slate-50 transition-colors group"
                                onClick={() => selectNombreFromSheet(item.nombreDeclarante)}
                              >
                                <div className="flex gap-3">
                                  {/* Barra lateral */}
                                  <div className="w-1 rounded-full bg-slate-200 group-hover:bg-purple-300 mt-1 transition-colors" />

                                  <div className="flex-1 min-w-0">
                                    {/* Nombre + Monto sobrio */}
                                    <div className="flex items-start justify-between gap-3">
                                      {/* Nombre */}
                                      <div className="min-w-0">
                                        <span className="font-medium text-slate-900 truncate block">
                                          {item.nombreDeclarante}
                                        </span>

                                        {/* Fecha de toma */}
                                        <span className="mt-0.5 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                          Toma del cargo:&nbsp;
                                          {item.fechaTomaPosesion
                                            ? (() => {
                                                const ts = toTs(item.fechaTomaPosesion);
                                                return ts
                                                  ? fmtFull(new Date(ts))
                                                  : item.fechaTomaPosesion;
                                              })()
                                            : 'sin fecha'}
                                        </span>
                                      </div>

                                      {/* Monto total — sobrio y pequeño */}
                                      <div className="shrink-0 text-right leading-tight">
                                        <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                          monto total
                                        </div>
                                        <div className="text-xs font-semibold text-slate-700">
                                          {fmtMoney(item.montoTotal)}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Badges de métricas */}
                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                      {/* Total contratos */}
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                                        {/* icono: portafolio */}
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-3 w-3 text-slate-600"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth="2"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M3 7h18M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l3-4h12l3 4"
                                          />
                                        </svg>
                                        {item.totalContratos.toLocaleString('es-MX')} contratos
                                      </span>

                                      {/* Contratos antes */}
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                                        {/* icono: flecha atrás */}
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-3 w-3 text-amber-600"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth="2"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M10 19l-7-7 7-7M3 12h18"
                                          />
                                        </svg>
                                        {item.contratosAntes.toLocaleString('es-MX')} antes
                                      </span>

                                      {/* Contratos después — ROJO ALERTA */}
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-700">
                                        {/* icono: flecha adelante */}
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-3 w-3 text-red-600"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth="2"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M14 5l7 7-7 7M21 12H3"
                                          />
                                        </svg>
                                        {item.contratosDespues.toLocaleString('es-MX')} después
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="px-5 py-8 text-center text-xs text-slate-500">
                            No hay casos con contratos antes y después de la fecha de toma de posesión
                            (endpoint{' '}
                            <code className="mx-1 text-[10px] bg-slate-100 px-1 rounded">
                              /timeline/declarantes-cruce-toma
                            </code>
                            ).
                          </div>
                        )
                      ) : conflictoDeclarantes.length > 0 ? (
                        <ul className="divide-y">
                          {conflictoDeclarantes.map((item, i) => (
                            <li
                              key={`${item.nombreDeclarante}-${i}`}
                              className="px-5 py-3 text-sm cursor-pointer hover:bg-red-50/60 transition-colors group"
                              onClick={() => selectNombreFromSheet(item.nombreDeclarante)}
                            >
                              <div className="flex gap-3">
                                {/* Barra lateral roja */}
                                <div className="w-1 rounded-full bg-red-200 group-hover:bg-red-400 mt-1 transition-colors" />

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 mb-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Posible conflicto ente / comprador
                                      </div>

                                      <span className="font-medium text-slate-900 truncate block">
                                        {item.nombreDeclarante}
                                      </span>

                                      <span className="mt-0.5 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                        Toma del cargo:&nbsp;
                                        {item.fechaTomaPosesion
                                          ? (() => {
                                              const ts = toTs(item.fechaTomaPosesion);
                                              return ts ? fmtFull(new Date(ts)) : item.fechaTomaPosesion;
                                            })()
                                          : 'sin fecha'}
                                      </span>

                                      {item.enteCoincidente && (
                                        <div className="mt-1 text-[10px] text-slate-600 leading-snug">
                                          <span className="font-semibold text-red-700">
                                            Ente / institución:
                                          </span>{' '}
                                          {item.enteCoincidente}
                                        </div>
                                      )}
                                    </div>

                                    <div className="shrink-0 text-right leading-tight">
                                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                        monto total en conflicto
                                      </div>
                                      <div className="text-xs font-semibold text-slate-700">
                                        {fmtMoney(item.montoTotal)}
                                      </div>
                                      <div className="mt-0.5 text-[10px] text-slate-500">
                                        {item.totalContratos.toLocaleString('es-MX')} contrato
                                        {item.totalContratos !== 1 ? 's' : ''} en conflicto
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="px-5 py-8 text-center text-xs text-slate-500">
                          No hay casos donde el ente del declarante coincida con la institución
                          compradora (endpoint{' '}
                          <code className="mx-1 text-[10px] bg-slate-100 px-1 rounded">
                            /timeline/declarantes-conflicto
                          </code>
                          ).
                        </div>
                      )}
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {loading && (
              <p className="mt-3 text-sm" style={{ color: COLORS.textWeak }}>
                Cargando datos…
              </p>
            )}
            {error && (
              <p className="mt-2 text-sm" style={{ color: '#b91c1c' }}>
                {error}
              </p>
            )}
            {!loading && emptySearch && rows.length === 0 && (
              <p className="mt-2 text-sm" style={{ color: COLORS.textWeak }}>
                No se encontraron contratos para &quot;{emptySearch}&quot;. Asegúrate de seleccionar el
                nombre exacto del padrón.
              </p>
            )}

            {/* Ficha pegajosa del declarante (datos de declaración + ingresos) */}
            {rows.length > 0 && (
              <DeclaracionSticky
                declarante={rows[0]}
                hasConflicto={rows.some((r) => r.mismoEnteDeclaranteComprador)}
                enteCoincidente={
                  rows.find((r) => r.mismoEnteDeclaranteComprador)?.institucionCompradora
                }
              />
            )}

            {/* Estadísticas */}
            {(totalPuntos > 0 || tomaTs.length > 0) && (
              <div className="mt-4 flex flex-wrap gap-3">
                <div
                  className="px-3 py-2 rounded-lg border"
                  style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: COLORS.inicio }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ background: COLORS.inicio }}></div>
                    <span className="text-xs font-medium" style={{ color: COLORS.text }}>
                      {puntosInicio.length} fecha{puntosInicio.length !== 1 ? 's' : ''} de inicio del
                      contrato
                    </span>
                  </div>
                </div>
                <div
                  className="px-3 py-2 rounded-lg border"
                  style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: COLORS.fin }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ background: COLORS.fin }}></div>
                    <span className="text-xs font-medium" style={{ color: COLORS.text }}>
                      {puntosFin.length} fecha{puntosFin.length !== 1 ? 's' : ''} de fin del contrato
                    </span>
                  </div>
                </div>
                {tomaTs.length > 0 && (
                  <div
                    className="px-3 py-2 rounded-lg border"
                    style={{ background: 'rgba(113, 57, 114, 0.08)', borderColor: COLORS.toma }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ background: COLORS.toma }}></div>
                      <span className="text-xs font-medium" style={{ color: COLORS.text }}>
                        {tomaTs.length} toma{tomaTs.length !== 1 ? 's' : ''} de posesión del cargo
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chart */}
            <div className="mt-4 w-full max-w-full min-w-0">
              <div className="relative w-full h-[640px] sm:h-[72vh] min-h-[520px] max-w-full">
                {totalPuntos === 0 && tomaTs.length === 0 && !loading ? (
                  <EmptyState />
                ) : (
                  <ReactECharts
                    option={option as any}
                    style={{ width: '100%', height: '100%', display: 'block' }}
                    notMerge
                    opts={{ renderer: 'canvas' }}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        
      </div>
    </main>
  );
}

/** ───────── Tooltip generator (solo datos del contrato) ───────── **/
function tooltipFormatter(tipo: 'inicio' | 'fin') {
  return (params: any) => {
    const dateMs = params?.value?.[0] as number | undefined;
    const amount = params?.value?.[1] as number | undefined;
    const c: Contrato | undefined = params?.data?.contrato;
    const date = typeof dateMs === 'number' ? new Date(dateMs) : undefined;

    const label = tipo === 'inicio' ? 'Inicio de contrato' : 'Fin de contrato';
    const icon =
      tipo === 'inicio'
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    const rawDesc = (c?.descripcionContrato ?? '').trim();
    const truncatedDesc = rawDesc.length > 260 ? rawDesc.substring(0, 260) + '…' : rawDesc;

    const longTextStyle = `
      flex:1;
      min-width:0;
      word-wrap:break-word;
      overflow-wrap:break-word;
      white-space:normal;
    `;

    // Solo datos del contrato
    const empresa =
      c?.empresaRelacionada && c.empresaRelacionada.trim().length > 0
        ? c.empresaRelacionada.trim()
        : null;

    const sector = c?.sector && c.sector.trim().length > 0 ? c.sector.trim() : null;

    const institucionCompradora =
      c?.institucionCompradora && c.institucionCompradora.trim().length > 0
        ? c.institucionCompradora.trim()
        : null;

    const remuneracionLabel =
      typeof c?.remuneracion === 'boolean'
        ? c.remuneracion
          ? 'Con remuneración'
          : 'Sin remuneración'
        : null;

    return `
<div style="
  max-width:400px;
  box-sizing:border-box;
  border-radius:10px;
  border:1px solid ${COLORS.border};
  background:#ffffff;
  box-shadow:0 8px 20px rgba(15,23,42,0.18);
  overflow:hidden;
  font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
">
  <!-- Header -->
  <div style="
    display:flex;
    align-items:center;
    gap:10px;
    padding:8px 10px;
    background:linear-gradient(120deg, ${COLORS.primary}, ${COLORS.accent});
    color:#ffffff;
  ">
    <div style="
      height:32px;
      width:32px;
      border-radius:10px;
      background:rgba(15,23,42,0.18);
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
    ">
      ${icon}
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:600;font-size:13px;letter-spacing:0.02em;">
        ${label}
      </div>
      <div style="font-size:11px;opacity:0.9;${longTextStyle}">
        ${date ? fmtFull(date) : 'Fecha no disponible'}
      </div>
    </div>
  </div>

  <!-- Body -->
  <div style="padding:8px 10px 6px 10px;">

    <!-- Monto -->
    <div style="
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      margin:4px 0 6px 0;
    ">
      <span style="
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:0.12em;
        color:${COLORS.textWeak};
      ">
        Monto del contrato
      </span>
      <span style="
        font-size:12px;
        font-weight:700;
        color:${COLORS.text};
        padding:2px 8px;
        border-radius:999px;
        background:rgba(15,23,42,0.03);
      ">
        ${fmtMoney(amount)}
      </span>
    </div>

    <!-- Empresa / proveedor -->
    ${
      empresa || remuneracionLabel || sector
        ? `<div style="
             margin-top:4px;
             padding:6px 8px;
             border-radius:8px;
             background:rgba(148,163,184,0.08);
           ">
             <div style="
               font-size:11px;
               text-transform:uppercase;
               letter-spacing:0.16em;
               color:${COLORS.textWeak};
               font-weight:600;
               margin-bottom:4px;
               display:flex;
               align-items:center;
               gap:4px;
             ">
               <span style="font-size:12px;">🏢</span>
               <span>Proveedor / empresa vinculada</span>
             </div>

             ${
               empresa
                 ? `<div style="display:flex;align-items:flex-start;gap:6px;margin:2px 0;">
                      <span style="margin-top:1px;">📇</span>
                      <div style="${longTextStyle}">
                        <div style="font-size:12px;color:${COLORS.text};font-weight:500;">
                          ${empresa}
                        </div>
                      </div>
                    </div>`
                 : ''
             }

             ${
               sector
                 ? `<div style="display:flex;align-items:flex-start;gap:6px;margin:2px 0;">
                      <span style="margin-top:1px;">📂</span>
                      <div style="${longTextStyle}">
                        <div style="font-size:11px;color:${COLORS.textWeak};opacity:0.9;">
                          Sector
                        </div>
                        <div style="font-size:12px;color:${COLORS.text};">
                          ${sector}
                        </div>
                      </div>
                    </div>`
                 : ''
             }

             ${
               remuneracionLabel
                 ? `<div style="display:flex;align-items:flex-start;gap:6px;margin:2px 0;">
                      <span style="margin-top:1px;">💰</span>
                      <div style="${longTextStyle}">
                        <div style="font-size:11px;color:${COLORS.textWeak};opacity:0.9;">
                          Remuneración
                        </div>
                        <div style="font-size:12px;color:${COLORS.text};">
                          ${remuneracionLabel}
                        </div>
                      </div>
                    </div>`
                 : ''
             }
           </div>`
        : ''
    }

    <!-- Institución compradora -->
    ${
      institucionCompradora
        ? `<div style="
             margin-top:8px;
             padding:6px 8px;
             border-radius:8px;
             background:rgba(34,197,94,0.04);
             border:1px dashed rgba(34,197,94,0.25);
           ">
             <div style="
               font-size:11px;
               text-transform:uppercase;
               letter-spacing:0.16em;
               color:${COLORS.textWeak};
               font-weight:600;
               margin-bottom:4px;
               display:flex;
               align-items:center;
               gap:4px;
             ">
               <span style="font-size:12px;">🏛️</span>
               <span>Institución compradora</span>
             </div>
             <div style="display:flex;align-items:flex-start;gap:6px;">
               <span style="margin-top:1px;">📍</span>
               <div style="${longTextStyle}">
                 <div style="font-size:12px;color:${COLORS.text};">
                   ${institucionCompradora}
                 </div>
               </div>
             </div>
           </div>`
        : ''
    }

    <!-- Descripción del contrato -->
    ${
      truncatedDesc
        ? `<div style="
             margin-top:8px;
             padding:6px 8px;
             border-radius:8px;
             background:rgba(15,23,42,0.015);
           ">
             <div style="
               font-size:11px;
               text-transform:uppercase;
               letter-spacing:0.16em;
               color:${COLORS.textWeak};
               font-weight:600;
               margin-bottom:4px;
               display:flex;
               align-items:center;
               gap:4px;
             ">
               <span style="font-size:12px;">📝</span>
               <span>Descripción del contrato</span>
             </div>
             <div style="
               max-height:110px;
               overflow:auto;
               font-size:11px;
               line-height:1.45;
               color:${COLORS.textWeak};
               word-wrap:break-word;
               overflow-wrap:break-word;
               white-space:normal;
             ">
               ${truncatedDesc}
             </div>
           </div>`
        : ''
    }
  </div>
</div>`;
  };
}

/** ───────── Estado vacío ───────── **/
function EmptyState() {
  return (
    <div
      className="w-full h-full rounded-lg border textcenter px-4 py-12 bg-white flex flex-col items-center justify-center"
      style={{ borderColor: COLORS.border, color: COLORS.text }}
    >
      <div
        className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: 'rgba(42,120,195,0.12)', color: COLORS.primary }}
      >
        <Search className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold mb-2">
        Busca un declarante para visualizar la línea de tiempo
      </h3>
      <p className="text-xs max-w-md" style={{ color: COLORS.textWeak }}>
        La gráfica mostrará las fechas de inicio (puntos verdes), fin (puntos rojos) y tomas de
        posesión (líneas moradas).
      </p>
    </div>
  );
}

/** ───────── Ficha pegajosa compacta ───────── **/
function DeclaracionSticky({
  declarante,
  hasConflicto,
  enteCoincidente,
}: {
  declarante: Contrato;
  hasConflicto?: boolean;
  enteCoincidente?: string;
}) {
  const {
    nombreDeclarante,
    institucionDeclarante,
    nombreEntePublico,
    nivelOrdenGobierno,
    puesto,
    funcionPrincipal,
    empresaRelacionada,
    tipoParticipacion,
    porcentajeParticipacion,
    remuneracion,
    sector,
    fechaTomaPosesion,
    ingresos,
  } = declarante;

  const tomaTs = toTs(fechaTomaPosesion);
  const fechaToma =
    tomaTs != null ? fmtFull(new Date(tomaTs)) : fechaTomaPosesion || 'Sin fecha registrada';

  const remuneracionLabel =
    typeof remuneracion === 'boolean'
      ? remuneracion
        ? 'Con remuneración'
        : 'Sin remuneración'
      : null;

  const nivelLegible =
    nivelOrdenGobierno &&
    nivelOrdenGobierno
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());

  // ───────── Ingresos: composición visual ─────────
  const ingresosCard = useMemo(() => {
    if (!ingresos) return null;

    const baseTotal =
      ingresos.totalIngresosAnualesNetos ??
      ingresos.ingresoAnualNetoDeclarante ??
      ingresos.remuneracionAnualCargoPublico ??
      null;

    const total = baseTotal && baseTotal > 0 ? baseTotal : null;

    const items = [
      {
        key: 'remuneracionAnualCargoPublico',
        label: 'Cargo público',
        color: '#0ea5e9',
        value: ingresos.remuneracionAnualCargoPublico ?? null,
      },
      {
        key: 'actividadEmpresarial',
        label: 'Actividad empresarial',
        color: '#22c55e',
        value: ingresos.actividadEmpresarial ?? null,
      },
      {
        key: 'serviciosProfesionales',
        label: 'Servicios profesionales',
        color: '#f97316',
        value: ingresos.serviciosProfesionales ?? null,
      },
      {
        key: 'otrosIngresos',
        label: 'Otros ingresos',
        color: '#eab308',
        value: ingresos.otrosIngresos ?? null,
      },
      {
        key: 'enajenacionBienes',
        label: 'Enajenación de bienes',
        color: '#a855f7',
        value: ingresos.enajenacionBienes ?? null,
      },
      {
        key: 'actividadFinanciera',
        label: 'Actividad financiera',
        color: '#a71a67ff',
        value: ingresos.actividadFinanciera ?? null,
      },
    ].filter((it) => typeof it.value === 'number' && (it.value ?? 0) > 0);

    if (!total || items.length === 0) return null;

    return { total, items };
  }, [ingresos]);

  return (
    <div className="mt-3">
      <div className="sticky top-2 z-10">
        <section
          className="rounded-lg border px-3 py-2 sm:px-4 sm:py-2.5 shadow-sm bg-white/95 backdrop-blur"
          style={{ borderColor: COLORS.border }}
        >
          {/* Encabezado */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-semibold"
                  style={{
                    background: 'rgba(113,57,114,0.12)',
                    color: COLORS.toma,
                  }}
                >
                  S1
                </span>

                <h2
                  className="text-[13px] sm:text-sm font-semibold truncate"
                  style={{ color: COLORS.text }}
                >
                  {nombreDeclarante}
                </h2>
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: COLORS.toma }}
                  />
                  {fechaToma}
                </span>

                {nivelLegible && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                    {nivelLegible}
                  </span>
                )}

                {institucionDeclarante && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-1.5 py-0.5 font-medium text-slate-600 max-w-full truncate">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    <span className="truncate">{institucionDeclarante}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Badge + posible alerta */}
            <div className="flex flex-col items-start sm:items-end gap-1">
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium text-slate-600 bg-slate-50">
                Ficha del servidor público
              </span>

              {hasConflicto && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-red-50 border-red-200 text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  Posible conflicto de interés
                  {enteCoincidente && (
                    <span className="ml-1 text-[9px] font-normal text-red-600">
                      ({enteCoincidente})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Contenido 2 columnas compactas + ingresos */}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {/* COL 1 — Empleo público */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                🏛️ Empleo público
              </div>

              {nombreEntePublico && (
                <div className="text-[11px] leading-tight">
                  <div className="font-semibold text-slate-600 uppercase tracking-wide text-[9px]">
                    Ente público
                  </div>
                  <div className="text-slate-800 break-words">
                    {nombreEntePublico}
                    {nivelLegible ? (
                      <span className="text-[10px] text-slate-500"> · {nivelLegible}</span>
                    ) : null}
                  </div>
                </div>
              )}

              {puesto && (
                <div className="text-[11px] leading-tight">
                  <div className="font-semibold text-slate-600 uppercase tracking-wide text-[9px]">
                    Puesto
                  </div>
                  <div className="text-slate-800 break-words">{puesto}</div>
                </div>
              )}

              {funcionPrincipal && (
                <div className="text-[11px] leading-tight">
                  <div className="font-semibold text-slate-600 uppercase tracking-wide text-[9px]">
                    Función principal
                  </div>
                  <div className="text-slate-700 break-words">
                    {funcionPrincipal.length > 160
                      ? funcionPrincipal.slice(0, 160) + '…'
                      : funcionPrincipal}
                  </div>
                </div>
              )}
            </div>

            {/* COL 2 — Vínculos privados */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                🏢 Vínculos privados
              </div>

              {empresaRelacionada && (
                <div className="text-[11px] leading-tight">
                  <div className="font-semibold text-slate-600 uppercase tracking-wide text-[9px]">
                    Empresa
                  </div>
                  <div className="text-slate-800 break-words">{empresaRelacionada}</div>
                </div>
              )}

              {/* CHIPS de participación — colores ALERTA */}
              {(tipoParticipacion || porcentajeParticipacion != null || remuneracionLabel) && (
                <div className="text-[11px] leading-tight">
                  <div className="font-semibold text-slate-600 uppercase tracking-wide text-[9px] mb-0.5">
                    Participación
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {/* Rol → rojo suave */}
                    {tipoParticipacion && (
                      <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-medium border border-red-200">
                        {tipoParticipacion}
                      </span>
                    )}

                    {/* Porcentaje → Ámbar */}
                    {porcentajeParticipacion != null && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-medium border border-amber-200">
                        {porcentajeParticipacion}% participación
                      </span>
                    )}

                    {/* Remuneración → Rojo intenso si la hay */}
                    {remuneracionLabel && (
                      <span
                        className={
                          remuneracion
                            ? 'inline-flex items-center rounded-full bg-red-200 text-red-800 px-2 py-0.5 text-[10px] font-semibold border border-red-300'
                            : 'inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-medium border border-slate-200'
                        }
                      >
                        {remuneracionLabel}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {sector && (
                <div className="text-[11px] leading-tight">
                  <div className="font-semibold text-slate-600 uppercase tracking-wide text-[9px]">
                    Sector
                  </div>
                  <div className="text-slate-800 break-words">{sector}</div>
                </div>
              )}
            </div>

            {/* COL 3 – Ingresos declarados (composición) */}
            {ingresosCard && (
              <div className="sm:col-span-2 mt-2">
                <div className="rounded-lg border px-3 py-2.5 bg-slate-50/80">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        💸 Ingresos declarados 
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Composición de los ingresos netos declarados en el Sistema 1.
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                        total neto
                      </div>
                      <div className="text-xs font-semibold text-slate-800">
                        {fmtMoney(ingresosCard.total)}
                      </div>
                    </div>
                  </div>

                  {/* Barra agregada */}
                  <div className="mt-2 w-full rounded-full bg-slate-200/70 h-3 overflow-hidden">
                    <div className="flex w-full h-3">
                      {ingresosCard.items.map((it) => {
                        const pct = Math.max(
                          3,
                          Math.min(100, ((it.value ?? 0) / ingresosCard.total) * 100)
                        );
                        return (
                          <div
                            key={it.key}
                            className="h-3"
                            style={{
                              width: `${pct}%`,
                              background: it.color,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Detalle por rubro */}
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                    {ingresosCard.items.map((it) => {
                      const pct = ((it.value ?? 0) / ingresosCard.total) * 100;
                      return (
                        <div
                          key={it.key}
                          className="rounded-md bg-white/70 border border-slate-200 px-2 py-1.5 flex flex-col gap-0.5"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-semibold text-slate-600 flex items-center gap-1">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: it.color }}
                              />
                              {it.label}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-800">
                            {fmtMoney(it.value ?? 0)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
