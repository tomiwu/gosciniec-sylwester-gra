import { credential } from "kody:runtime";
import { handleRequest, visitorFromHeader, type AppUser } from "./handle";

async function resolveUser(request: Request): Promise<AppUser | null> {
  return visitorFromHeader(request.headers.get("X-Kody-Visitor"));
}

/** Kody package-app entry. The credential client injects the staff key. */
export default {
  async fetch(request: Request): Promise<Response> {
    const supabase = await credential("supabase-service-role");
    return handleRequest(request, {
      fetch: (input, init) => supabase.fetch(input, init),
      allowList: ["tomiwu"],
      resolveUser,
    });
  },
};
