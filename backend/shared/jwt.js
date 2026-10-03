import crypto from "node:crypto";
import fs from "node:fs";

let ephemeralKeys;

function readKey(inlineName, pathName) {
  if (process.env[inlineName])
    return process.env[inlineName].replace(/\\n/g, "\n");
  if (process.env[pathName])
    return fs.readFileSync(process.env[pathName], "utf8");
  return null;
}

function keys() {
  const privateKey = readKey("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH");
  const publicKey = readKey("JWT_PUBLIC_KEY", "JWT_PUBLIC_KEY_PATH");
  if (privateKey || publicKey) {
    if (!privateKey || !publicKey)
      throw new Error(
        "JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be configured together",
      );
    return { privateKey, publicKey };
  }
  if (process.env.JWT_ALLOW_EPHEMERAL !== "true") {
    throw new Error(
      "RS256 keys are not configured; set JWT_PRIVATE_KEY_PATH/JWT_PUBLIC_KEY_PATH or JWT_ALLOW_EPHEMERAL=true for one-process tests",
    );
  }
  ephemeralKeys ??= crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return ephemeralKeys;
}

export function signJwt(claims) {
  const { privateKey } = keys();
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(unsigned), privateKey)
    .toString("base64url");
  return `${unsigned}.${signature}`;
}

export function verifyJwt(value) {
  try {
    const { publicKey } = keys();
    const parts = String(
      value ?? "",
    )
      .replace(/^Bearer\s+/i, "")
      .split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url"));
    if (header.alg !== "RS256" || header.typ !== "JWT") return null;
    const valid = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      publicKey,
      Buffer.from(encodedSignature, "base64url"),
    );
    if (!valid) return null;
    const claims = JSON.parse(Buffer.from(encodedPayload, "base64url"));
    return claims.exp > Math.floor(Date.now() / 1000) && claims.iss === "identity-service" && claims.aud === "cab-gateway" && typeof claims.sub === "string" && ["CUSTOMER", "DRIVER", "ADMIN"].includes(claims.role) ? claims : null;
  } catch {
    return null;
  }
}
