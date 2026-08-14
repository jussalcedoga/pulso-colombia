# Contributing / Como Contribuir

Pulso Colombia welcomes focused issues and pull requests that improve emergency
coordination without overstating evidence or weakening user safety.

## Start Here

1. Read `README.md`, `docs/ARCHITECTURE.md`, and `docs/LAUNCH_CHECKLIST.md`.
2. Search existing issues before opening a new one.
3. For a substantial feature or model change, open an issue describing the
   user need, evidence source, privacy impact, and operational cost first.
4. Keep pull requests small enough to review and deploy independently.

## Local Validation

```bash
npm install
npm run db:migrate:local
npm run check
```

For API work, also run `npm run preview` and test against
`http://localhost:8787`.

## Non-Negotiable Boundaries

- Do not call the priority score measured damage, loss, casualty risk, or a
  structural assessment.
- Only `need` posts may influence response-priority calculations.
- Never store a submitted precise coordinate. Persist only the configured H3
  cell and its center.
- Keep public posts free of phone numbers, email addresses, and private chat
  content.
- Do not add unverified payment processing or label self-declared sponsors as
  verified organizations.
- Preserve complete Spanish and English coverage for every user-facing string
  and API error.
- Add tests for scoring, validation, authorization, privacy, or translation
  behavior that changes.

## Pull Requests

Describe:

- What user problem changes.
- How Spanish and English were verified.
- What tests were run.
- Any effect on scoring, location precision, data retention, abuse controls,
  Cloudflare quotas, or external data provenance.

## Espanol

Las contribuciones deben mantener los limites de evidencia, privacidad y
seguridad descritos arriba. Todo cambio visible necesita traduccion completa en
espanol e ingles. Los cambios al modelo de prioridad deben incluir justificacion
tecnica, pruebas y una explicacion clara de sus limites.
