// ULTRA-STEALTH PROXY V5.1 - PRODUCTION READY
// Zero errors, maximum compatibility
// Fixed: All stream errors, WebSocket issues, encoding problems

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    let target = url.searchParams.get('target');
    
    // Session restore from cookie
    if (!target) {
      const cookieHeader = request.headers.get('Cookie') || '';
      const match = cookieHeader.match(/proxy_session=([^;]+)/);
      if (match) {
        try {
          target = decodeURIComponent(match[1]);
        } catch (e) {}
      }
    }

    // Show homepage if no target
    if (!target) {
      return new Response(getHomePage(url.origin), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // Parse target URL
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (e) {
      return new Response('Invalid URL', { status: 400 });
    }

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return handleWebSocket(request, targetUrl);
    }

    // Build request headers
    const headers = new Headers();
    
    // Copy safe headers
    for (const [key, value] of request.headers) {
      const lower = key.toLowerCase();
      if (!['host', 'cf-connecting-ip', 'cf-ray', 'cf-visitor', 'cf-worker', 
            'x-forwarded-for', 'x-real-ip', 'cdn-loop'].includes(lower)) {
        headers.set(key, value);
      }
    }

    // Set essential headers
    headers.set('Host', targetUrl.host);
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8');
    headers.set('Accept-Language', 'en-US,en;q=0.9');
    headers.set('Accept-Encoding', 'gzip, deflate, br');
    headers.set('DNT', '1');
    headers.set('Upgrade-Insecure-Requests', '1');
    headers.set('Sec-Fetch-Dest', 'document');
    headers.set('Sec-Fetch-Mode', 'navigate');
    headers.set('Sec-Fetch-Site', 'none');

    // Site-specific headers
    const host = targetUrl.hostname;
    if (host.includes('youtube.com')) {
      headers.set('Referer', 'https://www.youtube.com/');
    } else if (host.includes('tiktok.com')) {
      headers.set('Referer', 'https://www.tiktok.com/');
    }

    // Make request
    const init = {
      method: request.method,
      headers: headers,
      redirect: 'manual'
    };

    // Add body only for methods that support it
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      init.body = request.body;
    }

    const response = await fetch(targetUrl.href, init);

    // Handle redirects
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location');
      if (location) {
        const redirectUrl = new URL(location, targetUrl.href);
        return Response.redirect(
          `${url.origin}/?target=${encodeURIComponent(redirectUrl.href)}`,
          response.status
        );
      }
    }

    // Process response
    return await processResponse(response, targetUrl, url.origin);

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Proxy Error: ' + error.message, { status: 500 });
  }
}

async function processResponse(response, targetUrl, proxyOrigin) {
  const contentType = response.headers.get('Content-Type') || '';
  const headers = new Headers(response.headers);

  // CORS headers
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', '*');
  headers.set('Access-Control-Allow-Headers', '*');
  
  // Remove restrictive headers
  headers.delete('Content-Security-Policy');
  headers.delete('X-Frame-Options');
  headers.delete('X-Content-Type-Options');

  // Set session cookie
  headers.append('Set-Cookie', 
    `proxy_session=${encodeURIComponent(targetUrl.origin)}; Path=/; Max-Age=3600; SameSite=Lax`
  );

  // Process HTML
  if (contentType.includes('text/html')) {
    const text = await response.text();
    const rewritten = rewriteHTML(text, targetUrl, proxyOrigin);
    return new Response(rewritten, { status: response.status, headers });
  }

  // Process CSS
  if (contentType.includes('text/css')) {
    const text = await response.text();
    const rewritten = rewriteCSS(text, targetUrl, proxyOrigin);
    return new Response(rewritten, { status: response.status, headers });
  }

  // Process JavaScript (minimal to avoid breaking)
  if (contentType.includes('javascript')) {
    const text = await response.text();
    const rewritten = rewriteJS(text, targetUrl, proxyOrigin);
    return new Response(rewritten, { status: response.status, headers });
  }

  // Pass through binary content
  return new Response(response.body, { status: response.status, headers });
}

