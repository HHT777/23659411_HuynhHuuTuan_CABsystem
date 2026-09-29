from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "microservice.md"
SRS = ROOT / "SRS.md"
RUBRIC = ROOT / "phieucham.md"
MANIFEST = ROOT / "api_document" / "_manifest.yaml"


def section(text: str, start: str, end: str | None = None) -> str:
    pos = text.index(start)
    tail = text[pos:]
    if end:
        stop = tail.index(end)
        return tail[:stop]
    return tail


def table_block(text: str, header: str) -> str:
    tail = section(text, header)
    return tail.split("\n\n", 1)[0]


def expand_numeric(block: str, prefix: str) -> list[int]:
    values=[]
    for start,end in re.findall(rf"{re.escape(prefix)}-(\d+)(?:[–-](\d+))?", block):
        a=int(start); b=int(end) if end else a
        values.extend(range(a,b+1))
    return values


def report(label: str, errors: list[str]) -> bool:
    if errors:
        print(f"FAIL {label}")
        for error in errors: print(f"  - {error}")
        return False
    print(f"PASS {label}")
    return True


def exact_once(label: str, actual: list, expected: set) -> tuple[bool,list[str]]:
    counts=Counter(actual); errors=[]
    missing=expected-set(counts); extra=set(counts)-expected
    dupes={x:n for x,n in counts.items() if n!=1}
    if missing: errors.append(f"missing: {sorted(missing)}")
    if extra: errors.append(f"extra: {sorted(extra)}")
    if dupes: errors.append(f"not exactly once: {dupes}")
    return not errors,errors


def event_names(text: str) -> set[str]:
    return set(re.findall(r"`([A-Z][A-Za-z]+\.v1)`", text))


