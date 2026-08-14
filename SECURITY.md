# Security Policy / Politica De Seguridad

## Report A Vulnerability

Do not open a public issue for a vulnerability, exposed private message,
authentication bypass, precise-location leak, or credible abuse method.

Use GitHub's **Report a vulnerability** private reporting flow in this
repository. Include reproduction steps, affected endpoints, expected impact,
and the least sensitive proof needed to validate the report. Do not access,
alter, or retain another person's data while testing.

Maintainers should acknowledge a complete report within 72 hours during an
active deployment. Emergency data-exposure reports should be triaged before
feature work.

## Supported Version

Only the version currently deployed from the default branch receives security
updates during the MVP pilot.

## Scope

High-priority reports include:

- Access to another user's inbox or accepted chat.
- Session or recovery-code disclosure.
- Storage or public exposure of a precise submitted location.
- Bypass of authorization, same-origin checks, rate limits, or Turnstile.
- Stored script injection or unsafe external-link handling.
- A scoring manipulation that falsely changes emergency priority at scale.

## Espanol

No publiques una vulnerabilidad en un issue. Usa **Report a vulnerability** en
GitHub para reportar de forma privada accesos indebidos, filtraciones de
ubicacion, fallas de autenticacion o metodos creibles de abuso. No accedas ni
modifiques datos de otras personas durante una prueba.
