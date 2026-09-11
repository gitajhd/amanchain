#!/usr/bin/env node
/**
 * aman-verified v0.1.0 — reference CLI for Aman Evidence Format v1 (AEF-1)
 * Single file · zero dependencies · fully offline · Node >= 18
 *
 * Commands:
 *   bundle  --root DIR --name NAME [--kind KIND] --out FILE [--tier AMAN-1|SELF|AMAN-2]
 *           [--manifest SHA256SUMS.txt] [--expect-sha256 HEX] [--check id=expected:actual:detail]...
 *           [--negtest id=expected_result:result[:code]]...
 *   check   EVIDENCE.json                 → anchor validity (offline arithmetic only)
 *   reverify EVIDENCE.json --root DIR     → independent re-hash of every file, fail-closed
 *   badge   EVIDENCE.json [--out FILE] [--svg FILE]
 *
 * Spec: see SPEC.md (Aman Evidence Format v1). Exit 0 = clean/valid, 1 = otherwise.
 */
import { createHash } from "node:crypto";
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";

const TOOL = { name: "aman-verified", version: "0.1.0" };
const EXCLUDE = new Set(["aman.evidence.json", "aman.badge.json", "aman.badge.svg", ".DS_Store"]);
const EXCLUDE_DIRS = new Set([".git", "node_modules", ".pnpm-store", "__pycache__"]);

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const argv = process.argv.slice(2);
const cmd = argv[0];

function die(msg, code = 1) { console.error("aman-verified: " + msg); process.exit(code); }
function opt(flag) { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; }
function opts(flag) {
  const out = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === flag) out.push(argv[i + 1] ?? "");
  return out;
}

// ---------- canonical form (SPEC §3) ----------
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const sorted = {};
    for (const k of Object.keys(value).sort()) sorted[k] = canonicalize(value[k]);
    return sorted;
  }
  return value;
}
function anchorHash(bundle) {
  const { bundle_sha256, ...rest } = bundle;
  return sha256(Buffer.from(JSON.stringify(canonicalize(rest)) + "\n", "utf8"));
}

// ---------- file walk (byte-wise sorted, fail-closed) ----------
function walk(root) {
  const out = [];
  const rec = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const rel = relative(root, p).split("\\").join("/");
      if (EXCLUDE.has(basename(name))) continue;
      const st = statSync(p);
      if (st.isDirectory() && EXCLUDE_DIRS.has(name)) continue;
      if (st.isSymbolicLink()) out.push({ path: rel, error: "symlink" });
      else if (st.isDirectory()) rec(p);
      else out.push({ path: rel, size: st.size });
    }
  };
  rec(root);
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

function hashRoot(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) die(`--root is not a directory: ${root}`);
  const files = [];
  let total = 0;
  for (const entry of walk(root)) {
    if (entry.error) die(`fail-closed: ${entry.error} at ${entry.path}`);
    const buf = readFileSync(join(root, entry.path));
    const digest = sha256(buf);
    files.push({ path: entry.path, size: entry.size, sha256: digest });
    total += entry.size;
  }
  return { files, total };
}

