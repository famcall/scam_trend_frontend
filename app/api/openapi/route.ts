import { openapi } from "../_core/openapi";

export const GET = async () => {
  return Response.json(openapi);
};