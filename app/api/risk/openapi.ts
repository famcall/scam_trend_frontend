// app/api/risk/openapi.ts
import { openapi } from "../_core/openapi";

openapi.paths["/risk"] = {
  get: {
    summary: "Get scam risk events",
    description: "Filterable risk intelligence feed",
    security: [{ ApiKeyAuth: [] }],
    parameters: [
      {
        name: "level",
        in: "query",
        schema: { type: "string" },
        description: "low | medium | high | critical",
      },
      {
        name: "min_score",
        in: "query",
        schema: { type: "number" },
      },
      {
        name: "category",
        in: "query",
        schema: { type: "string" },
      },
    ],
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                ok: { type: "boolean" },
                data: {
                  type: "object",
                  properties: {
                    total: { type: "number" },
                    items: {
                      type: "array",
                      items: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};