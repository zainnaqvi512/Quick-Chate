# Dependency audit checkpoint — 2026-10-07

This is a dependency advisory review, not a penetration test or production approval.

## Results

| Scope | Before compatible updates | After |
|---|---|---|
| Full dependency tree | Fresh local audit: 24 findings (16 high, 7 moderate, 1 low); earlier CI reported 25 | Local: 11 (5 high, 6 moderate). Latest CI: 12 (5 high, 7 moderate) |
| Production dependencies | Not separately measured before changes | Zero reported known vulnerabilities |

Counts are affected package entries, including parents affected through dependencies, not counts of independently exploitable defects. Registry advisories can change between runs. Audits used the official npm registry.

## Changes

Applied compatible updates through npm audit fix without force or dependency overrides. The lockfile records Vite 7.3.7, PostCSS 8.5.29, Rollup 4.64.0, Lodash 4.18.1 and updated Babel, glob parsers, YAML parsing, source-map and lint-tool dependencies. Removed unused ai and @ai-sdk/openai-compatible packages after checking source imports. No AI feature was implemented or depended on them.

Local validation passed: lint, application and integration-suite typechecks, 27 unit tests, production build and three built-server HTTP smoke checks. The large client-bundle warning remains. Both GitHub jobs passed with the updated dependencies, including the production audit gate and all 11 disposable MySQL scenarios: https://github.com/zainnaqvi512/Quick-Chate/actions/runs/37560622177 (code commit 8eaf41c653486b30c6760b40dec6030590ea6c52).

CI runs npm run security:production and fails on any reported production dependency vulnerability. npm audit still reports development findings; they are not suppressed by an allowlist or forced version override. The detailed paths below come from the local JSON report. CI's npm install summary counts one additional moderate entry; the exact difference has not been reconciled. Both environments report zero production findings.

## Remaining findings

| Path | Advisory / risk | Required follow-up |
|---|---|---|
| Tailwind 3 → chokidar / fast-glob / micromatch → braces | GHSA-vfj7-8cjw-p6xm: high-severity stack exhaustion from deeply nested patterns; five affected package entries | A patched braces version was not available in the reviewed range. npm proposes a Tailwind 4 migration. Migrate deliberately and verify generated CSS and browser layouts before adopting. |
| Tailwind 3 → postcss-nested / postcss-selector-parser | GHSA-rj75-hqrm-r3gf: moderate-severity CPU exhaustion; two affected package entries | Tailwind 4 migration or a supported compatible upstream dependency change. Do not force a parser major version without compatibility testing. |
| drizzle-kit → @esbuild-kit/esm-loader → core-utils → esbuild 0.18.20 | GHSA-67mh-4wv8-2f99: development-server cross-origin read; four affected package entries | npm proposes downgrading drizzle-kit to 0.18.1, which is not an acceptable automatic migration-tool fix. Assess a supported loader/tool upgrade while testing schema generation and migration execution. |

These packages are development dependencies. Production serves the built assets and Hono API; it does not invoke Tailwind or Drizzle Kit. The app does not accept user-supplied CSS, glob patterns or build source. That limits the identified paths in the deployed app but does not remove developer/CI exposure. Build only reviewed source in an isolated runner, do not expose development servers, and do not run build/migration tooling as part of request handling.

Source advisories:

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-rj75-hqrm-r3gf
- https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99

Reproduce with npm audit --json and npm run security:production. A zero advisory count would still not establish secure authentication, end-to-end encryption, browser privacy, call reliability or safe production migrations.
