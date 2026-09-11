# Aman Verified CLI (v0.1.0)

**One file. Zero dependencies. Fully offline. Node ≥ 18.**

Produce an **Aman Evidence Bundle (AEF-1)** for any package, API, or service — a single canonical
JSON anyone can re-verify independently in seconds. Spec: [SPEC.md](./SPEC.md).

The CLI, spec, and live bundles are also hosted on the platform at `https://amanchain.ma/aman-verified/`
(the Aman Verified tab in the app).

## Why

In agentic payments (x402), buyers are machines. Machines don't trust marketing — they verify.
An AEF-1 bundle lets **anyone — buyer, auditor, or competitor — re-derive every digest and check
offline, with no network call and no trust in the publisher**. The bundle anchor
(`bundle_sha256`) makes any later tampering detectable, byte-by-byte.

## Quick start (package producer)

```bash
node aman-verified.mjs bundle \
  --root ./my-package \
  --name "my-api v1.2.0" \
  --kind x402-api \
  --tier SELF \
  --out aman.evidence.json
```

Ship `aman.evidence.json` with your release. That's tier **SELF**.

## Independent attestation (tier AMAN-1)

An independent verifier re-derives everything offline and re-issues the bundle:

```bash
node aman-verified.mjs bundle \
  --root ./my-package \
  --name "my-api v1.2.0" \
  --manifest ./my-package/SHA256SUMS.txt \
  --tier AMAN-1 \
  --check "amount-pinned=50000:50000:cap enforced" \
  --negtest "missing-field=BLOCKED:BLOCKED" \
  --out attested.aman.evidence.json
```

Then anyone can audit the audit:

```bash
node aman-verified.mjs check attested.aman.evidence.json              # anchor valid?
node aman-verified.mjs reverify attested.aman.evidence.json --root ./my-package   # re-hash all
node aman-verified.mjs badge attested.aman.evidence.json --out aman.badge.json --svg aman.badge.svg
```

## CI integration (GitHub Actions example)

```yaml
- name: Aman Verified evidence
  run: |
    node aman-verified.mjs bundle --root dist --name "${{ github.event.repository.name }}@${{ github.sha }}" \
      --tier SELF --out aman.evidence.json
- uses: actions/upload-artifact@v4
  with: { path: aman.evidence.json }
```

Fail-closed: any missing, extra, or modified file (even one byte) ⇒ non-zero exit ⇒ broken build.

## Tiers

| Tier | Meaning |
|---|---|
| `SELF` | Producer self-attestation |
| `AMAN-1` | Independent offline re-derivation (e.g. by AmanChain) |
| `AMAN-2` | AMAN-1 + continuous monitoring; badge renews while clean |

## Design guarantees

- Deterministic: same bytes ⇒ byte-identical bundle (canonical, sorted, anchored).
- Fail-closed: `FAIL` on any mismatch; never warning-only. Manifest self-exclusion follows the standard SHA256SUMS convention.
- Portable: verification is arithmetic, not trust. No account, no network, no vendor lock-in.
- Open: the format is open; tiers are earned by rigor, not by payment.

## First live bundle

`evidence/tat-g2.aman.evidence.json` — TAT x402-token-risk-api G2 package, attested AMAN-1 by
AmanChain (anchor `64fe9f2abd0e…`), including 9 scope/cap checks and 2 fail-closed negative tests.
Public release of a subject's bundle requires the subject's consent.
