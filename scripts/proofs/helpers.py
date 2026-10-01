"""Shared helpers for M0B proof scripts."""

import json
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCHEMAS_DIR = REPO_ROOT / "schemas"
CONFIG_DIR = REPO_ROOT / "config"
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def _build_registry() -> Registry:
    """Build a referencing.Registry from all schemas in schemas/."""
    resources = []
    for schema_file in sorted(SCHEMAS_DIR.glob("*.schema.json")):
        with open(schema_file) as f:
            doc = json.load(f)
        resource = Resource.from_contents(doc, default_specification=DRAFT202012)
        schema_id = doc.get("$id", schema_file.name)
        resources.append((schema_id, resource))
    return Registry().with_resources(resources)


REGISTRY = _build_registry()


def load_schema(name: str) -> dict:
    """Load a schema by filename (e.g. 'audit.schema.json')."""
    path = SCHEMAS_DIR / name
    with open(path) as f:
        return json.load(f)


def load_fixture(proof_dir: str, name: str) -> dict | list:
    """Load a JSON fixture from scripts/proofs/fixtures/<proof_dir>/<name>."""
    path = FIXTURES_DIR / proof_dir / name
    with open(path) as f:
        return json.load(f)


def load_config(name: str) -> dict:
    """Load a YAML config file from config/."""
    path = CONFIG_DIR / name
    with open(path) as f:
        return yaml.safe_load(f)


def validate(instance: dict, schema_name: str) -> list[str]:
    """Validate an instance against a schema. Return list of error messages (empty = valid)."""
    schema = load_schema(schema_name)
    validator = Draft202012Validator(schema, registry=REGISTRY)
    errors = []
    for error in sorted(validator.iter_errors(instance), key=lambda e: list(e.path)):
        path = ".".join(str(p) for p in error.absolute_path) or "(root)"
        errors.append(f"{path}: {error.message}")
    return errors


def assert_valid(instance: dict, schema_name: str, label: str = "") -> None:
    """Assert the instance validates. Print errors and exit 1 on failure."""
    errors = validate(instance, schema_name)
    if errors:
        prefix = f"{label}: " if label else ""
        print(f"FAIL: {prefix}{schema_name} validation failed with {len(errors)} error(s)")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)


def assert_invalid(instance: dict, schema_name: str, label: str = "") -> list[str]:
    """Assert the instance does NOT validate. Return the error messages."""
    errors = validate(instance, schema_name)
    if not errors:
        prefix = f"{label}: " if label else ""
        print(f"FAIL: {prefix}{schema_name} should have failed validation but passed")
        sys.exit(1)
    return errors


def money(amount: str, currency: str = "USD") -> dict:
    """Create a money object."""
    return {"amount": amount, "currency": currency}


def decimal_amount(m: dict) -> Decimal:
    """Extract the Decimal amount from a money object."""
    return Decimal(m["amount"])
