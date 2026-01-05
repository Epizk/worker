// ULTRA-STEALTH PROXY V5.0 - ENHANCED PERFORMANCE & BOT BYPASS
// - Advanced resource loading (CSS, images, videos, icons)
// - Bot detection bypass with realistic browser fingerprinting
// - Optimized caching and compression
// - Fixed TikTok, YouTube, Now.gg compatibility

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const BINARY_EXTENSIONS = new Set([
  'jpg','jpeg','png','gif','webp','svg','ico','bmp','tiff','tif','avif','apng','jfif','pjpeg','pjp','jpe','jif','jfi','svgz','heic','heif','raw','dng','cr2','nef','arw','orf','rw2','pef','sr2','x3f',
  'mp4','webm','ogg','ogv','avi','mov','wmv','flv','mkv','m4v','3gp','mpg','mpeg','ts','m2ts','mts','vob','f4v','asf','rm','rmvb','divx','xvid','m3u8','m3u',
  'mp3','wav','ogg','oga','m4a','aac','flac','opus','wma','aiff','ape','ac3','dts','alac','amr','au','mid','midi','ra','wv','tta',
  'woff','woff2','ttf','otf','eot','sfnt',
  'zip','rar','7z','tar','gz','bz2','xz','iso','dmg','pkg','deb','rpm','cab','arj','lzh','ace',
  'pdf','doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp',
  'exe','dll','so','dylib','bin','app','apk','jar','msi',
  'wasm','dat','db','sqlite','mdb','accdb'
]);

// Advanced bot bypass headers
function getBotBypassHeaders(targetHost) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
  };
  
  // Site-specific headers
  if (targetHost.includes('tiktok.com')) {
    headers['Referer'] = 'https://www.tiktok.com/';
    headers['Origin'] = 'https://www.tiktok.com';
  } else if (targetHost.includes('youtube.com') || targetHost.includes('googlevideo.com')) {
    headers['Referer'] = 'https://www.youtube.com/';
    headers['Origin'] = 'https://www.youtube.com';
    headers['X-YouTube-Client-Name'] = '1';
    headers['X-YouTube-Client-Version'] = '2.20231219.04.00';
  } else if (targetHost.includes('now.gg')) {
    headers['Referer'] = 'https://now.gg/';
    headers['Origin'] = 'https://now.gg';
  }
  
  return headers;
}

