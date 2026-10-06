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

Compute, database/storage, polling, transfer, media, TURN and email can cost money even when content expires. No numerical free allowances are asserted because this account's pricing and usage were not verified. Confirm current official pricing and account limits before provisioning; do not rely on trial credits as permanent free hosting.
