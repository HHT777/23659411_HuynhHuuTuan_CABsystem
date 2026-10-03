import fs from "node:fs";
import path from "node:path";

const root = new URL("../shared/contracts/", import.meta.url);
for (const file of ["events.v1.json", "api-errors.v1.json"]) {
  JSON.parse(fs.readFileSync(new URL(file, root), "utf8"));
}
console.log("contract JSON: PASS");
