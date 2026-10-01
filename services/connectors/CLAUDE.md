# services/connectors

**Split-trust boundary.** This is the only service that will hold write credentials (CMS, search console, etc.). No other service or agent may access write credentials.

## Rules

- Write credentials live only in connector implementations here, loaded from secrets at runtime.
- Every write operation requires a signed change ticket (`WPI_CHANGE_TICKET`).
- Connectors expose read and write interfaces separately; agents call only the read interface.
- No connector code may be imported by `services/crawler` or `services/agents`.
