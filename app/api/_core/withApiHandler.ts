import { ApiErrorMap, ApiErrorCode } from "./apiErrors";

export function withApiHandler(
  handler: () => Promise<Response>
): Promise<Response> {
  return handler().catch((err: any) => {
    const code = err?.message as ApiErrorCode;

    if (code && ApiErrorMap[code]) {
      const def = ApiErrorMap[code];
      return new Response(
        JSON.stringify({
          error: code,
          message: def.message,
        }),
        {
          status: def.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 想定外（＝バグ）
    console.error("UNHANDLED_ERROR", err);

    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        message: "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  });
}