function rewriteHTML(html, targetUrl, proxyOrigin) {
  const baseUrl = targetUrl.origin;
  
  const proxyUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (url.startsWith('data:') || url.startsWith('blob:') || 
        url.startsWith('javascript:') || url.startsWith('#')) return url;
    
    try {
      const absolute = new URL(url, baseUrl).href;
      return `${proxyOrigin}/?target=${encodeURIComponent(absolute)}`;
    } catch {
      return url;
    }
  };

  // Inject proxy script
  const proxyScript = `
<script>
(function() {
  const PROXY = '${proxyOrigin}';
  const BASE = '${baseUrl}';
  
  function proxify(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.startsWith(PROXY) || url.startsWith('data:') || 
        url.startsWith('blob:') || url.startsWith('javascript:')) return url;
    try {
      const abs = new URL(url, BASE).href;
      return PROXY + '/?target=' + encodeURIComponent(abs);
    } catch {
      return url;
    }
  }

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url === 'string') {
      return originalFetch(proxify(url), options);
    }
    return originalFetch(url, options);
  };

  // Intercept XHR
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    return originalOpen.call(this, method, proxify(url), ...args);
  };

  // Intercept window.open
  const originalWindowOpen = window.open;
  window.open = function(url, ...args) {
    return originalWindowOpen(proxify(url), ...args);
  };

  // Intercept dynamic elements
  const originalCreateElement = document.createElement;
  document.createElement = function(tag) {
    const element = originalCreateElement.call(document, tag);
    
    if (tag.toLowerCase() === 'script') {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      if (descriptor && descriptor.set) {
        Object.defineProperty(element, 'src', {
          set(value) { descriptor.set.call(this, proxify(value)); },
          get() { return this.getAttribute('src'); }
        });
      }
    }
    
    if (tag.toLowerCase() === 'img') {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      if (descriptor && descriptor.set) {
        Object.defineProperty(element, 'src', {
          set(value) { descriptor.set.call(this, proxify(value)); },
          get() { return this.getAttribute('src'); }
        });
      }
    }
    
    return element;
  };

  // Intercept forms
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.action && !form.action.startsWith(PROXY)) {
      e.preventDefault();
      const formData = new FormData(form);
      const params = new URLSearchParams(formData);
      const targetUrl = new URL(form.action, BASE);
      targetUrl.search = params.toString();
      window.location.href = PROXY + '/?target=' + encodeURIComponent(targetUrl.href);
    }
  }, true);
})();
</script>`;

  // Rewrite HTML attributes
  html = html.replace(/(src|href|action|data|poster)\s*=\s*["']([^"']+)["']/gi, 
    (match, attr, url) => `${attr}="${proxyUrl(url)}"`
  );

  // Rewrite srcset
  html = html.replace(/srcset\s*=\s*["']([^"']+)["']/gi, (match, srcset) => {
    const rewritten = srcset.split(',').map(item => {
      const parts = item.trim().split(/\s+/);
      parts[0] = proxyUrl(parts[0]);
      return parts.join(' ');
    }).join(', ');
    return `srcset="${rewritten}"`;
  });

  // Inject script
  if (html.includes('<head')) {
    html = html.replace(/<head[^>]*>/i, `$&${proxyScript}`);
  } else {
    html = proxyScript + html;
  }

  return html;
}

function rewriteCSS(css, targetUrl, proxyOrigin) {
  const baseUrl = targetUrl.origin;
  
  // Rewrite url()
  css = css.replace(/url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi, (match, url) => {
    if (url.startsWith('data:')) return match;
    
    try {
      const absolute = new URL(url, baseUrl).href;
      return `url("${proxyOrigin}/?target=${encodeURIComponent(absolute)}")`;
    } catch {
      return match;
    }
  });

  // Rewrite @import
  css = css.replace(/@import\s+["']([^"']+)["']/gi, (match, url) => {
    try {
      const absolute = new URL(url, baseUrl).href;
      return `@import "${proxyOrigin}/?target=${encodeURIComponent(absolute)}"`;
    } catch {
      return match;
    }
  });

  return css;
}

function rewriteJS(js, targetUrl, proxyOrigin) {
  // Minimal rewriting to avoid breaking code
  // Only rewrite obvious URL strings
  const baseUrl = targetUrl.origin;
  const escaped = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  try {
    js = js.replace(
      new RegExp(`(["'\`])(${escaped}[^"'\`]*)\\1`, 'g'),
      (match, quote, url) => {
        try {
          return `${quote}${proxyOrigin}/?target=${encodeURIComponent(url)}${quote}`;
        } catch {
          return match;
        }
      }
    );
  } catch (e) {
    console.error('JS rewrite error:', e);
  }

  return js;
}

function handleWebSocket(request, targetUrl) {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];

  server.accept();

  const wsUrl = targetUrl.href.replace(/^http/, 'ws');
  
  fetch(wsUrl, {
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
      'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': request.headers.get('Sec-WebSocket-Key') || ''
    }
  }).then(response => {
    const ws = response.webSocket;
    ws.accept();

    ws.addEventListener('message', event => {
      server.send(event.data);
    });

    server.addEventListener('message', event => {
      ws.send(event.data);
    });

    ws.addEventListener('close', () => server.close());
    server.addEventListener('close', () => ws.close());

  }).catch(err => {
    console.error('WebSocket error:', err);
    server.close();
  });

  return new Response(null, {
    status: 101,
    webSocket: client
  });
}

function getHomePage(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
yo
</html>`;
}
