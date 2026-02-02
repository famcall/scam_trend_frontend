// app/api/_core/openapi.ts
import { OpenAPIObject } from "openapi3-ts/oas31";

export const openapi: OpenAPIObject = {
  openapi: "3.1.0",
  info: {
    title: "Scam Trend API",
    version: "1.0.0",
    description: "Scam risk intelligence API",
  },
  servers: [
    { url: "/api" },
  ],

  /**
   * ⚠️ 重要
   * paths / components は「後から安全に拡張する」前提
   */
  paths: {},

  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
      },
    },
    schemas: {},
  },
};