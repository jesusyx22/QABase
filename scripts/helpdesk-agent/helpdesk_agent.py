#!/usr/bin/env python3
"""
Agente local de solo lectura para la Mesa de Ayuda.

- Inicia sesión en la web institucional.
- Recorre páginas de tickets con GET.
- Extrae tickets asignados y los envía a QABase por el túnel SSH.
- NUNCA crea, edita, cierra, asigna ni comenta tickets.

Modos:
  --discover   Inicia sesión, guarda el HTML local y muestra la estructura
               (formularios, tablas, cabeceras) sin valores sensibles.
  --sync       Extrae tickets y los envía a QABase.

La contraseña se lee de variables de entorno o de ~/.qabase/helpdesk.env
con permisos 0600. Nunca se imprime.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import stat
import sys
import unicodedata
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print(
        "Faltan dependencias. En Termux ejecuta:\n"
        "  pkg install python\n"
        "  pip install requests beautifulsoup4",
        file=sys.stderr,
    )
    raise SystemExit(1)


BASE_DIR = Path.home() / ".qabase"
ENV_FILE = BASE_DIR / "helpdesk.env"
DEFAULT_URL = "https://mesadeayuda.cajalosandes.pe/pages/UI.php"
REFERENCE_RE = re.compile(r"\bR-\d+\b", re.IGNORECASE)
DATE_ISO_RE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
DATE_DMY_RE = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b")

FIELD_ALIASES = {
    "reference": ["referencia", "ticket", "nro", "numero", "codigo", "id"],
    "subject": ["asunto", "titulo", "resumen", "requerimiento"],
    "description": ["descripcion", "detalle", "detalle del ticket"],
    "status": ["estado", "situacion", "status"],
    "analyst": ["analista", "asignado", "responsable", "agente"],
    "team": ["equipo", "grupo", "area"],
    "requester": ["solicitante", "reportado por", "usuario"],
    "organization": ["organizacion", "empresa", "cliente"],
    "reportedAt": [
        "fecha de reporte",
        "fecha reporte",
        "fecha",
        "creado",
        "fecha creacion",
    ],
}

SKIP_LINK_WORDS = (
    "logout",
    "salir",
    "cerrar sesion",
    "cerrar sesión",
    "delete",
    "eliminar",
    "crear",
    "nuevo",
    "new",
    "editar",
    "editar ticket",
)


def normalize(value: str) -> str:
    text = unicodedata.normalize("NFKD", value)
    text = "".join(character for character in text if not unicodedata.combining(character))
    return re.sub(r"\s+", " ", text.lower()).strip(" :*")


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    mode = path.stat().st_mode
    if mode & (stat.S_IRWXG | stat.S_IRWXO):
        print(
            f"Aviso: {path} tiene permisos amplios. Ejecuta: chmod 600 {path}",
            file=sys.stderr,
        )
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


class AgentError(RuntimeError):
    pass


def config() -> dict[str, str]:
    return {
        "url": os.environ.get("HELPDESK_URL", DEFAULT_URL),
        "user": os.environ.get("HELPDESK_USER", ""),
        "password": os.environ.get("HELPDESK_PASSWORD", ""),
        "assigned_to": os.environ.get("HELPDESK_ASSIGNED_TO", ""),
        "qabase_url": os.environ.get("QABASE_URL", "http://127.0.0.1:3000").rstrip("/"),
        "sync_token": os.environ.get("QABASE_SYNC_TOKEN", ""),
        "username_field": os.environ.get("HELPDESK_USERNAME_FIELD", ""),
        "password_field": os.environ.get("HELPDESK_PASSWORD_FIELD", ""),
        "tickets_url": os.environ.get("HELPDESK_TICKETS_URL", ""),
        "max_pages": os.environ.get("HELPDESK_MAX_PAGES", "5"),
    }


def looks_like_username_field(element: Any) -> bool:
    haystack = " ".join(
        str(element.get(attribute, ""))
        for attribute in ("name", "id", "placeholder", "autocomplete")
    )
    haystack = normalize(haystack)
    return any(
        token in haystack
        for token in ("user", "usuario", "login", "correo", "email", "rut", "account")
    )


def find_login_form(soup: BeautifulSoup) -> Any:
    for form in soup.find_all("form"):
        if form.find("input", {"type": "password"}):
            return form
    return None


def login(session: requests.Session, cfg: dict[str, str]) -> requests.Response:
    if not cfg["user"] or not cfg["password"]:
        raise AgentError(
            "Faltan HELPDESK_USER o HELPDESK_PASSWORD. Configúralos en "
            "~/.qabase/helpdesk.env (chmod 600)."
        )

    response = session.get(cfg["url"], timeout=25)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    form = find_login_form(soup)
    if form is None:
        raise AgentError(
            "No se encontró un formulario con contraseña. Ejecuta --discover y "
            "revisa si el login es JavaScript o si la URL cambió."
        )

    action = urljoin(response.url, form.get("action") or response.url)
    data: dict[str, str] = {}

    for field in form.find_all(["input", "select", "textarea"]):
        name = field.get("name")
        if not name:
            continue
        field_type = (field.get("type") or "text").lower()
        if field_type in ("submit", "button", "image", "reset"):
            continue
        if field_type == "password":
            data[name] = cfg["password"]
        elif cfg["username_field"] and name == cfg["username_field"]:
            data[name] = cfg["user"]
        elif cfg["password_field"] and name == cfg["password_field"]:
            data[name] = cfg["password"]
        elif looks_like_username_field(field):
            data[name] = cfg["user"]
        elif field_type in ("checkbox", "radio"):
            if field.has_attr("checked"):
                data[name] = field.get("value", "on")
        else:
            data[name] = field.get("value", "")

    if not any(value == cfg["user"] for value in data.values()):
        raise AgentError(
            "No se pudo identificar el campo de usuario. Ejecuta --discover y "
            "define HELPDESK_USERNAME_FIELD con el nombre exacto del campo."
        )

    result = session.post(action, data=data, timeout=25, allow_redirects=True)
    if result.status_code >= 400:
        raise AgentError(f"El login devolvió HTTP {result.status_code}.")
    if find_login_form(BeautifulSoup(result.text, "html.parser")) is not None:
        raise AgentError(
            "El login no avanzó: la página sigue mostrando el formulario. "
            "Revisa las credenciales o el flujo de autenticación."
        )
    return result


def candidate_ticket_urls(soup: BeautifulSoup, base_url: str, configured: str) -> list[str]:
    urls: list[str] = []
    if configured:
        urls.append(configured)

    urls.append(base_url)

    for anchor in soup.find_all("a", href=True):
        text = normalize(anchor.get_text(" ", strip=True))
        href = anchor["href"]
        lower = href.lower()
        if any(word in text or word in lower for word in SKIP_LINK_WORDS):
            continue
        if any(
            word in text or word in lower
            for word in ("ticket", "bandeja", "asignad", "incidencia", "requerimiento")
        ):
            absolute = urljoin(base_url, href)
            if absolute not in urls:
                urls.append(absolute)

    return urls[:6]


def map_headers(headers: list[str]) -> dict[str, int]:
    mapping: dict[str, int] = {}
    normalized = [normalize(header) for header in headers]

    for field, aliases in FIELD_ALIASES.items():
        for index, header in enumerate(normalized):
            if any(header == alias or alias in header for alias in aliases):
                mapping.setdefault(field, index)
                break

    return mapping


def normalize_date(value: str) -> str | None:
    match = DATE_ISO_RE.search(value)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

    match = DATE_DMY_RE.search(value)
    if match:
        day, month, year = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"

    return None


def row_cells(row: Any) -> list[Any]:
    return row.find_all(["td", "th"])


def extract_table_tickets(table: Any, assigned_to: str) -> list[dict[str, Any]]:
    header_cells = table.find_all("th")
    headers = [cell.get_text(" ", strip=True) for cell in header_cells]

    rows = table.find_all("tr")
    if not headers and rows:
        first_cells = row_cells(rows[0])
        if first_cells:
            headers = [cell.get_text(" ", strip=True) for cell in first_cells]
            rows = rows[1:]

    mapping = map_headers(headers)
    tickets: list[dict[str, Any]] = []

    for row in rows:
        cells = row_cells(row)
        if not cells:
            continue

        texts = [cell.get_text(" ", strip=True) for cell in cells]
        row_text = " | ".join(texts)
        reference_match = REFERENCE_RE.search(row_text)
        if not reference_match:
            for anchor in row.find_all("a", href=True):
                reference_match = REFERENCE_RE.search(anchor["href"])
                if reference_match:
                    break
        if not reference_match:
            continue

        def cell(field: str) -> str:
            index = mapping.get(field)
            if index is None or index >= len(texts):
                return ""
            return texts[index].strip()

        reference = reference_match.group(0).upper()
        analyst = cell("analyst")
        if assigned_to and analyst and normalize(assigned_to) not in normalize(analyst):
            continue

        subject = cell("subject")
        if not subject:
            for anchor in row.find_all("a"):
                link_text = anchor.get_text(" ", strip=True)
                if link_text and not REFERENCE_RE.search(link_text):
                    subject = link_text
                    break
        if not subject:
            subject = next(
                (text for text in texts if text and not REFERENCE_RE.search(text)),
                "",
            )

        description = cell("description") or None
        status = cell("status") or "desconocido"
        reported_at = normalize_date(cell("reportedAt") or row_text)

        if not subject:
            continue

        tickets.append(
            {
                "reference": reference,
                "subject": subject[:200],
                "status": status[:100],
                "description": description[:5000] if description else None,
                "requester": cell("requester") or None,
                "organization": cell("organization") or None,
                "team": cell("team") or None,
                "analyst": analyst or None,
                "reportedAt": reported_at,
            }
        )

    return tickets


def parse_tickets(html: str, assigned_to: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    best: list[dict[str, Any]] = []

    for table in tables:
        tickets = extract_table_tickets(table, assigned_to)
        if len(tickets) > len(best):
            best = tickets

    return best


def follow_next_page(soup: BeautifulSoup, base_url: str) -> str | None:
    for anchor in soup.find_all("a", href=True):
        text = normalize(anchor.get_text(" ", strip=True))
        if text in ("siguiente", "next", "›", "»", ">") or "siguiente" in text:
            return urljoin(base_url, anchor["href"])
    return None


def collect_tickets(
    session: requests.Session,
    cfg: dict[str, str],
    start_response: requests.Response,
) -> list[dict[str, Any]]:
    soup = BeautifulSoup(start_response.text, "html.parser")
    candidates = candidate_ticket_urls(soup, start_response.url, cfg["tickets_url"])
    all_tickets: list[dict[str, Any]] = []
    seen_references: set[str] = set()
    max_pages = max(1, int(cfg["max_pages"]))

    for candidate in candidates:
        try:
            response = session.get(candidate, timeout=25)
            response.raise_for_status()
        except requests.RequestException:
            continue

        for _ in range(max_pages):
            tickets = parse_tickets(response.text, cfg["assigned_to"])
            for ticket in tickets:
                if ticket["reference"] not in seen_references:
                    seen_references.add(ticket["reference"])
                    all_tickets.append(ticket)

            page_soup = BeautifulSoup(response.text, "html.parser")
            next_url = follow_next_page(page_soup, response.url)
            if not next_url:
                break
            response = session.get(next_url, timeout=25)
            response.raise_for_status()

        if all_tickets:
            break

    return all_tickets


def discover(session: requests.Session, cfg: dict[str, str], response: requests.Response) -> None:
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    dump_path = BASE_DIR / "helpdesk-dump.html"
    dump_path.write_text(response.text, encoding="utf-8")
    dump_path.chmod(0o600)

    soup = BeautifulSoup(response.text, "html.parser")
    print(f"HTML guardado en {dump_path} (0600). No lo compartas sin revisarlo.")
    print(f"URL final: {response.url}")
    print(f"Título: {soup.title.get_text(strip=True) if soup.title else '(sin título)'}")

    print("\nFormularios de la página final:")
    for index, form in enumerate(soup.find_all("form"), start=1):
        action = form.get("action") or "(misma URL)"
        method = (form.get("method") or "get").upper()
        print(f"  Formulario {index}: {method} {action}")
        for field in form.find_all(["input", "select", "textarea"]):
            print(
                "    - "
                f"name={field.get('name')!r} "
                f"type={(field.get('type') or field.name)!r}"
            )

    print("\nTablas detectadas:")
    for index, table in enumerate(soup.find_all("table"), start=1):
        headers = [
            cell.get_text(" ", strip=True)
            for cell in table.find_all("th")
        ]
        rows = table.find_all("tr")
        print(f"  Tabla {index}: {len(rows)} filas, cabeceras={headers[:12]}")

    print("\nEnlaces candidatos:")
    for url in candidate_ticket_urls(soup, response.url, cfg["tickets_url"]):
        print(f"  - {url}")

    print(
        "\nSiguiente paso: revisa las cabeceras y comparte solo la estructura "
        "(sin datos personales ni cookies) para ajustar los selectores."
    )


def sync(session: requests.Session, cfg: dict[str, str], response: requests.Response) -> None:
    if not cfg["sync_token"]:
        raise AgentError(
            "Falta QABASE_SYNC_TOKEN. Léelo en el VPS con "
            "`cat data/sync-token` y guárdalo en ~/.qabase/helpdesk.env."
        )
    if not cfg["assigned_to"]:
        raise AgentError(
            "Define HELPDESK_ASSIGNED_TO con tu nombre de analista para no "
            "ingerir tickets de otras personas."
        )

    tickets = collect_tickets(session, cfg, response)
    if not tickets:
        raise AgentError(
            "No se encontraron tickets. Ejecuta --discover y revisa la tabla "
            "o define HELPDESK_TICKETS_URL."
        )

    print(f"Tickets extraídos: {len(tickets)}")
    result = requests.post(
        f"{cfg['qabase_url']}/api/helpdesk/ingest",
        json={"tickets": tickets},
        headers={"X-Sync-Token": cfg["sync_token"]},
        timeout=30,
    )
    if result.status_code >= 400:
        raise AgentError(
            f"QABase rechazó la ingesta: HTTP {result.status_code} {result.text[:300]}"
        )
    print(json.dumps(result.json(), ensure_ascii=False, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description="Agente local de Mesa de Ayuda")
    parser.add_argument("--discover", action="store_true", help="Inspecciona la estructura")
    parser.add_argument("--sync", action="store_true", help="Extrae y envía tickets")
    args = parser.parse_args()

    if args.discover == args.sync:
        parser.error("Usa exactamente uno de --discover o --sync")

    load_env_file(ENV_FILE)
    cfg = config()
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Linux; Android 14; Termux) "
                "AppleWebKit/537.36 Chrome/140 Safari/537.36"
            )
        }
    )

    try:
        response = login(session, cfg)
        if args.discover:
            discover(session, cfg, response)
        else:
            sync(session, cfg, response)
    except requests.RequestException as error:
        print(f"Error de red: {error}", file=sys.stderr)
        return 1
    except AgentError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
