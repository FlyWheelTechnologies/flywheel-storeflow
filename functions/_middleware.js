export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Reroute *.pages.dev requests to production custom domain
  if (url.hostname.endsWith('.pages.dev')) {
    url.hostname = 'storeflow.bookflywheel.com';
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}

