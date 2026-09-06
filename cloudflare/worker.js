const ORIGIN_URL = 'https://vevel-ventures-private-limited.github.io/website';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    let imageUrl = null;

    // ---- Check for ?url= query parameter (for testing) ----
    const paramUrl = url.searchParams.get('url');
    if (paramUrl) {
      imageUrl = paramUrl;
    }

    // ---- Check for path-based proxying (/wp-content/images/) ----
    if (!imageUrl && pathname.startsWith('/wp-content/images/')) {
      const imagePath = pathname.replace('/wp-content/images/', '/wp-content/uploads/');
      imageUrl = `https://westernequipments.com${imagePath}`;
    }

    // ---- If we have an image URL, fetch and cache it ----
    if (imageUrl) {
      try {
        const response = await fetch(imageUrl);
        const cachedResponse = new Response(response.body, response);
        cachedResponse.headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
        cachedResponse.headers.set('CDN-Cache-Control', 'public, max-age=604800');
        return cachedResponse;
      } catch (error) {
        return new Response('Image fetch failed', { status: 502 });
      }
    }

    // ---- Default: Forward to GitHub Pages ----
    const originUrl = `${ORIGIN_URL}${pathname}${url.search}`;
    return fetch(originUrl);
  }
};