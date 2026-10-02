/* Cloudflare Worker: 정적 파일(사이트 전체)을 내보내기 전에 주소를 정리해요.
   0) http 로 오면 https 로 301
   1) 대표 도메인(CANONICAL_HOST)이 아닌 주소(www, workers.dev)로 오면 같은 경로의 대표 도메인으로 301
   2) 확장자 없는 경로는 끝에 / 를 붙여 301 (/cocktails/negroni → /cocktails/negroni/)
   3) POST /api/contact → 문의 메일 전송 (Cloudflare Email Routing, wrangler.jsonc의 send_email)
      /tasting/ · /api/tasting/ → 테이스팅 노트 (worker/tasting.js, D1 · R2)
   4) 모든 응답에 보안 헤더를 붙여요. HTML에는 요청마다 새 nonce로 Content-Security-Policy를 걸고,
      페이지 안의 모든 <script>에 같은 nonce를 넣어요 (secureHtml)
   나머지는 정적 파일(ASSETS)이 처리해요. 없는 주소는 404.html (wrangler.jsonc의 not_found_handling). */
import { EmailMessage } from 'cloudflare:email';
import { handleTasting } from './tasting.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.pathname === '/api/contact') return withSecurity(await contact(request, env), local);
    if (url.pathname.startsWith('/api/tasting/')) return withSecurity(await handleTasting(request, env, url), local);

    const host = env.CANONICAL_HOST;
    let moved = false;
    if (!local && url.protocol === 'http:') { url.protocol = 'https:'; moved = true; }
    if (host && !local && url.hostname !== host) {
      url.protocol = 'https:'; url.hostname = host; url.port = ''; moved = true;
    }
    const last = url.pathname.split('/').pop();
    if (!url.pathname.endsWith('/') && !last.includes('.')) {
      url.pathname += '/'; moved = true;
    }
    if (moved && (request.method === 'GET' || request.method === 'HEAD')) return withSecurity(Response.redirect(url.toString(), 301), local);

    // 테이스팅 노트 공개 페이지 (D1에서 읽어 그려요)
    if (url.pathname.startsWith('/tasting/') || url.pathname === '/sitemap-tasting.xml') {
      const t = await handleTasting(request, env, url);
      if (t) return (t.headers.get('Content-Type') || '').includes('text/html') ? secureHtml(t, local) : withSecurity(t, local);
    }

    // HTML은 요청마다 nonce가 달라서, 브라우저가 예전 HTML을 304로 재사용하면 nonce가 어긋나요.
    // 그래서 HTML 주소는 조건부 요청 헤더를 떼고 항상 새로 받게 해요.
    const htmlPath = url.pathname.endsWith('/') || url.pathname.endsWith('.html');
    let req = request;
    if (htmlPath) {
      const h = new Headers(request.headers);
      h.delete('If-None-Match'); h.delete('If-Modified-Since');
      req = new Request(request, { headers: h });
    }
    const res = await env.ASSETS.fetch(req);
    if ((res.headers.get('Content-Type') || '').includes('text/html')) return secureHtml(res, local);
    return withSecurity(res, local);
  }
};

/* ---------- 보안 헤더 ----------
   CSP는 Google AdSense가 공식 지원하는 nonce 방식을 따라요 (도메인 목록 방식은 광고가 쓰는 주소가
   수시로 바뀌어 광고가 막힐 수 있다고 Google이 안내해요):
     script-src 'nonce-…' 'strict-dynamic' — nonce가 있는 스크립트와 그 스크립트가 불러온 스크립트만 실행
       ('unsafe-inline' https: http: 'unsafe-eval'은 nonce·strict-dynamic을 모르는 옛 브라우저용, AdSense 권장값 그대로)
     object-src 'none', base-uri 'none' — 플러그인·<base> 주입 차단
     frame-ancestors 'self' — 다른 사이트가 이 사이트를 iframe으로 감싸지 못하게
     form-action 'self' — 폼은 이 사이트로만 전송 (문의폼 /api/contact)
   이미지·CSS·글꼴·iframe·fetch 주소는 제한하지 않아요: 광고 소재와 쿠팡 링크가 여러 도메인을 쓰기 때문이에요.
   인라인 onclick·onload 같은 속성은 이 정책에서 막히니 쓰지 말고 addEventListener를 써 주세요. */
const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // 사이트에서 쓰지 않는 기기 권한만 막아요 (광고 측정에 쓰이는 기능은 건드리지 않아요)
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), usb=(), serial=(), hid=(), display-capture=()'
};
function withSecurity(res, local) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(BASE_HEADERS)) out.headers.set(k, v);
  // HSTS는 https 운영 주소에서만 (localhost 개발 서버에는 걸지 않아요)
  if (!local) out.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return out;
}
function secureHtml(res, local) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const csp = [
    "object-src 'none'",
    `script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:`,
    "base-uri 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    ...(local ? [] : ['upgrade-insecure-requests'])
  ].join('; ');
  const out = withSecurity(res, local);
  out.headers.set('Content-Security-Policy', csp);
  out.headers.delete('ETag');
  out.headers.delete('Last-Modified');
  return new HTMLRewriter()
    .on('script', { element(el) { el.setAttribute('nonce', nonce); } })
    .transform(out);
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function contact(request, env) {
  if (request.method !== 'POST') return json(405, { error: 'method' });

  // 다른 사이트에서 이 주소로 폼을 보내는 것을 막아요
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(403, { error: 'origin' });

  let form;
  try { form = await request.formData(); } catch { return json(400, { error: 'form' }); }
  const field = (k, max) => String(form.get(k) ?? '').trim().slice(0, max);

  // 봇만 채우는 숨은 칸에 값이 있으면 성공한 척하고 버려요
  if (field('website', 200)) return json(200, { ok: true });

  const name = field('name', 50).replace(/[\r\n]/g, ' ');
  const email = field('email', 120);
  const topic = field('topic', 40).replace(/[\r\n]/g, ' ');
  const message = field('message', 3000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10 || !form.get('consent')) {
    return json(400, { error: 'invalid' });
  }
  if (!env.MAILER || !env.CONTACT_FROM || !env.CONTACT_TO) return json(503, { error: 'mail-not-configured' });

  const subject = `[Jigger 문의] ${topic} - ${name}`;
  const text = [`이름: ${name}`, `이메일: ${email}`, `유형: ${topic}`, '', message].join('\n');
  const raw = [
    `From: =?UTF-8?B?${b64('Jigger 문의폼')}?= <${env.CONTACT_FROM}>`,
    `To: <${env.CONTACT_TO}>`,
    `Reply-To: <${email}>`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${env.CONTACT_FROM.split('@')[1]}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(text).replace(/.{76}/g, '$&\r\n'),
  ].join('\r\n');

  try {
    await env.MAILER.send(new EmailMessage(env.CONTACT_FROM, env.CONTACT_TO, raw));
  } catch (e) {
    console.error('contact mail failed', e);
    return json(502, { error: 'send' });
  }
  return json(200, { ok: true });
}

function b64(s) {
  let bin = '';
  for (const byte of new TextEncoder().encode(s)) bin += String.fromCharCode(byte);
  return btoa(bin);
}
