from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote

import yaml

ROOT = Path(__file__).resolve().parents[1]
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head", "trace"}
EXPECTED_DIRS = {"customer", "driver", "operator", "shared", "system"}
ERROR_FILES = {
    "BadRequest", "Unauthorized", "Forbidden", "NotFound", "Conflict",
    "Gone", "UnprocessableEntity", "Locked", "TooManyRequests",
}


@lru_cache(maxsize=None)
def load(path: Path):
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def pointer_get(doc, pointer: str):
    cur = doc
    if pointer in ("", "/"):
        return cur
    for part in pointer.lstrip("/").split("/"):
        part = unquote(part).replace("~1", "/").replace("~0", "~")
        cur = cur[part]
    return cur


def resolve_ref(ref: str, base: Path):
    file_part, _, pointer = ref.partition("#")
    target = (base.parent / file_part).resolve() if file_part else base.resolve()
    return pointer_get(load(target), pointer), target


def resolve_node(node, base: Path):
    seen = set()
    while isinstance(node, dict) and set(node) == {"$ref"}:
        marker = (str(base.resolve()), node["$ref"])
        if marker in seen:
            raise ValueError(f"circular ref: {marker}")
        seen.add(marker)
        node, base = resolve_ref(node["$ref"], base)
    return node, base


def operations(doc, base: Path):
    result = {}
    for path, path_item in doc.get("paths", {}).items():
        path_item, item_base = resolve_node(path_item, base)
        for method, op in path_item.items():
            if method.lower() in HTTP_METHODS:
                result[(method.upper(), path)] = (op, item_base)
    return result


def walk_refs(node, base: Path, failures: list[str], trail="root"):
    if isinstance(node, dict):
        if "$ref" in node:
            try:
                resolved, target = resolve_ref(node["$ref"], base)
                walk_refs(resolved, target, failures, trail + "->$ref")
            except Exception as exc:
                failures.append(f"{trail}: {node['$ref']} ({exc})")
        for key, value in node.items():
            if key != "$ref":
                walk_refs(value, base, failures, trail + "/" + str(key))
    elif isinstance(node, list):
        for idx, value in enumerate(node):
            walk_refs(value, base, failures, f"{trail}/{idx}")


def contains_example(node):
    if isinstance(node, dict):
        return "example" in node or "examples" in node or any(contains_example(v) for v in node.values())
    if isinstance(node, list):
        return any(contains_example(v) for v in node)
    return False


def placeholder_examples(node, path=""):
    bad=[]
    if isinstance(node, dict):
        for k,v in node.items():
            p=f"{path}/{k}"
            if k in ("example","examples"):
                vals=[]
                def collect(x):
                    if isinstance(x,dict):
                        for y in x.values(): collect(y)
                    elif isinstance(x,list):
                        for y in x: collect(y)
                    else: vals.append(x)
                collect(v)
                if any(x in ("string", "", "abc", 0) for x in vals): bad.append(p)
            bad.extend(placeholder_examples(v,p))
    elif isinstance(node,list):
        for i,v in enumerate(node): bad.extend(placeholder_examples(v,f"{path}/{i}"))
    return bad


def parameter_names(op, base):
    names=set()
    for p in op.get("parameters",[]):
        p,_=resolve_node(p,base)
        names.add(p.get("name"))
    return names


def body_has_version(op, base):
    schema=op.get("requestBody",{}).get("content",{}).get("application/json",{}).get("schema")
    if not schema: return False
    schema,_=resolve_node(schema,base)
    return "version" in schema.get("properties",{}) and "version" in schema.get("required",[])


def report(label, errors):
    if errors:
        print(f"FAIL {label}")
        for error in errors: print(f"  - {error}")
        return False
    print(f"PASS {label}")
    return True


