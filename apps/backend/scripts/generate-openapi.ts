/**
 * Generates apps/backend/openapi.yaml from the assembled app's own route
 * definitions (task 3.8) -- imports the default-exported OpenAPIHono app
 * from src/index.ts and calls its getOpenAPIDocument() directly (no HTTP
 * request, no bindings needed: route handlers are never invoked, only their
 * createRoute() metadata is read), using the exact same `openApiConfig`
 * object index.ts passes to `app.doc("/doc", ...)` so the committed yaml
 * and the dev-server /doc endpoint can never drift apart structurally.
 *
 * Run: pnpm --filter backend run openapi
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import app, { openApiConfig } from "../src/index";

function main() {
  const document = app.getOpenAPIDocument(openApiConfig);
  const yamlText = stringify(document);
  const outPath = join(import.meta.dirname, "..", "openapi.yaml");
  writeFileSync(outPath, yamlText);
  console.log(`Wrote OpenAPI document to ${outPath}`);
}

main();
