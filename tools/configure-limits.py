"""Add one binding to freshly downloaded Pages settings without logging values."""
import copy
import json
from pathlib import Path
import sys
import tomllib

name = sys.argv[1]
if name not in ("production", "preview"):
    raise SystemExit("Expected production or preview")
source = Path("wrangler.toml")
config = tomllib.loads(source.read_text())
config["pages_build_output_dir"] = "./dist"
# Explicit environments need their own non-inheritable bindings and variables.
environment = copy.deepcopy({k: v for k, v in config.items()
                             if k not in ("name", "pages_build_output_dir", "env")})
environment.update(config.get("env", {}).get(name, {}))
bindings = environment.get("durable_objects", {}).get("bindings", [])
environment["durable_objects"] = {"bindings": [b for b in bindings if b["name"] != "RATE_LIMITS"] + [{
    "name": "RATE_LIMITS",
    "class_name": "VisitorLimit",
    "script_name": "website-limits-preview" if name == "preview" else "website-limits",
}]}
config.setdefault("env", {})[name] = environment
Path("wrangler.json").write_text(json.dumps(config, indent=2) + "\n")
source.unlink()
print(f"Prepared {name} rate-limit binding; existing Pages settings preserved.")
