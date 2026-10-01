#!/usr/bin/env python3
"""Regression tests for scripts/check_config.py and scripts/check_schemas.py.

These tests verify fixes for governance toolchain bugs:
  - check_config.py must not crash (TypeError) when a rule has id: null
  - check_schemas.py must check required⊆properties even without "type": "object"

Run: python3 -m unittest discover -s scripts/tests -v
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRIPTS_DIR))

import check_config
import check_schemas


class TestCheckConfigNullRuleId(unittest.TestCase):
    """A rule with id: null must produce an error message, not a TypeError crash."""

    def setUp(self):
        self.orig_errors = check_config.errors[:]
        self.orig_checks_run = check_config.checks_run
        self.orig_config = check_config.CONFIG
        self.orig_root = check_config.ROOT
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        check_config.ROOT = self.root
        check_config.CONFIG = self.root / "config"
        check_config.errors = []
        check_config.checks_run = 0

    def tearDown(self):
        self.tmp.cleanup()
        check_config.errors = self.orig_errors
        check_config.checks_run = self.orig_checks_run
        check_config.CONFIG = self.orig_config
        check_config.ROOT = self.orig_root

    def _make_rule_file(self, category: str, rules: list[dict]) -> Path:
        rules_dir = self.root / "config" / "rules"
        rules_dir.mkdir(parents=True, exist_ok=True)
        path = rules_dir / f"{category.replace('_', '-')}.yaml"
        import yaml
        data = {
            "category": category,
            "category_weight": check_config.CATEGORIES.get(category, 0),
            "methodology_version": check_config.METHODOLOGY_VERSION,
            "rules": rules,
        }
        path.write_text(yaml.dump(data, default_flow_style=False), encoding="utf-8")
        return path

    def _make_docs(self) -> dict:
        docs = {}
        rules_dir = self.root / "config" / "rules"
        for path in sorted(rules_dir.glob("*.yaml")):
            import yaml
            docs[path] = yaml.safe_load(path.read_text(encoding="utf-8"))
        return docs

    def test_null_id_does_not_crash(self):
        """When a rule has id: null alongside valid rules, check_rules must not raise TypeError."""
        for cat in check_config.CATEGORIES:
            if cat == "crawlability":
                rules = [
                    {"id": "CRW-001", "title": "valid rule", "category": cat,
                     "importance_weight": 3, "scored": True, "evaluation": "deterministic",
                     "fidelity_label": "observed", "change": "unchanged",
                     "standards": {"pass": "p", "partial": "m", "fail": "f"},
                     "source_reference": ["spec"]},
                    {"id": None, "title": "bad rule"},
                ]
            else:
                rules = []
            self._make_rule_file(cat, rules)

        docs = self._make_docs()
        try:
            check_config.check_rules(docs, {})
        except TypeError as exc:
            self.fail(f"check_rules raised TypeError on null rule id: {exc}")

        error_text = "\n".join(check_config.errors)
        self.assertIn("invalid rule id", error_text)


class TestCheckConfigDecimalMessage(unittest.TestCase):
    """The Decimal comparison for budgets must match the error message."""

    def test_decimal_literal_matches_message(self):
        """The error message says '150.00' so the source must compare with Decimal('150.00')."""
        import inspect
        source = inspect.getsource(check_config.check_budgets)
        self.assertIn('Decimal("150.00")', source,
                       "check_budgets should compare with Decimal('150.00') to match its error message")


class TestCheckSchemasRequiredWithoutType(unittest.TestCase):
    """required⊆properties check must fire even when 'type' is not 'object'."""

    def test_required_without_type_is_caught(self):
        """A schema with required but no type:object must still report missing properties."""
        schema = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$id": "urn:wpi:schema:test-schema:1.0.0",
            "title": "TestSchema",
            "description": "Test",
            "x-version": "1.0.0",
            "x-migration": "none",
            "x-status": "draft",
            "required": ["foo", "bar"],
            "properties": {"foo": {"type": "string"}},
            "additionalProperties": False,
        }

        with tempfile.TemporaryDirectory() as tmp:
            schema_dir = Path(tmp) / "schemas"
            schema_dir.mkdir()
            path = schema_dir / "test-schema.schema.json"
            path.write_text(json.dumps(schema), encoding="utf-8")

            report = check_schemas.Report()
            check_schemas.lint_schema(path, schema, {}, {}, report)

            error_text = "\n".join(report.errors)
            self.assertIn("required names not in properties", error_text)


if __name__ == "__main__":
    unittest.main()
