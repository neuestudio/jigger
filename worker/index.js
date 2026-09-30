/* Cloudflare Worker: 정적 파일(사이트 전체)을 내보내기 전에 주소를 정리해요.
   0) http 로 오면 https 로 301
   1) 대표 도메인(CANONICAL_HOST)이 아닌 주소(www, workers.dev)로 오면 같은 경로의 대표 도메인으로 301
   2) 확장자 없는 경로는 끝에 / 를 붙여 301 (/cocktails/negroni → /cocktails/negroni/)
   3) POST /api/contact → 문의 메일 전송 (Cloudflare Email Routing, wrangler.jsonc의 send_email)
   나머지는 정적 파일(ASSETS)이 처리해요. 없는 주소는 404.html (wrangler.jsonc의 not_found_handling). */
import { EmailMessage } from 'cloudflare:email';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') return contact(request, env);

    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
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
    if (moved && (request.method === 'GET' || request.method === 'HEAD')) return Response.redirect(url.toString(), 301);
    return env.ASSETS.fetch(request);
  }
};

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
