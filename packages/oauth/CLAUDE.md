# @wpi/oauth

OAuth token storage with AES-256-GCM encryption at rest.

## Trust boundary

- Only this package handles encryption keys and raw tokens
- Tokens are never logged
- Encryption key comes from `WPI_OAUTH_ENCRYPTION_KEY` env var (32 bytes, base64-encoded)
