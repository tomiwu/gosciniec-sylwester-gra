/**
 * Public game package entry. No staff routes. No credential.
 * The platform serves hashed files under /_assets/. This handler sends
 * every other GET to the game shell so the hosted root opens the game.
 */
function gameRedirect(request: Request): Response {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return Response.redirect("https://invalid.local/_assets/index.html", 302);
  }
  url.pathname = "/_assets/index.html";
  url.search = "";
  return Response.redirect(url, 302);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const method = (request.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    let path = "";
    try {
      path = new URL(request.url).pathname;
    } catch {
      path = "";
    }
    if (path.startsWith("/_assets/")) {
      return new Response(null, { status: 404 });
    }
    return gameRedirect(request);
  },
};
