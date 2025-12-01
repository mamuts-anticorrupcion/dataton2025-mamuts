#!/usr/bin/env python3
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------
# Helpers básicos
# ---------------------------------------------------------------------


def normalize_text(s: Optional[str]) -> str:
    if not isinstance(s, str):
        return ""
    # Mayúsculas, sin espacios dobles, strip
    return " ".join(s.strip().upper().split())


def normalize_name(nombre: str, ap1: str, ap2: str) -> str:
    parts = [normalize_text(nombre), normalize_text(ap1), normalize_text(ap2)]
    # Filtra vacíos
    parts = [p for p in parts if p]
    return " ".join(parts)


def get_nested(d: Dict[str, Any], path: List[str], default=None):
    cur: Any = d
    for key in path:
        if not isinstance(cur, dict):
            return default
        if key not in cur:
            return default
        cur = cur[key]
    return cur


def safe_number(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        v = value.strip()
        if not v:
            return None
        try:
            # Cambia coma por punto por si acaso
            v = v.replace(",", "")
            return float(v)
        except ValueError:
            return None
    return None


def merge_ingresos(existing: Dict[str, Any], new_vals: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mezcla ingresos: si new_vals trae campos no nulos, sobreescribe;
    si son nulos, mantiene lo que ya había.
    """
    result = existing.copy()
    for k, v in new_vals.items():
        if v is not None:
            result[k] = v
    return result


# ---------------------------------------------------------------------
# Extracción de ingresos desde una declaración S1
# ---------------------------------------------------------------------


def extract_ingresos_from_declaracion(dec: Dict[str, Any]) -> Dict[str, Optional[float]]:
    sit_pat = get_nested(dec, ["declaracion", "situacionPatrimonial"], {}) or {}

    ingresos = sit_pat.get("ingresos", {}) or {}

    out: Dict[str, Optional[float]] = {
        "remuneracionMensualCargoPublico": safe_number(
            get_nested(
                ingresos,
                ["remuneracionMensualCargoPublico", "valor"],
            )
        ),
        "remuneracionAnualCargoPublico": safe_number(
            get_nested(
                ingresos,
                ["remuneracionAnualCargoPublico", "valor"],
            )
        ),
        "ingresoMensualNetoDeclarante": safe_number(
            get_nested(
                ingresos,
                ["ingresoMensualNetoDeclarante", "valor"],
            )
        ),
        "ingresoAnualNetoDeclarante": safe_number(
            get_nested(
                ingresos,
                ["ingresoAnualNetoDeclarante", "valor"],
            )
        ),
        "totalIngresosMensualesNetos": safe_number(
            get_nested(
                ingresos,
                ["totalIngresosMensualesNetos", "valor"],
            )
        ),
        "totalIngresosAnualesNetos": safe_number(
            get_nested(
                ingresos,
                ["totalIngresosAnualesNetos", "valor"],
            )
        ),
        # Desglose por tipo de ingreso
        "actividadEmpresarial": safe_number(
            get_nested(
                ingresos,
                ["actividadIndustialComercialEmpresarial", "remuneracionTotal", "valor"],
            )
        ),
        "actividadFinanciera": safe_number(
            get_nested(
                ingresos,
                ["actividadFinanciera", "remuneracionTotal", "valor"],
            )
        ),
        "serviciosProfesionales": safe_number(
            get_nested(
                ingresos,
                ["serviciosProfesionales", "remuneracionTotal", "valor"],
            )
        ),
        "otrosIngresos": safe_number(
            get_nested(
                ingresos,
                ["otrosIngresos", "remuneracionTotal", "valor"],
            )
        ),
        "enajenacionBienes": safe_number(
            get_nested(
                ingresos,
                ["enajenacionBienes", "remuneracionTotal", "valor"],
            )
        ),
    }

    # Si todo salió None, devolvemos dict vacío para indicar "sin info útil"
    if all(v is None for v in out.values()):
        return {}
    return out


# ---------------------------------------------------------------------
# Carga dataset y creación de índice por (nombre, institución)
# ---------------------------------------------------------------------


def build_dataset_index(
    dataset: List[Dict[str, Any]]
) -> Tuple[Dict[Tuple[str, str], List[int]], List[Dict[str, Any]]]:
    """
    Devuelve:
      - índice: (nombre_normalizado, institucion_normalizada) -> lista de índices del dataset
      - dataset (sin modificar)
    """
    index: Dict[Tuple[str, str], List[int]] = {}

    for i, item in enumerate(dataset):
        nombre_decl = normalize_text(item.get("nombreDeclarante", ""))
        institucion = normalize_text(item.get("institucionDeclarante", ""))

        if not nombre_decl:
            continue

        key = (nombre_decl, institucion)
        index.setdefault(key, []).append(i)

    return index, dataset


# ---------------------------------------------------------------------
# Recorre todos los JSON en s1-declaraciones y enriquece
# ---------------------------------------------------------------------


def main():
    base_dir = Path(__file__).resolve().parent
    dataset_path = base_dir / "dataset.json"
    decls_root = base_dir / "s1-declaraciones"
    output_path = base_dir / "dataset_enriquecido_ingresos.json"

    if not dataset_path.exists():
        print(f"[ERROR] No se encontró dataset.json en {dataset_path}")
        return

    if not decls_root.exists():
        print(f"[ERROR] No se encontró carpeta s1-declaraciones en {decls_root}")
        return

    print(f"Usando dataset: {dataset_path}")
    print(f"Buscando declaraciones en: {decls_root}")

    # 1. Cargar dataset completo (asumimos tamaño razonable)
    with dataset_path.open("r", encoding="utf-8") as f:
        dataset = json.load(f)

    if not isinstance(dataset, list):
        print("[ERROR] dataset.json no es una lista JSON.")
        return

    index, dataset = build_dataset_index(dataset)
    print(f"Registros en dataset: {len(dataset)}")
    print(f"Claves únicas (nombre+institución): {len(index)}")

    # Para saber si ya habíamos puesto ingresos y de qué fecha
    # clave: índice del dataset -> fecha_actualizacion (str)
    mejores_fechas: Dict[int, str] = {}

    # 2. Listar todos los archivos JSON en s1-declaraciones (recursivo)
    all_files: List[Path] = []
    for root, _dirs, files in os.walk(decls_root):
        for name in files:
            if name.lower().endswith(".json"):
                all_files.append(Path(root) / name)

    total_files = len(all_files)
    if total_files == 0:
        print("[ADVERTENCIA] No se encontraron archivos .json en s1-declaraciones.")
        return

    print(f"Archivos de declaraciones encontrados: {total_files}")

    # 3. Procesar uno por uno (baja RAM) con barra de progreso ligera
    matched_count = 0
    updated_records = 0

    for idx_file, filepath in enumerate(all_files, start=1):
        # Barra de progreso sencilla
        progress = idx_file / total_files
        bar_width = 40
        filled = int(bar_width * progress)
        bar = "#" * filled + "-" * (bar_width - filled)
        print(
            f"\rProcesando archivos S1: [{bar}] {idx_file}/{total_files}",
            end="",
            flush=True,
        )

        try:
            with filepath.open("r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"\n[ERROR] Al leer {filepath}: {e}")
            continue

        # Cada archivo puede ser lista o un solo objeto
        if isinstance(data, dict):
            declaraciones = [data]
        elif isinstance(data, list):
            declaraciones = data
        else:
            continue

        for dec in declaraciones:
            # Extraer nombre + apellidos
            nombre = get_nested(
                dec,
                [
                    "declaracion",
                    "situacionPatrimonial",
                    "datosGenerales",
                    "nombre",
                ],
            )
            ap1 = get_nested(
                dec,
                [
                    "declaracion",
                    "situacionPatrimonial",
                    "datosGenerales",
                    "primerApellido",
                ],
            )
            ap2 = get_nested(
                dec,
                [
                    "declaracion",
                    "situacionPatrimonial",
                    "datosGenerales",
                    "segundoApellido",
                ],
            )

            full_name = normalize_name(nombre or "", ap1 or "", ap2 or "")
            if not full_name:
                continue

            institucion_dec = normalize_text(
                get_nested(dec, ["metadata", "institucion"], "")
            )

            key = (full_name, institucion_dec)

            if key not in index:
                # No hay coincidencia en dataset, lo ignoramos
                continue

            ingresos_vals = extract_ingresos_from_declaracion(dec)
            if not ingresos_vals:
                continue  # sin datos útiles

            fecha_act = get_nested(dec, ["metadata", "actualizacion"], "")
            fecha_act_str = str(fecha_act) if fecha_act is not None else ""

            for ds_idx in index[key]:
                matched_count += 1

                # Ver si ya teníamos una declaración para este registro
                prev_fecha = mejores_fechas.get(ds_idx)
                # Si no hay fecha previa, o ésta es más nueva, actualizamos
                if prev_fecha is None or (fecha_act_str and fecha_act_str > prev_fecha):
                    # Mezclamos con lo que ya tuviera el dataset
                    current_ingresos = dataset[ds_idx].get("ingresos", {}) or {}
                    if not isinstance(current_ingresos, dict):
                        current_ingresos = {}

                    new_ingresos = merge_ingresos(current_ingresos, ingresos_vals)
                    dataset[ds_idx]["ingresos"] = new_ingresos
                    mejores_fechas[ds_idx] = fecha_act_str
                    updated_records += 1

    print("\n\nProcesamiento terminado.")
    print(f"Coincidencias (declaración ↔ dataset): {matched_count}")
    print(f"Registros del dataset actualizados con ingresos: {len(mejores_fechas)}")

    # 4. Guardar dataset enriquecido
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Dataset enriquecido guardado en: {output_path}")


if __name__ == "__main__":
    main()
