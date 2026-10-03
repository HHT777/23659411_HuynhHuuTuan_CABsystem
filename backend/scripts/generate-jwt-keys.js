import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const directory = path.resolve(process.cwd(), ".secrets");
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
fs.writeFileSync(path.join(directory, "jwt-private.pem"), privateKey, {
  mode: 0o600,
});
fs.writeFileSync(path.join(directory, "jwt-public.pem"), publicKey, {
  mode: 0o644,
});
console.log(`Generated RS256 keys in ${directory}`);
