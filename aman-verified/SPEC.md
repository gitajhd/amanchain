# Aman Evidence Format v1 (AEF-1)

**Standard open evidence format for independently verifiable software delivery — by AmanChain.**
Version: 1.0 (draft) · Status: reference implementation shipping · License: MIT (spec + CLI)

---

## 1. Purpose

AEF-1 answers one question with cryptographic discipline:

> "What exactly did this software consist of, what checks did it pass, and who vouches for that — provably?"

Any API, package, or service can produce an **Aman Evidence Bundle** — a single, canonical,
hash-chained JSON document that anyone can re-verify independently, offline, in seconds.

Analogy: what an SBOM did for dependency transparency, AEF-1 does for **delivery assurance**:
byte-exact identity + executed checks + independent attestation, in one verifiable file.

## 2. The Bundle

An Aman Evidence Bundle is a UTF-8 JSON file (`aman.evidence.json`) with these top-level fields:

| Field | Type | Meaning |
|---|---|---|
| `aman_evidence_version` | string | Always `"1.0"` |
| `subject` | object | What is being attested: `{name, kind, homepage?}` |
| `generated_at` | string | RFC 3339 UTC timestamp |
| `tool` | object | `{name, version}` of the producing CLI |
| `scope` | object | `{file_count, total_bytes, manifest?}` — inventory summary |
| `files` | array | Sorted (byte-wise) list of `{path, size, sha256}` |
| `checks` | array | Executed checks: `{id, status, expected?, actual?, detail}` |
| `negative_tests` | array | Fail-closed probes: `{id, expected_result, result, code?}` |
| `attestation` | object | Who vouches: `{verifier, verifier_id, tier, method, signed_by, attested_at, statement}` |
| `bundle_sha256` | string | Chain anchor — see §3 |

### 2.1 `attestation.tier`

| Tier | Value | Meaning |
|---|---|---|
| Self | `SELF` | Producer attested its own artifact |
| Independent | `AMAN-1` | AmanChain independently re-derived all digests and checks, offline |
| Monitored | `AMAN-2` | AMAN-1 plus ongoing re-verification schedule; badge renews while clean |

## 3. Canonical hashing rule (the chain anchor)

`bundle_sha256` = SHA-256 of the **canonical form** of the bundle:

1. Remove the `bundle_sha256` field.
2. Recursively sort object keys byte-wise.
3. Serialize with `JSON.stringify` (no spaces), then append a single `\n`.
4. SHA-256 over those exact UTF-8 bytes, lowercase hex.

Anyone can recompute it: load the file, drop the anchor field, canonicalize, hash, compare.
A bundle whose `bundle_sha256` does not match is **invalid** — no exceptions, no partial trust.

## 4. Check records

Every check is a plain record — status is one of `PASS`, `FAIL`, `SKIP`:

- `id` — stable machine identifier (e.g. `archive-hash`, `sums-manifest-28/28`, `amount-pinned-50000`)
- `expected` / `actual` — raw strings; a check passes only if `actual === expected`
- `detail` — one-line human context

A bundle is **clean** when: every check is `PASS`, every negative test produced its
`expected_result` (fail-closed behavior confirmed), and `bundle_sha256` validates.

## 5. Badge

The badge is derived, never edited: `aman-verified badge` emits `aman.badge.json` (and optional SVG)
carrying: subject name, tier, bundle_sha256 (truncated), clean flag, generation date, and
verification URL. A badge that references a bundle whose anchor fails is void by construction.

## 6. Verification workflow (any third party, offline)

```
1. Obtain: aman.evidence.json  (+ the artifact/package it covers)
2. Run:    aman-verified check aman.evidence.json        → anchor validity
3. Run:    aman-verified reverify --root <package-dir>    → re-hash every file
4. Compare: files[] vs your re-hash                       → byte-exact identity
```

Steps 2–4 require only Node ≥ 18 and the single-file CLI. No network, no accounts, no trust in us —
only arithmetic.

## 7. Design guarantees

- **Deterministic**: same input bytes → byte-identical bundle (sorted, canonical, no timestamps inside digests).
- **Fail-closed**: missing/extra/mismatched file ⇒ `FAIL`, never warning-only.
- **Portable**: one JSON file + one CLI file; no lock-in, no proprietary service required to verify.
- **Stackable**: independent verifiers (AmanChain or anyone) can re-attest an existing bundle;
  tier changes only via a fresh bundle with a new anchor.
- **Open**: the spec and CLI are open; verification never requires contacting AmanChain.
  AmanChain adds value through rigorous independent attestation and continuous monitoring — not through gatekeeping.

## 8. Origin, priority & attribution

**Origin.** AEF-1 was authored and first published by **AmanChain** (GitajHD), first shipped
2026-09-10 with reference CLI `aman-verified v0.1.0`.

**Priority record.** The first bundle ever produced under this format:

| Field | Value |
|---|---|
| Subject | TAT x402-token-risk-api G2 Independent Executor Package |
| Tier | `AMAN-1` (independently re-derived, offline) |
| Anchor (`bundle_sha256`) | `64fe9f2abd0e7afcb841cce0531449f0c31feb932810c79ef17bdaf69180894f` |
| Attested at | `2026-09-10T15:10:22Z` |
| Tool | `aman-verified 0.1.0` |

This anchor is arithmetic: it cannot be re-created for different bytes, and the attested
package is held by an external party (the audited team), who received it with its timestamp —
an independent witness of this record's existence and date.

**Canonical names.** "Aman Verified" is the canonical name of the program; "Aman Evidence
Format v1" ("AEF-1") is the canonical name of the format. The spec and CLI are MIT-licensed:
every copy or substantial portion **must** retain the copyright notice
(`Copyright (c) 2026 AmanChain Project — GitajHD`) — forks carry the origin with them, by
license. Derivatives should state: *"based on AEF-1, authored by AmanChain"*.

**Why open + attributed.** The format only achieves its purpose (machine trust) if anyone can
verify without permission — so the standard stays open. The priority record only holds if it
is dated and externally witnessed — so it stays attributed.
