# Security status

Not audited or production-certified. No E2EE; TLS is transport protection only.

Implemented: Zod validation, parameterized queries, salted scrypt, hashed sessions, membership/expiry predicates, production OTP disabled, media ownership/signatures, no-store responses, private disk storage and short-lived TURN credentials.

Eleven selected MySQL integration scenarios now pass; this is partial authorization/retention coverage, not an independent security audit. Open work: wider adversarial testing, HttpOnly sessions/CSRF, distributed abuse controls, email verification/recovery, complete relational integrity/account erasure, old media migration and independent review. Build success is not proof of security. Never log passwords, tokens, OTPs or content. Secrets belong only in ignored env files or provider secret stores.

Dependency audit checkpoint (2026-10-07): production dependencies have zero reported known vulnerabilities after compatible updates. The full audit reports 11 findings locally and 12 in CI, all outside the production dependency audit; see DEPENDENCY_SECURITY.md. CI blocks known vulnerabilities in production dependencies. That gate does not certify the build toolchain or detect flaws in our application code.