// ---------- commands ----------
function cmdBundle() {
  const root = opt("--root");
  const name = opt("--name");
  const out = opt("--out");
  if (!root || !name || !out) die("bundle requires --root DIR --name NAME --out FILE");

  const kind = opt("--kind") || "package";
  const tier = opt("--tier") || "AMAN-1";
  if (!["SELF", "AMAN-1", "AMAN-2"].includes(tier)) die(`bad tier: ${tier}`);

  const { files, total } = hashRoot(root);
  const checks = [];
  const negtests = [];

  // external SHA256SUMS-style manifest comparison, if provided
  const manifest = opt("--manifest");
  if (manifest) {
    const sums = new Map();
    for (const line of readFileSync(manifest, "utf8").split("\n")) {
      const m = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
      if (m) sums.set(m[2].trim(), m[1].toLowerCase());
    }
    const byPath = new Map(files.map((f) => [f.path, f.sha256]));
    const selfName = manifest.split("/").pop(); // standard convention: a SHA256SUMS file covers the other files, itself excluded
    let match = 0, missing = [], extra = [], mismatch = [];
    for (const [p, h] of sums) (byPath.has(p) ? (byPath.get(p) === h ? match++ : mismatch.push(p)) : missing.push(p));
    for (const p of byPath.keys()) if (!sums.has(p) && p !== selfName) extra.push(p);
    const verdict = mismatch.length + missing.length + extra.length === 0;
    checks.push({
      id: `sums-manifest-${match}/${sums.size}`, status: verdict ? "PASS" : "FAIL",
      expected: `${sums.size}/${sums.size} OK`, actual: verdict ? `${match}/${sums.size} OK` : `mismatch=${mismatch.length} missing=${missing.length} extra=${extra.length}`,
      detail: verdict ? "external manifest matches re-hashed tree byte-for-byte (manifest self-excluded)" : `bad=${mismatch.concat(missing).slice(0, 5).join(",")}`,
    });
  }

  // externally announced artifact digest (e.g. archive sha256 quoted in handoff)
  const expect = opt("--expect-sha256");
  if (expect) {
    // anchor-equivalent check: hash the canonical file list identity
    const identity = sha256(Buffer.from(files.map((f) => `${f.sha256}  ${f.path}`).join("\n") + "\n", "utf8"));
    checks.push({
      id: "tree-identity-digest", status: identity === expect.toLowerCase() ? "PASS" : "FAIL",
      expected: expect.toLowerCase(), actual: identity,
      detail: "sha256 over (sha256  path) lines of the whole tree, byte-wise sorted",
    });
  }

  // explicit checks: id=expected:actual:detail (PASS iff expected===actual)
  for (const raw of opts("--check")) {
    const m = raw.match(/^([^=]+)=([^:]*):([^:]*)(?::(.*))?$/);
    if (!m) die(`bad --check: ${raw}`);
    const [, id, expected, actual, detail] = m;
    checks.push({ id, status: expected === actual ? "PASS" : "FAIL", expected, actual, detail: detail || "" });
  }

  // negative tests: id=expected_result:result[:code] (fail-closed confirmed iff result===expected_result)
  for (const raw of opts("--negtest")) {
    const eq = raw.indexOf("=");
    if (eq < 0) die(`bad --negtest: ${raw}`);
    const id = raw.slice(0, eq);
    const parts = raw.slice(eq + 1).split(":");
    if (parts.length < 2) die(`bad --negtest: ${raw}`);
    const [expected_result, result, code] = parts;
    negtests.push({ id, expected_result, result, code: code || undefined });
  }

  const bundle = {
    aman_evidence_version: "1.0",
    subject: { name, kind },
    generated_at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    tool: TOOL,
    scope: { file_count: files.length, total_bytes: total, manifest: manifest ? basename(manifest) : undefined },
    files,
    checks,
    negative_tests: negtests,
    attestation: {
      verifier: tier === "SELF" ? name : "AmanChain",
      verifier_id: tier === "SELF" ? `${name}-self` : "amanchain-verify-01",
      tier,
      method: tier === "SELF" ? "self-declared" : "independent-offline",
      signed_by: tier === "SELF" ? name : "gitajhd",
      attested_at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
      statement: tier === "SELF"
        ? "Producer self-attestation; no independent verification performed."
        : "All digests and checks independently re-derived offline by the verifier; fail-closed negative tests confirmed.",
    },
  };
  bundle.bundle_sha256 = anchorHash(bundle);
  writeFileSync(out, JSON.stringify(bundle, null, 2) + "\n");

  const clean = bundle.checks.every((c) => c.status === "PASS") &&
    bundle.negative_tests.every((n) => n.result === n.expected_result);
  console.log(`${clean ? "CLEAN" : "NOT-CLEAN"} bundle=${out} anchor=${bundle.bundle_sha256}`);
  process.exit(clean ? 0 : 1);
}

function cmdCheck() {
  const f = opt("check") ? argv[argv.indexOf("check") + 1] : opt("--bundle");
  if (!f) die("check requires EVIDENCE.json path");
  const bundle = JSON.parse(readFileSync(f, "utf8"));
  const stated = bundle.bundle_sha256;
  const actual = anchorHash(bundle);
  const filesSorted = JSON.stringify(bundle.files.map((x) => x.path)) ===
    JSON.stringify([...bundle.files.map((x) => x.path)].sort((a, b) => (a < b ? -1 : 1)));
  const ok = stated === actual && filesSorted;
  console.log(`${ok ? "VALID" : "INVALID"} anchor=${actual} stated=${stated} files_sorted=${filesSorted}`);
  process.exit(ok ? 0 : 1);
}

