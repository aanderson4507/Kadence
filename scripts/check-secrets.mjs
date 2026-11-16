// Blocks commits that stage real credentials. Run via the pre-commit hook or `npm run check:secrets`.
import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const files = git("diff", "--cached", "--name-only", "--diff-filter=ACM").split("\n").filter(Boolean);
const problems = [];

for (const file of files) {
  if (/(^|\/)\.env(\..+)?$/.test(file) && !file.endsWith(".env.example")) {
    problems.push(`${file}: environment file must not be committed`);
  }
}

// Placeholder words that mark an example value rather than a real credential.
const PLACEHOLDER = /YOUR_|USER|PASSWORD|HOST|<[^>]+>|example|changeme/i;
const patterns = [
  { name: "database URL with password", re: /postgres(?:ql)?:\/\/[^\s:@"']+:([^\s@"']+)@/g, value: 1 },
  { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/g },
  { name: "API token", re: /\b(?:sk|pk|ghp|gho|xox[bp])[-_][A-Za-z0-9_-]{20,}/g },
];

for (const file of files) {
  if (file === "package-lock.json" || file === "scripts/check-secrets.mjs") continue;
  let text;
  try {
    text = git("show", `:${file}`);
  } catch {
    continue;
  }
  if (text.includes("\0")) continue;
  for (const { name, re, value } of patterns) {
    for (const match of text.matchAll(re)) {
      const secret = value ? match[value] : match[0];
      if (value && PLACEHOLDER.test(match[0])) continue;
      problems.push(`${file}: possible ${name} (${secret.slice(0, 4)}…)`);
    }
  }
}

if (problems.length > 0) {
  console.error("Commit blocked: possible secrets staged.\n  " + problems.join("\n  "));
  console.error("\nRemove them (use .env, which is git-ignored). If a real secret was exposed, rotate it.");
  process.exit(1);
}
