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

    return env.ASSETS.fetch(request);
  }
};