def main() -> int:
    doc=DOC.read_text(encoding="utf-8")
    srs=SRS.read_text(encoding="utf-8")
    rubric=RUBRIC.read_text(encoding="utf-8")
    ok=True

    bc_heads=re.findall(r"^### BC-(\d{2}) —",doc,re.M)
    ok &= report("5 bounded contexts", [] if bc_heads==["01","02","03","04","05"] else [str(bc_heads)])
    steps=re.findall(r"^#### Bước ([1-6])\.",doc,re.M)
    expected_steps=[str(n) for _bc in range(5) for n in range(1,7)]
    ok &= report("each BC has Steps 1-6", [] if steps==expected_steps else [f"found {steps}"])

    ent_actual=[]; forbidden=[]
    for bc in range(1,6):
        start=f"### BC-{bc:02d} —"
        end=f"### BC-{bc+1:02d} —" if bc<5 else "## Phần III."
        bc_text=section(doc,start,end)
        logic=section(bc_text,"#### Bước 4.","#### Bước 5.")
        entity_table=logic.split("| Field |",1)[0]
        ent_actual.extend(int(x) for x in re.findall(r"ENT-(\d{2})",entity_table))
        hits=re.findall(r"\b(PostgreSQL|MongoDB|Redis|table|collection|index)\b",logic,re.I)
        if hits: forbidden.append(f"BC-{bc:02d}: {hits}")
    _,errors=exact_once("ENT",ent_actual,set(range(1,29)))
    ok &= report("28 ENT owned exactly once in Step 4",errors)
    ok &= report("Step 4 is technology independent",forbidden)

    grouped_fields=[]
    for bc in range(1,6):
        start=f"### BC-{bc:02d} —"
        end=f"### BC-{bc+1:02d} —" if bc<5 else "## Phần III."
        logic=section(section(doc,start,end),"#### Bước 4.","#### Bước 5.")
        for field in re.findall(r"^\| ([A-Za-z][A-Za-z0-9.]+(?:\s*/\s*[^|]+)?) \|",logic,re.M):
            if "/" in field: grouped_fields.append(f"BC-{bc:02d}: {field}")
    ok &= report("one logical field per Step 4 row",grouped_fields)

    route_block=section(doc,"### 0.3.","### 0.4.")
    route_rows=re.findall(
        r"^\| (GET|POST|PUT|PATCH|DELETE) \| `([^`]+)` \((API-(?:X\d{2}|\d{2}))\) \| ([^|]+) \| ([^|]+) \|$",
        route_block,re.M
    )
    route_ids=[row[2] for row in route_rows]
    expected_routes={f"API-{n:02d}" for n in range(1,31)} | {f"API-X{n:02d}" for n in range(1,13)}
    _,errors=exact_once("gateway route",route_ids,expected_routes)
    if len(route_rows)!=42: errors.append(f"route rows={len(route_rows)}, expected 42")
    ok &= report("42 gateway routes listed exactly once",errors)

    route_by_id={api_id:(method,path.removeprefix("/api/v1"),auth.strip())
                 for method,path,api_id,_service,auth in route_rows}
    manifest=yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    role_tokens=("Public","Authenticated","CUSTOMER","DRIVER","OPERATOR","ADMIN","EXECUTIVE","Mock Provider")
    manifest_errors=[]
    for item in manifest:
        actual=route_by_id.get(item["api_id"])
        if not actual:
            manifest_errors.append(f'{item["api_id"]} missing route')
            continue
        method,path,auth=actual
        actual_roles={role for role in role_tokens if re.search(rf"(?<![A-Za-z]){re.escape(role)}(?![A-Za-z])",auth)}
        expected_roles=set(item["role"])
        if (method,path,actual_roles)!=(item["method"],item["path"],expected_roles):
            manifest_errors.append(
                f'{item["api_id"]}: route={(method,path,sorted(actual_roles))}, '
                f'manifest={(item["method"],item["path"],sorted(expected_roles))}'
            )
    ok &= report("baseline gateway method/path/role match manifest",manifest_errors)

    event_block=section(doc,"### III.2.","### III.3.")
    contract_rows=re.findall(
        r"^\| `([A-Z][A-Za-z]+\.v1)` \| ([^|]+) \| ([^|]+) \|",
        event_block,re.M
    )
    produced={f"BC-{n:02d}":set() for n in range(1,6)}
    consumed={f"BC-{n:02d}":set() for n in range(1,6)}
    event_queue_pairs=[]
    for event,producer,consumers in contract_rows:
        if producer.strip()=="BC-01–05":
            for bc in produced: produced[bc].add(event)
        else:
            for bc in re.findall(r"BC-\d{2}",producer): produced[bc].add(event)
        for bc,queue in re.findall(r"(BC-\d{2}) → `([^`]+)`",consumers):
            consumed[bc].add(event)
            event_queue_pairs.append((event,queue))

    event_errors=[]
    for n in range(1,6):
        bc=f"BC-{n:02d}"
        start=f"### {bc} —"
        end=f"### BC-{n+1:02d} —" if n<5 else "## Phần III."
        bc_text=section(doc,start,end)
        emitted_match=re.search(r"^- Phát:(.+)$",bc_text,re.M)
        consumed_match=re.search(r"^- Tiêu thụ:(.+)$",bc_text,re.M)
        actual_emitted=event_names(emitted_match.group(1)) if emitted_match else set()
        actual_consumed=event_names(consumed_match.group(1)) if consumed_match else set()
        if actual_emitted!=produced[bc]:
            event_errors.append(f"{bc} emitted actual={sorted(actual_emitted)} contract={sorted(produced[bc])}")
        if actual_consumed!=consumed[bc]:
            event_errors.append(f"{bc} consumed actual={sorted(actual_consumed)} contract={sorted(consumed[bc])}")
    ok &= report("BC emitted/consumed events match III.2",event_errors)

    queue_block=section(doc,"### 0.7.","## Phần II.")
    queue_events={}
    for line in queue_block.splitlines():
        match=re.match(r"^\| `cab\.(?:domain|audit)` / `([^`]+)` \|[^|]+\|[^|]+\| ([^|]+) \|",line)
        if match: queue_events[match.group(1)]=event_names(match.group(2))
    pair_errors=[f"{event} → {queue}" for event,queue in event_queue_pairs
                 if event not in queue_events.get(queue,set())]
    ok &= report("every event-consumer pair has a broker queue",pair_errors)

    trace=section(doc,"### III.4.","## Phần IV.")
    fr=expand_numeric(table_block(trace,"| BC | FR sở hữu |"),"FR")
    dec=expand_numeric(table_block(trace,"| BC | DEC sở hữu |"),"DEC")
    api=expand_numeric(table_block(trace,"| BC | API baseline sở hữu |"),"API")
    _,errors=exact_once("FR",fr,set(range(1,57))); ok &= report("56 FR owned exactly once",errors)
    _,errors=exact_once("DEC",dec,set(range(1,39))); ok &= report("38 DEC owned exactly once",errors)
    _,errors=exact_once("API",api,set(range(1,31))); ok &= report("30 baseline API owned exactly once",errors)

    expected_uc=set(re.findall(r"^\|\s*(UC-[0-9]+(?:\.[0-9]+)?)\s*\|",srs,re.M))
    uc_block=table_block(trace,"| BC | UC sở hữu |")
    actual_uc=re.findall(r"UC-[0-9]+(?:\.[0-9]+)?",uc_block)
    _,errors=exact_once("UC",actual_uc,expected_uc)
    ok &= report(f"{len(expected_uc)} UC owned exactly once",errors)

    rubric_expected={int(x) for x in re.findall(r"^\|\s*(\d{1,2})\s*\|",rubric,re.M)}
    matrix=section(doc,"## Phần VI.","## Phần VII.")
    matrix_rows=re.findall(r"^\|\s*(\d{1,2})\s*\|(.+)$",matrix,re.M)
    matrix_ids=[int(row[0]) for row in matrix_rows]
    _,errors=exact_once("rubric",matrix_ids,rubric_expected)
    ok &= report("30 rubric rows exactly once",errors)
    method_errors=[f"#{num} missing method/path example" for num,row in matrix_rows if not re.search(r"\b(GET|POST|PUT|PATCH|DELETE)\b",row)]
    ok &= report("each rubric row has an HTTP/Postman example",method_errors)

    api_x_block=section(doc,"### VIII.2.","### VIII.3.")
    api_x=[int(x) for x in re.findall(r"API-X(\d{2})",api_x_block)]
    _,errors=exact_once("API-X",api_x,set(range(1,13)))
    ok &= report("12 supplementary APIs listed exactly once",errors)

    ul_headers=len(re.findall(r"^\| Thuật ngữ \| Định nghĩa \| Ghi chú/Ví dụ \|$",doc,re.M))
    ok &= report("one 3-column UL table per BC",[] if ul_headers==5 else [f"found {ul_headers}"])

    structural=[]
    for token in ("GET /health","GET /ready","GET /health/services",".gitignore",".env.example","Idempotency-Key","429","bán kính 1 km"):
        if token not in doc: structural.append(f"missing {token}")
    compose_block=section(doc,"```yaml\nservices:").split("\n```",1)[0]
    compose=compose_block.removeprefix("```yaml\n")
    if compose.count("ports:")!=1: structural.append(f"compose ports declarations={compose.count('ports:')}, expected 1")
    containers=re.findall(r"^\| `([^`]+)` \|",table_block(doc,"| Container | Image/build |"),re.M)
    if len(containers)!=8: structural.append(f"container rows={len(containers)}, expected 8")
    compose_data=yaml.safe_load(compose)
    if len(compose_data.get("services",{}))!=8: structural.append("compose must define exactly 8 services")
    compose_vars=set(re.findall(r"\$\{([A-Z][A-Z0-9_]*)\}",compose))
    env_doc=section(doc,"### 0.2.","### 0.3.")
    documented_vars=set(re.findall(r"`([A-Z][A-Z0-9_]*)`",env_doc))
    missing_env=compose_vars-documented_vars
    if missing_env: structural.append(f"compose substitutions absent from .env.example: {sorted(missing_env)}")
    required_service_env={
        "api-gateway":{"JWT_PUBLIC_KEY_PATH","INTERNAL_SERVICE_TOKEN"},
        "identity-driver-service":{"JWT_PRIVATE_KEY_PATH","JWT_PUBLIC_KEY_PATH","FIELD_ENCRYPTION_KEY","INTERNAL_SERVICE_TOKEN"},
        "ride-service":{"JWT_PUBLIC_KEY_PATH","FIELD_ENCRYPTION_KEY","INTERNAL_SERVICE_TOKEN"},
        "billing-service":{"JWT_PUBLIC_KEY_PATH","PAYMENT_CALLBACK_SECRET","INTERNAL_SERVICE_TOKEN"},
        "notification-service":{"JWT_PUBLIC_KEY_PATH","INTERNAL_SERVICE_TOKEN"},
        "operations-reporting-service":{"JWT_PUBLIC_KEY_PATH","FIELD_ENCRYPTION_KEY","INTERNAL_SERVICE_TOKEN"},
    }
    for service,required in required_service_env.items():
        actual=set(compose_data["services"][service].get("environment",{}))
        if required-actual: structural.append(f"{service} missing env {sorted(required-actual)}")
    for token in (
        "CREATE UNIQUE INDEX uq_searching_ride_request_customer",
        "CREATE TABLE active_trip_projections",
        "CREATE TABLE processed_events",
        "transaction_timestamp() < expires_at",
        "R->>B: POST internal fare-estimates",
        "R -->|RideAssigned; TripStatusChanged| ID",
        "ID -->|DriverApplicationDecided| N",
        "gatewayBaseUrl=http://localhost:8080",
        "apiBaseUrl={{gatewayBaseUrl}}/api/v1",
    ):
        if token not in doc: structural.append(f"missing {token}")
    if "N -->|delivery metrics| O" in doc: structural.append("stale Notification delivery-metrics context-map edge")
    ok &= report("infrastructure acceptance markers",structural)

    placeholders=[]
    for pattern in (r"\bTBD\b",r"\.\.\.",r"cite[^\s|]*",r"turn\d+[^\s|]*view"):
        if re.search(pattern,doc,re.I): placeholders.append(pattern)
    ok &= report("no placeholders or generated citation markers",placeholders)

    print(f"Total BC/services/databases: 5/5/5")
    print(f"Total entities: {len(set(ent_actual))}/28")
    print(f"Total FR/UC/DEC/API: {len(set(fr))}/56, {len(set(actual_uc))}/{len(expected_uc)}, {len(set(dec))}/38, {len(set(api))}/30")
    print(f"Total rubric rows: {len(set(matrix_ids))}/30")
    print(f"Supplementary APIs: {len(set(api_x))}/12")
    return 0 if ok else 1


if __name__=="__main__":
    raise SystemExit(main())
