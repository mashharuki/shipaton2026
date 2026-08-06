import { describe, expect, it } from "vitest";
import { parse } from "yaml";
// Vite `?raw` import -- reads the committed file's text at build time (no
// runtime `node:fs`, unavailable in this project's Workers test pool without
// the nodejs_compat flag, which isn't enabled -- see backend CLAUDE.md).
import committedYamlText from "../openapi.yaml?raw";
import app, { openApiConfig } from "../src/index";

type OpenApiOperation = {
  operationId?: string;
  tags?: string[];
  summary?: string;
  responses?: Record<string, unknown>;
};

type OpenApiDocument = {
  components?: {
    securitySchemes?: Record<string, unknown>;
  };
  security?: unknown[];
  servers?: unknown[];
  paths: Record<string, Record<string, OpenApiOperation>>;
};

const HTTP_METHODS = ["get", "post", "put", "delete", "patch"];

function isErrorResponseRef(response: unknown): boolean {
  const content = (response as { content?: Record<string, unknown> })
    ?.content?.["application/json"] as { schema?: unknown } | undefined;
  const schema = content?.schema as { $ref?: string } | undefined;
  return schema?.$ref === "#/components/schemas/ErrorResponse";
}

describe("OpenAPI generation (task 3.8)", () => {
  const freshDocument = app.getOpenAPIDocument(
    openApiConfig,
  ) as unknown as OpenApiDocument;
  const committedDocument = parse(committedYamlText) as OpenApiDocument;

  it("regenerating from the route definitions produces the exact committed openapi.yaml (drift check)", () => {
    expect(freshDocument).toEqual(committedDocument);
  });

  it("declares the shared apiKey securityScheme and applies it by default to every operation", () => {
    expect(freshDocument.components?.securitySchemes?.ApiKeyAuth).toEqual({
      type: "apiKey",
      in: "header",
      name: "x-api-key",
    });
    expect(freshDocument.security).toEqual([{ ApiKeyAuth: [] }]);
  });

  it("defines both the local wrangler dev and production servers", () => {
    expect(freshDocument.servers).toHaveLength(2);
  });

  it("every operation has an operationId, tags, and a summary", () => {
    const missing: string[] = [];
    for (const [path, methods] of Object.entries(freshDocument.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = methods[method];
        if (!operation) {
          continue;
        }
        if (!operation.operationId)
          missing.push(`${method} ${path}: operationId`);
        if (!operation.tags?.length) missing.push(`${method} ${path}: tags`);
        if (!operation.summary) missing.push(`${method} ${path}: summary`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every 4xx/5xx response references the shared ErrorResponse component", () => {
    const violations: string[] = [];
    for (const [path, methods] of Object.entries(freshDocument.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = methods[method];
        if (!operation?.responses) {
          continue;
        }
        for (const [status, response] of Object.entries(operation.responses)) {
          if (!/^[45]\d\d$/.test(status)) {
            continue;
          }
          if (!isErrorResponseRef(response)) {
            violations.push(`${method} ${path} ${status}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
