// app/swagger/page.tsx
"use client";

// @ts-expect-error swagger-ui-react is not typed for React 19 yet
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function SwaggerPage() {
  return <SwaggerUI url="/api/openapi" />;
}