def main():
    ok=True
    manifest=load(ROOT/"_manifest.yaml")
    spec_path=ROOT/"openapi.yaml"; spec=load(spec_path)
    ops=operations(spec,spec_path)
    expected={(r["method"],r["path"]):r for r in manifest}

    errors=[]
    if len(ops)!=30: errors.append(f"found {len(ops)} operations, expected 30")
    if set(ops)!=set(expected): errors.append(f"method/path mismatch: missing={set(expected)-set(ops)}, extra={set(ops)-set(expected)}")
    for key,row in expected.items():
        if key in ops and ops[key][0].get("operationId")!=row["operation_id"]: errors.append(f"{row['api_id']}: operationId mismatch")
    ok &= report("30 paths/methods/operationId match manifest",errors)

    expected_files={ROOT/r["file"] for r in manifest}
    actual_files={p for d in EXPECTED_DIRS for p in (ROOT/d).glob("*.yaml")}
    errors=[]
    if len(expected_files)!=26: errors.append(f"manifest maps to {len(expected_files)} files")
    if expected_files!=actual_files: errors.append(f"missing={expected_files-actual_files}, extra={actual_files-expected_files}")
    ok &= report("exactly 26 mapped fragment files",errors)

    errors=[]
    for key,row in expected.items():
        op,_base=ops[key]
        for ext in ("x-api-id","x-uc","x-roles","x-idempotency"):
            if ext not in op: errors.append(f"{row['api_id']}: missing {ext}")
        if op.get("x-idempotency")!=row["idempotency"]: errors.append(f"{row['api_id']}: idempotency mismatch")
    ok &= report("trace extensions and idempotency match manifest",errors)

    errors=[]
    for key,row in expected.items():
        op,base=ops[key]; idem=row["idempotency"]
        if idem in ("key","key+version") and "Idempotency-Key" not in parameter_names(op,base): errors.append(f"{row['api_id']}: missing Idempotency-Key")
        if idem=="key+version" and not body_has_version(op,base): errors.append(f"{row['api_id']}: body version is not required")
    ok &= report("idempotency headers and versions",errors)

    errors=[]
    for key,row in expected.items():
        op,_=ops[key]; public=row["role"]==["Public"] or row["api_id"]=="API-23"
        wanted=[] if public else [{"bearerAuth":[]}]
        if op.get("security")!=wanted: errors.append(f"{row['api_id']}: security={op.get('security')}")
    ok &= report("security policy",errors)

    errors=[]
    for key,row in expected.items():
        op,base=ops[key]
        for status,response in op.get("responses",{}).items():
            if status.startswith("4"):
                if not (isinstance(response,dict) and set(response)=={"$ref"} and "_common/errors.yaml#/" in response["$ref"]): errors.append(f"{row['api_id']} {status}: error is not a shared response ref")
                else:
                    name=response["$ref"].rsplit("/",1)[-1]
                    if name not in ERROR_FILES: errors.append(f"{row['api_id']} {status}: unknown error component")
                if status=="429":
                    resolved,_=resolve_node(response,base)
                    if "Retry-After" not in resolved.get("headers",{}): errors.append(f"{row['api_id']}: 429 missing Retry-After")
    ok &= report("shared 4xx responses and Retry-After",errors)

    errors=[]
    for key,row in expected.items():
        op,_=ops[key]
        if not contains_example(op): errors.append(f"{row['api_id']}: no example")
        for p in placeholder_examples(op): errors.append(f"{row['api_id']}: placeholder at {p}")
    ok &= report("concrete examples",errors)

    common=load(ROOT/"_common/schemas.yaml")
    pseudo={"—"}
    needed={r[k] for r in manifest for k in ("request","response") if r[k] not in pseudo}
    ok &= report("manifest request/response schemas exist", sorted(needed-set(common)))

    failures=[]; walk_refs(spec,spec_path,failures)
    ok &= report("all $ref targets resolve",failures)
    print(f"Total operations: {len(ops)}/30")
    print(f"Total fragment files: {len(actual_files)}/26")
    return 0 if ok else 1


if __name__=="__main__":
    raise SystemExit(main())