async function handleRequest(request) {
  const url = new URL(request.url);
  let target = url.searchParams.get('target');
  const cookieHeader = request.headers.get('Cookie') || '';

  // Session Memory
  if (!target) {
    const sessionMatch = cookieHeader.match(/proxy_host=([^;]+)/);
    if (sessionMatch) {
      const savedHost = decodeURIComponent(sessionMatch[1]);
      target = new URL(url.pathname + url.search, savedHost).href;
    }
  }

  if (!target) {
    return new Response(getHomePage(url.origin), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // Target Normalization
  let targetUrl;
  try {
    const decoded = decodeURIComponent(target);
    targetUrl = new URL(decoded.includes('://') ? decoded : target);
  } catch (e) {
    try {
      targetUrl = new URL(target);
    } catch (e2) {
      return new Response('Invalid URL', { status: 400 });
    }
  }

  // WebSocket handling
  if (request.headers.get('Upgrade') === 'websocket') {
    return proxyWebSocket(request, targetUrl);
  }

  // Build enhanced headers
  const headers = new Headers();
  const botBypassHeaders = getBotBypassHeaders(targetUrl.host);
  
  // Copy original headers selectively
  for (const [key, value] of request.headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (!['host', 'cf-connecting-ip', 'cf-ray', 'cf-visitor', 'cf-worker', 'x-forwarded-for', 'x-real-ip', 'cdn-loop', 'user-agent'].includes(lowerKey)) {
      headers.set(key, value);
    }
  }
  
  // Apply bot bypass headers
  for (const [key, value] of Object.entries(botBypassHeaders)) {
    headers.set(key, value);
  }
  
  headers.set('Host', targetUrl.host);

  // Preserve cookies for target domain
  const cookies = request.headers.get('Cookie');
  if (cookies) {
    const filteredCookies = cookies.split(';')
      .filter(c => !c.trim().startsWith('proxy_host='))
      .join(';');
    if (filteredCookies) {
      headers.set('Cookie', filteredCookies);
    }
  }

  try {
    const response = await fetch(new Request(targetUrl.href, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual',
      cf: {
        cacheTtl: 3600,
        cacheEverything: true
      }
    }));

    // Handle redirects
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const loc = response.headers.get('Location');
      if (loc) {
        const fullLoc = new URL(loc, targetUrl.href).href;
        return Response.redirect(`${url.origin}${url.pathname}?target=${encodeURIComponent(fullLoc)}`, response.status);
      }
    }

    const processedResponse = await processResponse(response, targetUrl, url.origin, url.pathname);
    processedResponse.headers.append('Set-Cookie', `proxy_host=${encodeURIComponent(targetUrl.origin)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    
    return processedResponse;
  } catch (e) {
    return new Response(`Proxy Error: ${e.message}`, { status: 502 });
  }
}

async function processResponse(response, targetUrl, workerOrigin, workerPath) {
  const contentType = response.headers.get('content-type') || '';
  const newHeaders = new Headers(response.headers);

  // Handle cookies
  const setCookie = response.headers.get('Set-Cookie');
  if (setCookie) {
    newHeaders.set('Set-Cookie', setCookie
      .replace(/Domain=[^;]+;?/gi, '')
      .replace(/Secure;?/gi, '')
      .replace(/SameSite=None;?/gi, 'SameSite=Lax'));
  }

  // CORS and security headers
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', '*');
  newHeaders.set('Access-Control-Expose-Headers', '*');
  newHeaders.delete('content-security-policy');
  newHeaders.delete('content-security-policy-report-only');
  newHeaders.delete('x-frame-options');
  newHeaders.delete('x-content-type-options');

  // Handle HTML
  if (contentType.includes('text/html')) {
    let text = await response.text();
    text = rewriteHtml(text, targetUrl, workerOrigin, workerPath);
    newHeaders.set('Content-Type', 'text/html; charset=utf-8');
    return new Response(text, { status: response.status, headers: newHeaders });
  }

  // Handle CSS
  if (contentType.includes('text/css') || contentType.includes('stylesheet')) {
    let text = await response.text();
    text = rewriteCss(text, targetUrl, workerOrigin, workerPath);
    newHeaders.set('Content-Type', 'text/css; charset=utf-8');
    return new Response(text, { status: response.status, headers: newHeaders });
  }

  // Handle JavaScript
  if (contentType.includes('javascript') || contentType.includes('json')) {
    let text = await response.text();
    text = rewriteJs(text, targetUrl, workerOrigin, workerPath);
    return new Response(text, { status: response.status, headers: newHeaders });
  }

  // Pass through binary content
  return new Response(response.body, { status: response.status, headers: newHeaders });
}

function rewriteCss(css, targetUrl, workerOrigin, workerPath) {
  const origin = targetUrl.origin;
  
  // Rewrite url() in CSS
  css = css.replace(/url\(['"]?([^'")\s]+)['"]?\)/gi, (match, url) => {
    if (url.startsWith('data:') || url.startsWith('#')) return match;
    try {
      const absolute = new URL(url, origin).href;
      return `url("${workerOrigin}${workerPath}?target=${encodeURIComponent(absolute)}")`;
    } catch (e) {
      return match;
    }
  });

  // Rewrite @import
  css = css.replace(/@import\s+['"]([^'"]+)['"]/gi, (match, url) => {
    try {
      const absolute = new URL(url, origin).href;
      return `@import "${workerOrigin}${workerPath}?target=${encodeURIComponent(absolute)}"`;
    } catch (e) {
      return match;
    }
  });

  return css;
}

function rewriteJs(js, targetUrl, workerOrigin, workerPath) {
  // Don't break minified code - only do safe replacements
  const origin = targetUrl.origin;
  
  // Replace common patterns safely
  js = js.replace(/"(https?:\/\/[^"]+)"/g, (match, url) => {
    if (url.startsWith(origin)) {
      const encoded = encodeURIComponent(url);
      return `"${workerOrigin}${workerPath}?target=${encoded}"`;
    }
    return match;
  });

  return js;
}

function rewriteHtml(html, targetUrl, workerOrigin, workerPath) {
  const origin = targetUrl.origin;
  
  const px = (u) => {
    if (!u || u.startsWith('data:') || u.startsWith('#') || u.startsWith('javascript:') || u.startsWith('blob:') || u.startsWith('about:')) return u;
    try {
      const absolute = new URL(u, origin).href;
      return `${workerOrigin}${workerPath}?target=${encodeURIComponent(absolute)}`;
    } catch(e) { return u; }
  };

  const script = `<script>
(function(){
  const P = '${workerOrigin}${workerPath}';
  const T = '${origin}';
  
  function wrap(u) {
    if(!u || typeof u !== 'string' || u.startsWith(P) || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:')) return u;
    try { 
      const abs = new URL(u, T).href;
      return P + '?target=' + encodeURIComponent(abs); 
    } catch(e) { return u; }
  }

  // Intercept XHR
  const _xhr = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    return _xhr.call(this, method, wrap(url), ...args);
  };

  // Intercept fetch
  const _fetch = window.fetch;
  window.fetch = function(r, i) {
    if (typeof r === 'string') {
      return _fetch(wrap(r), i);
    } else if (r instanceof Request) {
      return _fetch(new Request(wrap(r.url), r), i);
    }
    return _fetch(r, i);
  };

  // Intercept window.open
  const _open = window.open;
  window.open = function(u, n, f) {
    return _open(wrap(u), n, f);
  };

  // Intercept location changes
  const _pushState = history.pushState;
  history.pushState = function(s, t, u) {
    return _pushState.call(history, s, t, wrap(u));
  };

  const _replaceState = history.replaceState;
  history.replaceState = function(s, t, u) {
    return _replaceState.call(history, s, t, wrap(u));
  };

  // Intercept iframe creation
  const _createElement = document.createElement;
  document.createElement = function(tag) {
    const el = _createElement.call(document, tag);
    if (tag.toLowerCase() === 'iframe') {
      const _srcSet = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src').set;
      Object.defineProperty(el, 'src', {
        set: function(v) { _srcSet.call(this, wrap(v)); },
        get: function() { return this.getAttribute('src'); }
      });
    }
    return el;
  };

  // Intercept image loading
  const _Image = window.Image;
  window.Image = function() {
    const img = new _Image();
    const _srcSet = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set;
    Object.defineProperty(img, 'src', {
      set: function(v) { _srcSet.call(this, wrap(v)); },
      get: function() { return this.getAttribute('src'); }
    });
    return img;
  };

  // Intercept form submissions
  document.addEventListener('submit', e => {
    const f = e.target;
    if (f.action && !f.action.includes(P)) {
      e.preventDefault();
      const url = new URL(f.action, T);
      const formData = new FormData(f);
      const params = new URLSearchParams(formData);
      const final = url.origin + url.pathname + (params.toString() ? '?' + params.toString() : '');
      window.location.href = P + '?target=' + encodeURIComponent(final);
    }
  }, true);

  // Service Worker bypass
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register = () => Promise.resolve();
  }
})();
</script>`;

  // Rewrite HTML attributes
  html = html.replace(/(src|href|action|data|poster|background)=["']([^"']+)["']/gi, (m, attr, path) => {
    return `${attr}="${px(path)}"`;
  });

  // Rewrite inline styles with url()
  html = html.replace(/style=["']([^"']*url\([^)]+\)[^"']*)["']/gi, (match, style) => {
    const rewritten = style.replace(/url\(['"]?([^'")\s]+)['"]?\)/gi, (m, url) => {
      return `url("${px(url)}")`;
    });
    return `style="${rewritten}"`;
  });

  // Rewrite srcset
  html = html.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
    const rewritten = srcset.split(',').map(src => {
      const parts = src.trim().split(/\s+/);
      parts[0] = px(parts[0]);
      return parts.join(' ');
    }).join(', ');
    return `srcset="${rewritten}"`;
  });

  // Insert script after <head> or at start of <body>
  if (html.match(/<head[^>]*>/i)) {
    html = html.replace(/<head[^>]*>/i, `$&${script}`);
  } else if (html.match(/<body[^>]*>/i)) {
    html = html.replace(/<body[^>]*>/i, `$&${script}`);
  } else {
    html = script + html;
  }

  return html;
}

async function proxyWebSocket(request, targetUrl) {
  const wsUrl = new URL(targetUrl.href);
  wsUrl.protocol = targetUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  
  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];
  
  server.accept();

  const headers = new Headers(request.headers);
  headers.set('Host', targetUrl.host);
  
  fetch(wsUrl.href, { 
    headers: headers,
    webSocket: true 
  }).then(resp => {
    const ws = resp.webSocket;
    if (ws) {
      ws.accept();
      ws.addEventListener('message', e => {
        try { server.send(e.data); } catch(err) {}
      });
      server.addEventListener('message', e => {
        try { ws.send(e.data); } catch(err) {}
      });
      ws.addEventListener('close', () => server.close());
      server.addEventListener('close', () => ws.close());
    }
  }).catch(err => {
    console.error("WS Error:", err);
    server.close();
  });

  return new Response(null, { status: 101, webSocket: client });
}

function getHomePage(origin) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enhanced Proxy Portal</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 100%;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 28px;
    }
    p {
      color: #666;
      margin-bottom: 30px;
    }
    form {
      display: flex;
      gap: 10px;
    }
    input {
      flex: 1;
      padding: 14px 18px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.3s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      padding: 14px 28px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    button:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Enhanced Proxy Portal</h1>
    <p>Enter any URL to browse securely with advanced bot bypass</p>
    <form action="${origin}/" method="GET">
      <input name="target" placeholder="https://example.com" required>
      <button type="submit">Go</button>
    </form>
  </div>
</body>
</html>`;
}
