import fs from "node:fs";
import newman from "newman";
const root = new URL("../../", import.meta.url);
const env = Object.fromEntries(fs.readFileSync(new URL(".env", root), "utf8").split(/\r?\n/).filter(line => line && !line.startsWith("#") && line.includes("=")).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
newman.run({
  collection: JSON.parse(fs.readFileSync(new URL("postman/CAB-phieucham.postman_collection.json", root))),
  environment: { values: [{ key: "paymentCallbackSecret", value: env.PAYMENT_CALLBACK_SECRET ?? "cab-local-callback-secret", enabled: true }] },
  reporters: ["cli"], reporter: { cli: { noBanner: true } },
}, (err, summary) => { process.exitCode = err || summary.run.failures.length ? 1 : 0; });
