# packages/config-loaders

Runtime YAML loaders for `config/*.yaml`. Loaders are M0B.

## Rules

- Loaders validate against the JSON Schemas in `schemas/` at load time.
- No loader may mutate the config files.
- Cache loaded config; do not re-read YAML on every call.
