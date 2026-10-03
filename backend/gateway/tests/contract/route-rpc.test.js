import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { targetFor } from "../../src/app.js";

test("every documented public OpenAPI path has a Gateway owner", () => {
  const apiDirectory = path.resolve(process.cwd(), "api_document");
  const missing = [];
  for (const file of fs
    .readdirSync(apiDirectory)
    .filter((name) => name.endsWith(".yaml"))) {
    const source = fs.readFileSync(path.join(apiDirectory, file), "utf8");
    for (const match of source.matchAll(/^  (\/[^:]+):$/gm)) {
      const documentedPath = match[1];
      if (
        documentedPath.startsWith("/internal/") ||
        ["/health", "/ready"].includes(documentedPath)
      )
        continue;
      const samplePath = documentedPath.replace(/\{[^}]+\}/g, "sample");
      if (!targetFor(samplePath)) missing.push(`${file}:${documentedPath}`);
    }
  }
  assert.deepEqual(missing, []);
});
