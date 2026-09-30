/* Cloudflare Worker: 정적 파일(사이트 전체)을 내보내기 전에 주소를 정리해요.
   1) 대표 도메인(CANONICAL_HOST)이 아닌 주소(www, workers.dev)로 오면 같은 경로의 대표 도메인으로 301
   2) 확장자 없는 경로는 끝에 / 를 붙여 301 (/cocktails/negroni → /cocktails/negroni/)
   나머지는 정적 파일(ASSETS)이 처리해요. 없는 주소는 404.html (wrangler.jsonc의 not_found_handling). */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const host = env.CANONICAL_HOST;
    let moved = false;
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
