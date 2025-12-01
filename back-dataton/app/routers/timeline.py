from fastapi import APIRouter, Query, Request
from fastapi.routing import APIRoute
import json
from pathlib import Path
import os
import time
import logging
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

# ───────────────────────── Config ─────────────────────────
DATA_PATH = Path(__file__).resolve().parent.parent / "dataset.json"
DEBUG = os.getenv("TIMELINE_DEBUG", "0") in ("1", "true", "TRUE")
logger = logging.getLogger("uvicorn.error")
if DEBUG:
    logger.setLevel(logging.DEBUG)

BANNER = "🟣[TIMELINE]"


def _load_data() -> List[Dict[str, Any]]:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# ───────────────────────── Utilidades ─────────────────────────
def _try_parse_date(s: Optional[str]) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Intenta detectar formato y regresar ISO (para logging).
    Return: (ok, fmt_detectado, iso)
    """
    if not s or not isinstance(s, str):
        return (False, None, None)

    raw = s.strip()
    formats = [
        ("%Y-%m-%d", "YYYY-MM-DD"),
        ("%Y/%m/%d", "YYYY/MM/DD"),
        ("%d/%m/%Y", "DD/MM/YYYY"),
        ("%d-%m-%Y", "DD-MM-YYYY"),
        ("%Y-%m-%dT%H:%M:%SZ", "ISO-Z"),
        ("%Y-%m-%dT%H:%M:%S", "ISO"),  # sin Z
    ]
    for fmt, label in formats:
        try:
            dt = datetime.strptime(raw, fmt)
            iso = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            return (True, label, iso)
        except Exception:
            pass

    # Fallback: fromisoformat
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        iso = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        return (True, "fromisoformat", iso)
    except Exception:
        return (False, None, None)


def _sample(lst: List[Any], n: int = 10):
    return lst[:n]


def _to_ts(s: Optional[str]) -> Optional[float]:
    """
    Convierte una fecha en texto a timestamp (segundos desde epoch).
    Usa _try_parse_date para aceptar distintos formatos.
    """
    ok, _, iso = _try_parse_date(s)
    if not ok or not iso:
        return None
    try:
        dt = datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ")
        return dt.timestamp()
    except Exception:
        return None


# ───────────────────────── Ingresos ─────────────────────────
_INGRESOS_KEYS = [
    "remuneracionMensualCargoPublico",
    "remuneracionAnualCargoPublico",
    "ingresoMensualNetoDeclarante",
    "ingresoAnualNetoDeclarante",
    "totalIngresosMensualesNetos",
    "totalIngresosAnualesNetos",
    "actividadEmpresarial",
    "actividadFinanciera",
    "serviciosProfesionales",
    "otrosIngresos",
    "enajenacionBienes",
]


def _safe_number(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        v = value.strip()
        if not v:
            return None
        try:
            v = v.replace(",", "")
            return float(v)
        except Exception:
            return None
    return None


def _normalize_ingresos_dict(raw: Any) -> Dict[str, Optional[float]]:
    """
    Normaliza el campo d['ingresos'] del dataset a:
      {
        clave: float | None
      }

    No rompe si el campo no existe o viene raro.
    """
    if not isinstance(raw, dict):
        return {}

    out: Dict[str, Optional[float]] = {}
    has_any = False
    for key in _INGRESOS_KEYS:
        val = _safe_number(raw.get(key))
        out[key] = val
        if val is not None:
            has_any = True

    return out if has_any else {}


def _merge_ingresos_acumulados(
    current: Optional[Dict[str, Optional[float]]],
    new_vals: Optional[Dict[str, Optional[float]]],
) -> Optional[Dict[str, Optional[float]]]:
    """
    Para endpoints agregados por declarante:
    - Si current es None, se queda new_vals.
    - Si ambos tienen datos, se queda el que tenga mayor ingresoAnualNetoDeclarante,
      y si no hay ese campo, simplemente el que tenga más campos no nulos.
    """
    if not new_vals:
        return current
    if not current:
        return new_vals

    # Comparar por ingresoAnualNetoDeclarante
    a = current.get("ingresoAnualNetoDeclarante")
    b = new_vals.get("ingresoAnualNetoDeclarante")
    if a is None and b is not None:
        return new_vals
    if b is None and a is not None:
        return current
    if a is not None and b is not None:
        if b > a:
            return new_vals
        else:
            return current

    # Fallback: quien tenga más campos no nulos
    def non_null_count(d: Dict[str, Optional[float]]) -> int:
        return sum(1 for v in d.values() if v is not None)

    return new_vals if non_null_count(new_vals) > non_null_count(current) else current


# ───────────────────────── Route wrapper ─────────────────────────
class LoggingRoute(APIRoute):
    def get_route_handler(self):
        original_handler = super().get_route_handler()

        async def custom_handler(request: Request):
            if request.url.path.startswith("/timeline"):
                start = time.perf_counter()
                try:
                    response = await original_handler(request)
                    status = getattr(response, "status_code", "?")
                    elapsed_ms = (time.perf_counter() - start) * 1000
                    if DEBUG:
                        logger.info(
                            f"{BANNER} {request.method} {request.url.path} "
                            f"query={dict(request.query_params)} status={status} t={elapsed_ms:.1f}ms"
                        )
                    return response
                except Exception as e:
                    elapsed_ms = (time.perf_counter() - start) * 1000
                    logger.exception(
                        f"{BANNER} EXC {request.method} {request.url.path} "
                        f"query={dict(request.query_params)} t={elapsed_ms:.1f}ms"
                    )
                    raise
            else:
                return await original_handler(request)

        return custom_handler


# Router con route_class para logging
router = APIRouter(prefix="/timeline", tags=["timeline"], route_class=LoggingRoute)

# ───────────────────────── Endpoints ─────────────────────────
@router.get("/by-nombre")
def timeline_by_nombre(nombre: str = Query(..., description="Nombre exacto del declarante")):
    """
    Devuelve todos los contratos y el encargo del declarante
    incluyendo datos del puesto, institución y fechas clave.
    Además marca si el ente público del declarante coincide con
    la institución compradora (posible conflicto de interés).

    Ahora también incluye, si existen en el dataset, los ingresos declarados:
    - ingresos: { ... campos numéricos ... }
    """
    data = _load_data()
    nombre_lower = nombre.lower()
    resultados: List[Dict[str, Any]] = []

    for d in data:
        if (d.get("nombreDeclarante") or "").lower() == nombre_lower:
            c = d.get("contrato") or {}

            # ── Monto ─────────────────────────────
            monto = c.get("montoContrato", 0)
            try:
                monto = float(monto)
            except Exception:
                monto = 0.0

            # ── Normalizar nombres de entes para comparación ──
            ente_declarante = (d.get("nombreEntePublico") or "").strip()
            institucion_compradora = (c.get("institucionCompradora") or "").strip()

            mismo_ente = (
                ente_declarante.lower() != "" and
                ente_declarante.lower() == institucion_compradora.lower()
            )

            ingresos_norm = _normalize_ingresos_dict(d.get("ingresos", {}))

            resultados.append({
                # Identidad del declarante
                "nombreDeclarante": d.get("nombreDeclarante"),
                "correoInstitucional": d.get("correoInstitucional"),
                "institucionDeclarante": d.get("institucionDeclarante"),
                "nombreEntePublico": ente_declarante,
                "nivelOrdenGobierno": d.get("nivelOrdenGobierno"),
                "puesto": d.get("puesto"),
                "funcionPrincipal": d.get("funcionPrincipal"),

                # Empresa o relación privada
                "empresaRelacionada": d.get("empresaRelacionada"),
                "tipoParticipacion": d.get("tipoParticipacion"),
                "porcentajeParticipacion": d.get("porcentajeParticipacion"),
                "remuneracion": d.get("remuneracion"),
                "sector": (d.get("sectorS1") or {}).get("valor"),

                # Fechas clave (crudas del dataset)
                "fechaTomaPosesion": d.get("fechaTomaPosesion"),

                # Contrato público vinculado
                "fechaInicioContrato": c.get("fechaInicioContrato"),
                "fechaFinContrato": c.get("fechaFinContrato"),
                "montoContrato": monto,
                "descripcionContrato": c.get("descripcionContrato"),
                "institucionCompradora": institucion_compradora,

                # Posible conflicto de interés
                "mismoEnteDeclaranteComprador": mismo_ente,

                # Ingresos declarados (si existen)
                "ingresos": ingresos_norm,
            })

    # ───── Debug ruidoso (no altera la respuesta) ─────
    if DEBUG:
        tot = len(resultados)
        logger.info(f"{BANNER} /by-nombre nombre='{nombre}' → {tot} resultado(s)")

        toma_crudas = [r.get("fechaTomaPosesion") for r in resultados if r.get("fechaTomaPosesion")]
        ini_crudas  = [r.get("fechaInicioContrato") for r in resultados if r.get("fechaInicioContrato")]
        fin_crudas  = [r.get("fechaFinContrato") for r in resultados if r.get("fechaFinContrato")]

        toma_diag = [(s, *_try_parse_date(s)) for s in toma_crudas]
        ini_diag  = [(s, *_try_parse_date(s)) for s in ini_crudas]
        fin_diag  = [(s, *_try_parse_date(s)) for s in fin_crudas]

        def resumen(tag: str, diag: List[Tuple[str, bool, Optional[str], Optional[str]]]):
            oks  = [d for d in diag if d[1] is True]
            bads = [d for d in diag if d[1] is False]
            logger.info(f"{BANNER} {tag}: total={len(diag)} ok={len(oks)} bad={len(bads)}")
            if oks:
                logger.info(
                    f"{BANNER} {tag} OK (top 10) → "
                    + json.dumps(
                        _sample([{'raw': d[0], 'fmt': d[2], 'iso': d[3]} for d in oks], 10),
                        ensure_ascii=False,
                    )
                )
            if bads:
                logger.warning(
                    f"{BANNER} {tag} BAD (top 10) → "
                    + json.dumps(
                        _sample([{'raw': d[0]} for d in bads], 10),
                        ensure_ascii=False,
                    )
                )

        resumen("tomaPosesion", toma_diag)
        resumen("inicioContrato", ini_diag)
        resumen("finContrato",   fin_diag)

        preview = _sample(resultados, 5)
        logger.info(f"{BANNER} preview (top 5) → " + json.dumps(preview, ensure_ascii=False))

    return {"count": len(resultados), "contratos": resultados}


@router.get("/suggest")
def suggest(query: str = Query("", min_length=1, description="Texto parcial del nombre")):
    """
    Devuelve nombres de declarantes que:
    - Contienen el texto buscado
    - Tienen una fechaTomaPosesion no vacía
    """
    data = _load_data()
    q = query.lower()
    nombres = set()
    for d in data:
        n = d.get("nombreDeclarante") or ""
        fecha = d.get("fechaTomaPosesion")
        if not fecha:
            continue
        if q in n.lower():
            nombres.add(n)
        if len(nombres) >= 20:
            break

    items = sorted(nombres)

    if DEBUG:
        logger.info(f"{BANNER} /suggest query='{query}' → {len(items)} item(s)")
        logger.info(f"{BANNER} /suggest top10 → " + json.dumps(_sample(items, 10), ensure_ascii=False))

    return {"items": items}


@router.get("/declarantes-cruce-toma")
def declarantes_con_contratos_antes_y_despues(
    sort_by: str = Query(
        "monto",
        pattern="^(monto|contratos|nombre)$",
        description="Campo de ordenamiento: 'monto' (monto total), 'contratos' (número de contratos) o 'nombre'.",
    ),
    sort_dir: str = Query(
        "desc",
        pattern="^(asc|desc)$",
        description="Dirección de ordenamiento: 'asc' o 'desc'.",
    ),
):
    """
    Lista declarantes cuya fechaTomaPosesion está rodeada por contratos:
    - al menos un contrato completamente ANTES (fin < toma)
    - al menos un contrato completamente DESPUÉS (inicio > toma)

    Devuelve por declarante:
      - nombreDeclarante
      - fechaTomaPosesion
      - totalContratos
      - contratosAntes
      - contratosDespues
      - montoTotal (suma de montos de todos sus contratos)
      - ingresos (si hay alguno en el dataset para ese declarante)
    """
    data = _load_data()

    agregados: Dict[str, Dict[str, Any]] = {}

    for d in data:
        nombre = (d.get("nombreDeclarante") or "").strip()
        if not nombre:
            continue

        # Fecha de toma de posesión
        toma_raw = d.get("fechaTomaPosesion")
        toma_ts = _to_ts(toma_raw)
        if toma_ts is None:
            # Si no podemos parsear la fecha de toma, lo ignoramos
            continue

        # Ingresos normalizados de este registro (puede estar vacío)
        ingresos_norm = _normalize_ingresos_dict(d.get("ingresos", {}))

        # Inicializar registro agregado si no existe
        if nombre not in agregados:
            agregados[nombre] = {
                "nombreDeclarante": nombre,
                "fechaTomaPosesion": toma_raw,
                "toma_ts": toma_ts,
                "tiene_antes": False,
                "tiene_despues": False,
                "total_contratos": 0,
                "contratos_antes": 0,
                "contratos_despues": 0,
                "monto_total": 0.0,
                "ingresos": ingresos_norm if ingresos_norm else None,
            }
        else:
            # Intentar mejorar el resumen de ingresos si este registro trae algo
            if ingresos_norm:
                agregados[nombre]["ingresos"] = _merge_ingresos_acumulados(
                    agregados[nombre].get("ingresos"),
                    ingresos_norm,
                )

        reg = agregados[nombre]

        # Extraer contrato
        c = d.get("contrato") or {}
        ini_ts = _to_ts(c.get("fechaInicioContrato"))
        fin_ts = _to_ts(c.get("fechaFinContrato"))

        # Monto del contrato
        monto_raw = c.get("montoContrato")
        try:
            monto = float(monto_raw) if monto_raw not in (None, "", " ", "null") else 0.0
        except Exception:
            monto = 0.0

        # Si no hay fechas útiles, no sirve para lógica de antes/después,
        # pero sí para sumar monto y contar contrato
        tiene_fecha_util = (ini_ts is not None) or (fin_ts is not None)

        reg["total_contratos"] += 1
        reg["monto_total"] += monto

        if not tiene_fecha_util:
            continue

        # Lógica "antes" y "después"
        toma_ts = reg["toma_ts"]
        antes = False
        despues = False

        if ini_ts is not None and fin_ts is not None:
            # Contrato completamente antes de la toma
            if fin_ts < toma_ts:
                antes = True
                reg["contratos_antes"] += 1
            # Contrato completamente después de la toma
            if ini_ts > toma_ts:
                despues = True
                reg["contratos_despues"] += 1
        else:
            # Solo inicio
            if ini_ts is not None and ini_ts < toma_ts:
                antes = True
                reg["contratos_antes"] += 1
            if ini_ts is not None and ini_ts > toma_ts:
                despues = True
                reg["contratos_despues"] += 1

            # Solo fin
            if fin_ts is not None and fin_ts < toma_ts:
                antes = True
                reg["contratos_antes"] += 1
            if fin_ts is not None and fin_ts > toma_ts:
                despues = True
                reg["contratos_despues"] += 1

        if antes:
            reg["tiene_antes"] = True
        if despues:
            reg["tiene_despues"] = True

    # Filtrar solo quienes tienen contratos antes y después
    seleccionados = [
        {
            "nombreDeclarante": r["nombreDeclarante"],
            "fechaTomaPosesion": r["fechaTomaPosesion"],
            "totalContratos": r["total_contratos"],
            "contratosAntes": r["contratos_antes"],
            "contratosDespues": r["contratos_despues"],
            "montoTotal": r["monto_total"],
            "ingresos": r.get("ingresos") or {},
        }
        for r in agregados.values()
        if r["tiene_antes"] and r["tiene_despues"]
    ]

    # ───── Ordenamiento configurable ─────
    reverse = sort_dir == "desc"

    if sort_by == "nombre":
        seleccionados.sort(key=lambda r: r["nombreDeclarante"] or "", reverse=reverse)
    elif sort_by == "contratos":
        seleccionados.sort(key=lambda r: r["totalContratos"], reverse=reverse)
    else:  # "monto"
        seleccionados.sort(key=lambda r: r["montoTotal"], reverse=reverse)

    if DEBUG:
        logger.info(
            f"{BANNER} /declarantes-cruce-toma sort_by={sort_by} sort_dir={sort_dir} → {len(seleccionados)} declarante(s)"
        )
        logger.info(
            f"{BANNER} /declarantes-cruce-toma top10 → "
            + json.dumps(_sample(seleccionados, 10), ensure_ascii=False)
        )

    return {"count": len(seleccionados), "items": seleccionados}


@router.get("/declarantes")
def list_declarantes(
    with_toma: bool = Query(
        False,
        description="Si es true, solo incluye declarantes con fechaTomaPosesion no vacía",
    )
):
    """
    Lista de TODOS los nombres de declarantes (únicos).

    - Por defecto: incluye a todo declarante que tenga nombreDeclarante no vacío.
    - Si with_toma=true: solo incluye los que tienen fechaTomaPosesion.
    """
    data = _load_data()
    nombres = set()

    for d in data:
        n = (d.get("nombreDeclarante") or "").strip()
        if not n:
            continue

        if with_toma:
            fecha = d.get("fechaTomaPosesion")
            if not fecha:
                continue

        nombres.add(n)

    items = sorted(nombres)

    if DEBUG:
        logger.info(
            f"{BANNER} /declarantes with_toma={with_toma} → {len(items)} nombre(s)"
        )

    # El front acepta tanto {"items": [...]} como una lista directa.
    return {"items": items}


@router.get("/declarantes-conflicto")
def declarantes_conflicto(
    sort_by: str = Query(
        "monto",
        pattern="^(monto|contratos|nombre)$",
        description="Campo de ordenamiento: 'monto' (monto total), 'contratos' (número de contratos) o 'nombre'.",
    ),
    sort_dir: str = Query(
        "desc",
        pattern="^(asc|desc)$",
        description="Dirección de ordenamiento: 'asc' o 'desc'.",
    ),
):
    """
    Lista declarantes donde al menos un contrato tiene:
      nombreEntePublico == institucionCompradora  (case-insensitive)

    Devuelve por declarante:
      - nombreDeclarante
      - fechaTomaPosesion
      - totalContratos  (número de contratos EN CONFLICTO)
      - montoTotal      (suma de montos de contratos EN CONFLICTO)
      - enteCoincidente (nombre del ente público / institución)
      - ingresos        (si existen en el dataset para ese declarante)
    """
    data = _load_data()

    agregados: Dict[str, Dict[str, Any]] = {}

    for d in data:
        nombre = (d.get("nombreDeclarante") or "").strip()
        if not nombre:
            continue

        ente_declarante_raw = (d.get("nombreEntePublico") or "").strip()
        ente_declarante = ente_declarante_raw.lower()

        c = d.get("contrato") or {}
        inst_compradora_raw = (c.get("institucionCompradora") or "").strip()
        inst_compradora = inst_compradora_raw.lower()

        if not ente_declarante or not inst_compradora:
            continue

        # ¿Contrato en posible conflicto? (ente declarante == institución compradora)
        if ente_declarante != inst_compradora:
            continue

        # Monto del contrato
        monto_raw = c.get("montoContrato")
        try:
            monto = float(monto_raw) if monto_raw not in (None, "", " ", "null") else 0.0
        except Exception:
            monto = 0.0

        ingresos_norm = _normalize_ingresos_dict(d.get("ingresos", {}))

        if nombre not in agregados:
            agregados[nombre] = {
                "nombreDeclarante": nombre,
                "fechaTomaPosesion": d.get("fechaTomaPosesion"),
                "totalContratos": 0,
                "montoTotal": 0.0,
                "enteCoincidente": ente_declarante_raw or inst_compradora_raw,
                "ingresos": ingresos_norm if ingresos_norm else None,
            }
        else:
            if ingresos_norm:
                agregados[nombre]["ingresos"] = _merge_ingresos_acumulados(
                    agregados[nombre].get("ingresos"),
                    ingresos_norm,
                )

        reg = agregados[nombre]
        reg["totalContratos"] += 1
        reg["montoTotal"] += monto

    seleccionados = [
        {
            "nombreDeclarante": r["nombreDeclarante"],
            "fechaTomaPosesion": r["fechaTomaPosesion"],
            "totalContratos": r["totalContratos"],
            "montoTotal": r["montoTotal"],
            "enteCoincidente": r["enteCoincidente"],
            "ingresos": r.get("ingresos") or {},
        }
        for r in agregados.values()
    ]

    # ───── Ordenamiento ─────
    reverse = sort_dir == "desc"
    if sort_by == "nombre":
        seleccionados.sort(key=lambda r: r["nombreDeclarante"] or "", reverse=reverse)
    elif sort_by == "contratos":
        seleccionados.sort(key=lambda r: r["totalContratos"], reverse=reverse)
    else:  # "monto"
        seleccionados.sort(key=lambda r: r["montoTotal"], reverse=reverse)

    if DEBUG:
        logger.info(
            f"{BANNER} /declarantes-conflicto sort_by={sort_by} sort_dir={sort_dir} → {len(seleccionados)} declarante(s)"
        )
        logger.info(
            f"{BANNER} /declarantes-conflicto top10 → "
            + json.dumps(_sample(seleccionados, 10), ensure_ascii=False)
        )

    return {"count": len(seleccionados), "items": seleccionados}