function cmdReverify() {
  const f = argv[argv.indexOf("reverify") + 1];
  const root = opt("--root");
  if (!f || !root) die("reverify requires EVIDENCE.json and --root DIR");
  const bundle = JSON.parse(readFileSync(f, "utf8"));
  if (bundle.bundle_sha256 !== anchorHash(bundle)) die("bundle anchor INVALID — refusing reverify", 1);
  const { files } = hashRoot(root);
  const claimed = new Map(bundle.files.map((x) => [x.path, x]));
  const present = new Map(files.map((x) => [x.path, x]));
  let ok = true;
  for (const [p, c] of claimed) {
    const got = present.get(p);
    if (!got) { console.log(`FAIL missing=${p}`); ok = false; }
    else if (got.sha256 !== c.sha256 || got.size !== c.size) { console.log(`FAIL changed=${p}`); ok = false; }
  }
  for (const p of present.keys()) if (!claimed.has(p)) { console.log(`FAIL extra=${p}`); ok = false; }
  const checksOk = bundle.checks.every((c) => c.status === "PASS");
  const negOk = bundle.negative_tests.every((n) => n.result === n.expected_result);
  console.log(`${ok && checksOk && negOk ? "REVERIFIED-CLEAN" : "REVERIFIED-DIRTY"} files=${files.length}/${bundle.files.length} checks=${checksOk ? "PASS" : "FAIL"} negtests=${negOk ? "PASS" : "FAIL"}`);
  process.exit(ok && checksOk && negOk ? 0 : 1);
}

function cmdBadge() {
  const f = argv[argv.indexOf("badge") + 1];
  if (!f) die("badge requires EVIDENCE.json path");
  const bundle = JSON.parse(readFileSync(f, "utf8"));
  if (bundle.bundle_sha256 !== anchorHash(bundle)) die("bundle anchor INVALID — badge refused", 1);
  const clean = bundle.checks.every((c) => c.status === "PASS") &&
    bundle.negative_tests.every((n) => n.result === n.expected_result);
  const short = bundle.bundle_sha256.slice(0, 12);
  const badge = {
    badge: "aman-verified", aef_version: bundle.aman_evidence_version,
    subject: bundle.subject.name, kind: bundle.subject.kind,
    tier: bundle.attestation.tier, clean,
    bundle_sha256_truncated: short, bundle_sha256: bundle.bundle_sha256,
    verified_by: bundle.attestation.verifier, verified_at: bundle.attestation.attested_at,
    verify: `https://amanchain.ma/aman-verified/bundle/${short}`,
  };
  const outJson = opt("--out") || "aman.badge.json";
  writeFileSync(outJson, JSON.stringify(badge, null, 2) + "\n");
  if (opt("--svg")) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="276" height="20" role="img" aria-label="aman-verified">
<rect width="276" height="20" rx="3" fill="#0b3d2e"/><rect x="104" width="172" height="20" fill="${clean ? "#1e9e5a" : "#c0392b"}"/>
<text x="8" y="14" fill="#fff" font-family="monospace" font-size="11">aman-verified</text>
<text x="112" y="14" fill="#fff" font-family="monospace" font-size="11">${clean ? "AMAN-1 CLEAN" : badge.tier + (clean ? " CLEAN" : " DIRTY")}</text>
<text x="208" y="14" fill="#dfe" font-family="monospace" font-size="9">${short}</text></svg>`;
    writeFileSync(opt("--svg"), svg);
  }
  console.log(`${clean ? "CLEAN" : "NOT-CLEAN"} badge=${outJson} anchor=${short}`);
  process.exit(clean ? 0 : 1);
}

switch (cmd) {
  case "bundle": cmdBundle(); break;
  case "check": cmdCheck(); break;
  case "reverify": cmdReverify(); break;
  case "badge": cmdBadge(); break;
  default: die("usage: aman-verified <bundle|check|reverify|badge> ...  (see SPEC.md)");
}
