// Sets the password for projects marked "password": true in manifest/projects.json.
// Only its SHA-256 is written to manifest/access.json:  npm run manifest:password -- <password>
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const password = process.argv[2];
if (!password) { console.error("Usage: npm run manifest:password -- <password>"); process.exit(1); }
const path = new URL("../manifest/access.json", import.meta.url);
const access = JSON.parse(readFileSync(path, "utf8"));
access.passwordSha256 = createHash("sha256").update(password).digest("hex");
writeFileSync(path, `${JSON.stringify(access, null, 2)}\n`);
console.log("Updated manifest/access.json. Rebuild to publish the new password.");
