export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();

    if (hostname === "www.errordiffusion.cc") {
      url.hostname = "errordiffusion.cc";
      return Response.redirect(url.toString(), 301);
    }

    if (hostname === "www.errordiffusion.net") {
      url.hostname = "errordiffusion.net";
      return Response.redirect(url.toString(), 301);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    const crashPageRequest = new Request(new URL("/404.html", url).toString(), request);
    const crashPageResponse = await env.ASSETS.fetch(crashPageRequest);
    if (crashPageResponse.ok) {
      return new Response(crashPageResponse.body, {
        status: 404,
        headers: crashPageResponse.headers
      });
    }

    return assetResponse;
  }
};
