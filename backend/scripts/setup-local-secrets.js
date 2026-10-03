import fs from "node:fs";
import crypto from "node:crypto";
fs.mkdirSync(".secrets", { recursive: true });
if (!fs.existsSync(".secrets/field-encryption.key")) fs.writeFileSync(".secrets/field-encryption.key", crypto.randomBytes(32), { mode: 0o600 });
if (!fs.existsSync(".secrets/jwt-private.pem") && !fs.existsSync(".secrets/jwt-public.pem")) await import("./generate-jwt-keys.js");
console.log("Local secret files ready; existing keys preserved.");
