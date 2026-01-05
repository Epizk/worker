// ULTRA-STEALTH PROXY V4.0 - COMPLEX URL & GAME FIX
// - Fixes "Invalid Game Source" by preventing double-encoding of query params.
// - Resolves Eaglercraft / Calculus source loading errors.
// - Strips Cloudflare headers and maintains "Sticky" session cookies.

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

async function handleRequest(request) {
  const url = new URL(request.url);
  let target = url.searchParams.get('target');
  const cookieHeader = request.headers.get('Cookie') || '';

  // 1. Session Memory
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

  // 2. Target Normalization (Fixes the %2520 double encoding)
  let targetUrl;
  try {
    // Decode only if it's actually encoded, otherwise use as is
    const decoded = decodeURIComponent(target);
    targetUrl = new URL(decoded.includes('://') ? decoded : target);
  } catch (e) {
    targetUrl = new URL(target);
  }

  if (request.headers.get('Upgrade') === 'websocket') {
    return proxyWebSocket(request, targetUrl);
  }

  const headers = new Headers(request.headers);
  ['cf-connecting-ip', 'cf-ray', 'cf-visitor', 'cf-worker', 'x-forwarded-for', 'x-real-ip', 'cdn-loop'].forEach(h => headers.delete(h));

  headers.set('Host', targetUrl.host);
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    const response = await fetch(new Request(targetUrl.href, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual'
    }));

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const loc = response.headers.get('Location');
      if (loc) {
        const fullLoc = new URL(loc, targetUrl.href).href;
        return Response.redirect(`${url.origin}${url.pathname}?target=${encodeURIComponent(fullLoc)}`, response.status);
      }
    }

    const processedResponse = await processResponse(response, targetUrl, url.origin, url.pathname);
    processedResponse.headers.append('Set-Cookie', `proxy_host=${encodeURIComponent(targetUrl.origin)}; Path=/; HttpOnly; SameSite=Lax`);
    
    return processedResponse;
  } catch (e) {
    return new Response(`Proxy Connection Error: ${e.message}`, { status: 502 });
  }
}

async function processResponse(response, targetUrl, workerOrigin, workerPath) {
  const contentType = response.headers.get('content-type') || '';
  const newHeaders = new Headers(response.headers);

  const setCookie = response.headers.get('Set-Cookie');
  if (setCookie) {
    newHeaders.set('Set-Cookie', setCookie.replace(/Domain=[^;]+;?/gi, '').replace(/Secure;?/gi, ''));
  }

  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.delete('content-security-policy');
  newHeaders.delete('x-frame-options');

  if (contentType.includes('text/html')) {
    let text = await response.text();
    text = rewriteHtml(text, targetUrl, workerOrigin, workerPath);
    return new Response(text, { status: response.status, headers: newHeaders });
  }

  return new Response(response.body, { status: response.status, headers: newHeaders });
}

function rewriteHtml(html, targetUrl, workerOrigin, workerPath) {
  const origin = targetUrl.origin;
  
  const px = (u) => {
    if (!u || u.startsWith('data:') || u.startsWith('#') || u.startsWith('javascript:')) return u;
    try {
      // Use URL constructor to resolve relative paths correctly
      const absolute = new URL(u, origin).href;
      return `${workerOrigin}${workerPath}?target=${encodeURIComponent(absolute)}`;
    } catch(e) { return u; }
  };

  const script = `<script>
  (function(){
    const P = '${workerOrigin}${workerPath}';
    const T = '${origin}';
    
    function wrap(u) {
      if(!u || typeof u !== 'string' || u.startsWith(P) || u.startsWith('data:')) return u;
      try { 
        const abs = new URL(u, window.location.href).href;
        // Logic to prevent proxying specific game asset types if they fail
        if(abs.includes('blob:') || abs.includes('websocket')) return u;
        return P + '?target=' + encodeURIComponent(abs); 
      } catch(e) { return u; }
    }

    // Hijack window.open and internal redirects
    const _open = window.open;
    window.open = (u, n, f) => _open(wrap(u), n, f);

    const _fetch = window.fetch;
    window.fetch = (r, i) => _fetch(typeof r === 'string' ? wrap(r) : r, i);

    // Patch for History API (fixes the URL bar)
    const _ps = history.pushState;
    history.pushState = (s, t, u) => _ps.apply(history, [s, t, wrap(u)]);

    document.addEventListener('submit', e => {
      const f = e.target;
      if (f.action && !f.action.includes(P)) {
        e.preventDefault();
        const url = new URL(f.action, T);
        const sp = new URLSearchParams(new FormData(f));
        const final = url.origin + url.pathname + (sp.toString() ? '?' + sp.toString() : '');
        window.location.href = P + '?target=' + encodeURIComponent(final);
      }
    }, true);
  })();
  </script>`;

  // Regex replacement for static HTML tags
  html = html.replace(/(src|href|action)=["']([^"']+)["']/gi, (m, attr, path) => {
    return `${attr}="${px(path)}"`;
  });

  return html.replace(/<head[^>]*>/i, `$1${script}`);
}

async function proxyWebSocket(request, targetUrl) {
  const wsUrl = new URL(targetUrl.href);
  wsUrl.protocol = targetUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];
  server.accept();
  fetch(wsUrl.href, { headers: request.headers, webSocket: true }).then(resp => {
    const ws = resp.webSocket;
    if (ws) {
      ws.accept();
      ws.addEventListener('message', e => server.send(e.data));
      server.addEventListener('message', e => ws.send(e.data));
    }
  }).catch(err => {
    console.error("WS Error:", err);
  });
  return new Response(null, { status: 101, webSocket: client });
}

function getHomePage(origin) {
  return `<html>
  <head><title>Raw Client</title></head>
  <body>
    <h1>This is the raw client if you are here my sites broken or you like to use the raw worker page, weirdo.</h1>
    <form action="${origin}/" method="GET">
      <input name="target" placeholder="">
      <button>Enter</button>
    </form>
  </body>
  </html>`;
}
