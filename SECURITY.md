# Security status

Not audited or production-certified. No E2EE; TLS is transport protection only.

Implemented: Zod validation, parameterized queries, salted scrypt, hashed sessions, membership/expiry predicates, production OTP disabled, media ownership/signatures, no-store responses, private disk storage and short-lived TURN credentials.

Open work: adversarial real-DB tests, HttpOnly sessions/CSRF, distributed abuse controls, email verification/recovery, complete relational integrity/account erasure, old media migration and independent review. Build success is not proof of security. Never log passwords, tokens, OTPs or content. Secrets belong only in ignored env files or provider secret stores.
