// Points git at the tracked .githooks folder so the secret check runs before every commit.
import { execFileSync } from "node:child_process";
try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
} catch {
  // Not a git checkout (for example a CI tarball); nothing to configure.
}
