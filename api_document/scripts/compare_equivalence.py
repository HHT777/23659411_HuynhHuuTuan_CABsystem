from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import yaml

from validate_openapi import operations, resolve_node

ROOT=Path(__file__).resolve().parents[1]

def load(path):
    with Path(path).open(encoding="utf-8") as f: return yaml.safe_load(f)

def normalized(path):
    path=Path(path); doc=load(path); out={}
    for key,(op,base) in operations(doc,path).items():
        params=[]
        for p in op.get("parameters",[]):
            p,_=resolve_node(p,base); params.append((p.get("name"),p.get("in"),p.get("required",False)))
        responses=[]
        for status,r in op.get("responses",{}).items():
            r,_=resolve_node(r,base); responses.append((status,r.get("description"),tuple(sorted(r.get("headers",{})))))
        out[key]={"operationId":op.get("operationId"),"parameters":sorted(params),"security":op.get("security"),"responses":sorted(responses)}
    schemas=set(doc.get("components",{}).get("schemas",{}))
    return out,schemas

def main():
    mono=Path(tempfile.gettempdir())/"openapi.monolith.yaml"
    candidate=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/"openapi.yaml"
    if not mono.exists():
        print(f"FAIL monolith snapshot missing: {mono}"); return 1
    a,sa=normalized(mono); b,sb=normalized(candidate)
    errors=[]
    if a!=b:
        for key in sorted(set(a)|set(b)):
            if a.get(key)!=b.get(key): errors.append(f"operation differs: {key}")
    if sa!=sb: errors.append(f"schema names differ: missing={sa-sb}, extra={sb-sa}")
    if errors:
        print("FAIL equivalence vs monolith")
        for e in errors: print("  -",e)
        return 1
    print("PASS equivalence vs monolith")
    print(f"Operations compared: {len(a)}")
    print(f"Schema names compared: {len(sa)}")
    return 0

if __name__=="__main__": raise SystemExit(main())
