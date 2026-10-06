# Cost checkpoint — 2026-10-06

No zero-cost-forever guarantee. No paid services/plans/volumes were created.

| Component | Observed | Unresolved |
|---|---|---|
| GitHub | Existing public repository | Account usage not audited |
| Railway | Existing MySQL and 500 MB volume | Plan, credits, usage and spending limit unknown |
| Node hosting | Not provisioned | Verify allowance before adding service |
| Media | Private local disk implementation | Persistent production volume and quotas needed |
| SMS | Disabled in production | No SMS provider selected |
| Email delivery | Not implemented | Recovery/verification provider required |
| TURN | Optional and unconfigured | Relay provider, bandwidth budget and network tests |

Compute, database/storage, polling, transfer, media, TURN and email can cost money even when content expires. Account allowances are not confirmed; do not rely on trial credits as permanent free hosting.

## Published Railway pricing, checked 2026-10-06

Source: https://docs.railway.com/pricing/plans (official Railway documentation).

- Free plan: $0 subscription with $1 monthly resource credit.
- Hobby: $5/month, including $5 of resource usage; usage above that is charged.
- Container RAM: $10/GB-month; CPU: $20/vCPU-month; network egress: $0.05/GB; volume storage: $0.15/GB-month.
- Free per-service maximums include 0.5 GB RAM and 0.5 GB volume storage. Maximum capacity is not a promise that usage fits inside the monthly credit.

These published rates do not establish this account's plan, remaining credit, current usage or spending cap. A continuously running app plus MySQL, media and TURN cannot be promised at zero cost. Deployment remains blocked until account billing/limits and an acceptable resource budget are confirmed.
