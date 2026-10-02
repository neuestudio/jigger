/* 테이스팅 노트: 공개 페이지(서버에서 HTML로 그려요)와 관리자 API
   - GET  /tasting/                 목록 (주종 필터 · 정렬 · 검색은 페이지 안 스크립트)
   - GET  /tasting/<번호>/          리뷰 한 개 (Review 구조화 데이터)
   - GET  /tasting/photo/<파일>     사진 (R2)
   - GET  /sitemap-tasting.xml      공개 리뷰 주소 목록
   - /api/tasting/...               관리자 로그인과 리뷰 쓰기 · 고치기 · 지우기 · 사진 올리기
   데이터: D1(env.DB, migrations/0001_tasting.sql), 사진: R2(env.PHOTOS)
   비밀값: ADMIN_PASSWORD(관리자 비밀번호), SESSION_SECRET(로그인 유지용 서명 키) — wrangler secret put
   페이지 겉모양(머리말 · 메뉴 · 바닥글)은 scripts/build.mjs가 만든 shell.js를 써요. */
import { TYPES, TYPE_BY_KEY, LIMITS } from './tasting-config.js';
import { SHELL } from './shell.js';

const SITE = 'https://jiggerbar.com';
const COOKIE = 'jt_admin';
const SESSION_DAYS = 30;
const LOGIN_WINDOW = 15 * 60 * 1000, LOGIN_MAX = 5;      // 15분 동안 5번 틀리면 잠시 막아요
const PHOTO_MAX = 4 * 1024 * 1024;
const PHOTO_RE = /^[a-f0-9]{24}\.(webp|jpg)$/;
// 주종 → 주류 상식 페이지 (있는 것만 연결)
const SPIRIT_PAGE = {whisky:'whisky', wine:'wine', beer:'beer', soju:'soju', makgeolli:'takju', yakju:'yakju',
  gin:'gin', rum:'rum', vodka:'vodka', tequila:'tequila', brandy:'brandy', liqueur:'liqueur'};

const esc = t => String(t ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g,'\\u003c')}</script>`;
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...headers}});
const smName = name => name.replace(/\.(webp|jpg)$/, '-sm.$1');

/* 이 요청을 테이스팅 노트가 처리하면 Response, 아니면 null */
export async function handleTasting(request, env, url) {
  const p = url.pathname;
  if (p.startsWith('/api/tasting/')) return api(request, env, url);
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  if (p === '/tasting/') return listPage(request, env);
  let m = p.match(/^\/tasting\/(\d{1,9})\/$/);
  if (m) return detailPage(request, env, +m[1]);
  m = p.match(/^\/tasting\/photo\/([a-z0-9.-]+)$/);
  if (m) return photo(env, m[1]);
  if (p === '/sitemap-tasting.xml') return sitemap(env);
  return null;
}

/* ---------- 공개 페이지 ---------- */
function shell({url, title, desc, image, body, head = ''}) {
  const fill = {'@@URL@@':url, '@@TITLE@@':esc(title), '@@DESC@@':esc(desc), '@@IMAGE@@':image, '@@HEAD@@':head, '@@BODY@@':body};
  return SHELL.replace(/@@(URL|TITLE|DESC|IMAGE|HEAD|BODY)@@/g, k => fill[k]);
}
const html = (body, status = 200) => new Response(body, {status, headers:{'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-cache'}});
function fitDesc(t, max = 80) { t = String(t).replace(/\s+/g, ' ').trim(); return t.length <= max ? t : t.slice(0, max - 1) + '…'; }
function crumbs(items) {
  return {
    list: {'@context':'https://schema.org', '@type':'BreadcrumbList',
      itemListElement: items.map(([name, u], i) => ({'@type':'ListItem', position:i + 1, name, item:SITE + u}))},
    nav: `<nav class="crumbs" aria-label="현재 위치">${items.map(([name, u], i) =>
      i < items.length - 1 ? `<a href="${u}">${esc(name)}</a><span aria-hidden="true">›</span>` : `<span aria-current="page">${esc(name)}</span>`).join('')}</nav>`
  };
}
function starsHTML(r, big = false) {
  return `<span class="stars${big ? ' big' : ''}" style="--r:${r}" role="img" aria-label="5점 만점에 ${r}점"></span>`;
}
function typeOf(key) { return TYPE_BY_KEY[key] || TYPE_BY_KEY.other; }
function photoURL(name, sm) { return `/tasting/photo/${sm ? smName(name) : name}`; }
function parse(row) {
  return {...row, tags: safeJSON(row.tags), pairing: safeJSON(row.pairing)};
}
function safeJSON(s) { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
function fmtDate(d) { const [y, m, dd] = d.split('-'); return `${y}.${m}.${dd}`; }
function won(n) { return n.toLocaleString('ko-KR') + '원'; }

function cardHTML(r) {
  const t = typeOf(r.type);
  const thumb = r.photo
    ? `<img src="${photoURL(r.photo, true)}" alt="${esc(r.name)}" width="640" height="640" loading="lazy" decoding="async">`
    : `<span class="tglyph"><b>${r.rating}</b><i>${esc(t.en)}</i></span>`;
  const hay = [r.name, r.name_en, t.ko, t.en, r.subtype, r.producer, r.country, ...r.tags].filter(Boolean).join(' ').toLowerCase();
  return `<a class="card tcard" href="/tasting/${r.id}/" data-type="${r.type}" data-r="${r.rating}" data-d="${r.tasted_on}" data-n="${esc(r.name)}" data-hay="${esc(hay)}">
        <span class="cthumb">${thumb}</span>
        <span class="cbody"><span class="cname">${esc(r.name_en || r.name)}</span><span class="cko">${esc(r.name_en ? r.name : t.ko)}</span>
          <span class="tmeta">${starsHTML(r.rating)}<b>${r.rating}</b><span>${esc(t.ko)}${r.subtype ? ' · ' + esc(r.subtype) : ''}</span></span></span></a>`;
}

async function listPage(request, env) {
  const {results} = await env.DB.prepare(
    'SELECT id, name, name_en, type, subtype, producer, country, rating, tasted_on, tags, photo FROM reviews WHERE published = 1 ORDER BY tasted_on DESC, id DESC'
  ).all();
  const rows = results.map(parse);
  const counts = {};
  for (const r of rows) counts[r.type] = (counts[r.type] || 0) + 1;
  const avg = rows.length ? (rows.reduce((a, r) => a + r.rating, 0) / rows.length).toFixed(1) : null;
  const c = crumbs([['Jigger', '/'], ['테이스팅 노트', '/tasting/']]);
  const chips = [`<button class="chip" type="button" data-v="all" aria-pressed="true">전체<span class="n">${rows.length}</span></button>`,
    ...TYPES.filter(t => counts[t.key]).map(t => `<button class="chip" type="button" data-v="${t.key}" aria-pressed="false">${esc(t.ko)}<span class="n">${counts[t.key]}</span></button>`)].join('');
  const body = `    ${c.nav}
    <section class="hero">
      <span class="eyebrow">Tasting Notes · 마셔 본 술 기록</span>
      <h1>테이스팅 노트</h1>
      <p class="lead">직접 마셔 본 술의 평점과 리뷰를 기록해요. 위스키 · 와인 · 맥주부터 막걸리 · 사케까지, 주종별로 모아 보고 평점순으로 골라 보세요.</p>
      ${rows.length ? `<p class="tstats"><span>기록 <b>${rows.length}</b>개</span><span>평균 평점 <b>${avg}</b></span><span>주종 <b>${Object.keys(counts).length}</b>가지</span></p>` : ''}
      <div class="ctas"><a class="cta" href="/tasting/my/">나도 기록해 보기 →</a></div>
    </section>
    <section class="sec">
      <div class="sec-h"><h2>주종별로 보기</h2><span class="prog" id="tStatus" role="status" aria-live="polite">전체 ${rows.length}개</span></div>
      ${rows.length ? `<div class="tctl">
        <div class="field"><label for="tQ">검색</label><input id="tQ" type="search" placeholder="이름, 생산자, 맛 태그로 검색" autocomplete="off"></div>
        <div class="field"><label for="tSort">정렬</label><select id="tSort"><option value="date">최근에 마신 순</option><option value="rating">평점 높은 순</option><option value="rating-asc">평점 낮은 순</option><option value="name">이름순</option></select></div>
      </div>
      <div class="chips" id="tChips" role="group" aria-label="주종">${chips}</div>
      <div class="cards" id="tCards">${rows.map(cardHTML).join('')}</div>
      <p class="note" id="tEmpty" hidden>조건에 맞는 기록이 없어요.</p>` : '<p class="lead">아직 공개한 기록이 없어요. 곧 채워질 예정이에요.</p>'}
    </section>
    <script>
    /* 주종 칩 · 검색 · 정렬 (주소 #주종 으로 바로 열 수 있어요) */
    (function(){
      var box = document.getElementById('tCards'); if (!box) return;
      var cards = [].slice.call(box.children), chips = document.querySelectorAll('#tChips .chip');
      var q = document.getElementById('tQ'), sort = document.getElementById('tSort'), st = document.getElementById('tStatus'), empty = document.getElementById('tEmpty');
      var type = 'all';
      function apply(){
        var term = q.value.trim().toLowerCase(), n = 0, label = 'all';
        chips.forEach(function(c){ var on = c.dataset.v === type; c.setAttribute('aria-pressed', String(on)); if (on) label = c.firstChild.textContent; });
        var s = sort.value;
        cards.sort(function(a, b){
          if (s === 'rating') return b.dataset.r - a.dataset.r || (a.dataset.d < b.dataset.d ? 1 : -1);
          if (s === 'rating-asc') return a.dataset.r - b.dataset.r || (a.dataset.d < b.dataset.d ? 1 : -1);
          if (s === 'name') return a.dataset.n.localeCompare(b.dataset.n, 'ko');
          return a.dataset.d < b.dataset.d ? 1 : a.dataset.d > b.dataset.d ? -1 : 0;
        }).forEach(function(c){
          var show = (type === 'all' || c.dataset.type === type) && (!term || c.dataset.hay.indexOf(term) >= 0);
          c.hidden = !show; if (show) n++; box.appendChild(c);
        });
        st.textContent = (type === 'all' ? '전체 ' : label + ' ') + n + '개' + (term ? ' · ‘' + q.value.trim() + '’ 검색' : '');
        empty.hidden = n > 0;
      }
      function fromHash(){ var h = decodeURIComponent(location.hash.slice(1)); type = document.querySelector('#tChips [data-v="' + h + '"]') ? h : 'all'; apply(); }
      document.getElementById('tChips').addEventListener('click', function(e){
        var c = e.target.closest('.chip'); if (!c) return;
        type = c.dataset.v; history.replaceState(null, '', type === 'all' ? location.pathname : '#' + type); apply();
      });
      q.addEventListener('input', apply); sort.addEventListener('change', apply);
      addEventListener('hashchange', fromHash); fromHash();
    })();
    </script>`;
  const items = {'@context':'https://schema.org', '@type':'ItemList', name:'테이스팅 노트',
    itemListElement: rows.slice(0, 100).map((r, i) => ({'@type':'ListItem', position:i + 1, url:`${SITE}/tasting/${r.id}/`, name:r.name}))};
  return html(shell({url:'/tasting/', title:'테이스팅 노트 · 직접 마셔 본 술 평점과 리뷰 | Jigger',
    desc:'위스키, 와인, 맥주, 막걸리, 사케까지 직접 마셔 본 술의 평점과 테이스팅 노트를 주종별로 모았어요.',
    image:`${SITE}/og.jpg`, body, head:[c.list, ...(rows.length ? [items] : [])].map(ld).join('\n')}));
}

function paras(t) {
  return String(t).trim().split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

async function detailPage(request, env, id) {
  const row = await env.DB.prepare('SELECT * FROM reviews WHERE id = ?').bind(id).first();
  const admin = row && !row.published ? await isAdmin(request, env) : false;
  if (!row || (!row.published && !admin)) return notFound(request, env);
  const r = parse(row), t = typeOf(r.type);
  const {results: more} = await env.DB.prepare(
    'SELECT id, name, name_en, type, subtype, producer, country, rating, tasted_on, tags, photo FROM reviews WHERE published = 1 AND type = ? AND id != ? ORDER BY tasted_on DESC LIMIT 4'
  ).bind(r.type, r.id).all();
  const c = crumbs([['Jigger', '/'], ['테이스팅 노트', '/tasting/'], [r.name, `/tasting/${r.id}/`]]);
  const spirit = SPIRIT_PAGE[r.type];
  const spec = [
    ['주종', spirit ? `<a href="/spirits/${spirit}/">${esc(t.ko)}</a>` : esc(t.ko)],
    r.subtype && ['세부 종류', esc(r.subtype)],
    r.producer && ['생산자', esc(r.producer)],
    r.country && ['나라 · 지역', esc(r.country)],
    r.abv != null && ['도수', `${r.abv}%`],
    r.price != null && ['가격', won(r.price)],
    ['마신 날', fmtDate(r.tasted_on)]
  ].filter(Boolean);
  const notes = [['향', 'Nose', r.nose], ['맛', 'Palate', r.palate], ['여운', 'Finish', r.finish]].filter(x => x[2]);
  const media = r.photo
    ? `<img src="${photoURL(r.photo)}" alt="${esc(r.name)}" width="1000" height="1000" fetchpriority="high">`
    : `<span class="tglyph big"><b>${r.rating}</b><i>${esc(t.en)}</i></span>`;
  const body = `    ${c.nav}
    ${r.published ? '' : '<p class="tdraft" role="note">비공개 기록이에요. 관리자에게만 보여요.</p>'}
    <article class="item">
      <div class="media">${media}</div>
      <div class="body">
        <span class="eyebrow">${esc(t.en)} · ${esc(t.ko)}${r.subtype ? ' · ' + esc(r.subtype) : ''}</span>
        <h1 class="title"><span class="en">${esc(r.name_en || r.name)}</span>${r.name_en ? ` <span class="ko">${esc(r.name)}</span>` : ''}</h1>
        <p class="trate">${starsHTML(r.rating, true)}<b>${r.rating}</b><span>/ 5</span></p>
        ${r.tags.length ? `<div class="tags">${r.tags.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}
        <dl class="spec">${spec.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <section class="sec">
          <div class="sec-h"><h2>리뷰</h2><span class="prog">${fmtDate(r.tasted_on)}</span></div>
          <div class="treview">${paras(r.review)}</div>
        </section>
        ${notes.length ? `<section class="sec">
          <div class="sec-h"><h2>테이스팅 노트</h2></div>
          <ul class="subtypes">${notes.map(([ko, en, v]) => `<li><b>${ko} · ${en}</b>${esc(v)}</li>`).join('')}</ul>
        </section>` : ''}
        ${r.pairing.length ? `<section class="sec">
          <div class="sec-h"><h2>함께 먹은 안주</h2></div>
          <ul class="alllinks">${r.pairing.map(f => `<li><a href="/food/${esc(f.id)}/">${esc(f.ko)}</a></li>`).join('')}</ul>
        </section>` : ''}
      </div>
    </article>
    ${more.length ? `<section class="more">
      <div class="sec-h"><h2>${esc(t.ko)} 기록 더 보기</h2><a class="prog" href="/tasting/#${r.type}">전체 보기 →</a></div>
      <div class="cards">${more.map(x => cardHTML(parse(x))).join('')}</div>
    </section>` : ''}
    <div class="ctas"><a class="cta" href="/tasting/">테이스팅 노트 전체 보기 →</a></div>`;
  const image = r.photo ? SITE + photoURL(r.photo) : `${SITE}/og.jpg`;
  const review = {'@context':'https://schema.org', '@type':'Review',
    name:`${r.name} 테이스팅 노트`,
    itemReviewed:{'@type':'Product', name: r.name_en ? `${r.name} (${r.name_en})` : r.name, ...(r.photo ? {image} : {}),
      ...(r.producer ? {brand:{'@type':'Brand', name:r.producer}} : {})},
    reviewRating:{'@type':'Rating', ratingValue:r.rating, bestRating:5, worstRating:0.5},
    author:{'@type':'Organization', name:'Jigger', url:`${SITE}/`},
    datePublished:r.created_at.slice(0, 10), reviewBody:fitDesc(r.review, 500)};
  const head = [c.list, review].map(ld).join('\n') + (r.published ? '' : '\n<meta name="robots" content="noindex">');
  return html(shell({url:`/tasting/${r.id}/`,
    title:`${r.name}${r.name_en ? ` (${r.name_en})` : ''} 리뷰 · 평점 ${r.rating} | Jigger`,
    desc:fitDesc(`${r.name} 테이스팅 노트, 평점 ${r.rating}/5. ${r.review}`), image, body, head}));
}

async function notFound(request, env) {
  // 정적 404 페이지 (wrangler.jsonc의 not_found_handling)
  const res = await env.ASSETS.fetch(new Request(new URL('/__tasting-not-found__/', request.url)));
  return new Response(res.body, {status:404, headers:res.headers});
}

async function photo(env, name) {
  if (!env.PHOTOS || !/^[a-f0-9]{24}(-sm)?\.(webp|jpg)$/.test(name)) return new Response('Not found', {status:404});
  const obj = await env.PHOTOS.get(name);
  if (!obj) return new Response('Not found', {status:404});
  return new Response(obj.body, {headers:{
    'Content-Type': obj.httpMetadata?.contentType || 'image/webp',
    'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': obj.httpEtag}});
}

async function sitemap(env) {
  const {results} = await env.DB.prepare('SELECT id, updated_at FROM reviews WHERE published = 1 ORDER BY id').all();
  const urls = results.map(r => `  <url><loc>${SITE}/tasting/${r.id}/</loc><lastmod>${r.updated_at.slice(0, 10)}</lastmod></url>`);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    {headers:{'Content-Type':'application/xml; charset=utf-8', 'Cache-Control':'public, max-age=3600'}});
}

/* ---------- 관리자 로그인 ---------- */
const enc = new TextEncoder();
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sign(env, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(`${env.SESSION_SECRET}|${env.ADMIN_PASSWORD}`), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
async function sameText(a, b) {
  // 길이가 달라도 시간 차이가 나지 않게 해시끼리 비교해요
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  return crypto.subtle.timingSafeEqual(x, y);
}
function cookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : '';
}
async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return false;
  const [exp, sig] = cookie(request, COOKIE).split('.');
  if (!exp || !sig || !(+exp > Date.now())) return false;
  return sameText(sig, await sign(env, `admin.${exp}`));
}
function sessionCookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

/* ---------- API ---------- */
async function api(request, env, url) {
  const p = url.pathname.replace(/\/$/, ''), method = request.method;
  // 다른 사이트에서 보내는 요청 차단 (쓰기 요청은 Origin이 반드시 같아야 해요)
  if (method !== 'GET') {
    const origin = request.headers.get('Origin');
    if (!origin || new URL(origin).host !== url.host) return json(403, {error:'origin'});
  }
  if (!env.DB) return json(503, {error:'db-not-configured'});

  if (p === '/api/tasting/login' && method === 'POST') return login(request, env);
  if (p === '/api/tasting/logout' && method === 'POST') return json(200, {ok:true}, {'Set-Cookie':sessionCookie('', 0)});
  if (p === '/api/tasting/me' && method === 'GET') return json(200, {admin:await isAdmin(request, env), photos:!!env.PHOTOS});

  if (!(await isAdmin(request, env))) return json(401, {error:'login'});

  if (p === '/api/tasting/reviews' && method === 'GET') {
    const {results} = await env.DB.prepare('SELECT * FROM reviews ORDER BY tasted_on DESC, id DESC').all();
    return json(200, {reviews:results.map(parse)});
  }
  if (p === '/api/tasting/reviews' && method === 'POST') {
    const v = await readReview(request); if (v.error) return json(400, v);
    const now = new Date().toISOString(), d = v.data;
    const row = await env.DB.prepare(`INSERT INTO reviews (name, name_en, type, subtype, producer, country, abv, price, rating, tasted_on, nose, palate, finish, tags, review, pairing, photo, published, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`)
      .bind(d.name, d.name_en, d.type, d.subtype, d.producer, d.country, d.abv, d.price, d.rating, d.tasted_on, d.nose, d.palate, d.finish,
        JSON.stringify(d.tags), d.review, JSON.stringify(d.pairing), d.photo, d.published, now, now).first();
    return json(200, {ok:true, id:row.id});
  }
  let m = p.match(/^\/api\/tasting\/reviews\/(\d{1,9})$/);
  if (m && method === 'PUT') {
    const old = await env.DB.prepare('SELECT photo FROM reviews WHERE id = ?').bind(+m[1]).first();
    if (!old) return json(404, {error:'not-found'});
    const v = await readReview(request); if (v.error) return json(400, v);
    const d = v.data;
    await env.DB.prepare(`UPDATE reviews SET name=?, name_en=?, type=?, subtype=?, producer=?, country=?, abv=?, price=?, rating=?, tasted_on=?, nose=?, palate=?, finish=?, tags=?, review=?, pairing=?, photo=?, published=?, updated_at=? WHERE id=?`)
      .bind(d.name, d.name_en, d.type, d.subtype, d.producer, d.country, d.abv, d.price, d.rating, d.tasted_on, d.nose, d.palate, d.finish,
        JSON.stringify(d.tags), d.review, JSON.stringify(d.pairing), d.photo, d.published, new Date().toISOString(), +m[1]).run();
    if (old.photo && old.photo !== d.photo) await removePhoto(env, old.photo);
    return json(200, {ok:true, id:+m[1]});
  }
  if (m && method === 'DELETE') {
    const old = await env.DB.prepare('SELECT photo FROM reviews WHERE id = ?').bind(+m[1]).first();
    if (!old) return json(404, {error:'not-found'});
    await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(+m[1]).run();
    if (old.photo) await removePhoto(env, old.photo);
    return json(200, {ok:true});
  }
  if (p === '/api/tasting/photo' && method === 'POST') return uploadPhoto(request, env);
  m = p.match(/^\/api\/tasting\/photo\/([a-f0-9]{24}\.(?:webp|jpg))$/);
  if (m && method === 'DELETE') {
    // 저장하지 않고 버린 사진 정리용: 어떤 기록에도 쓰이지 않을 때만 지워요
    const used = await env.DB.prepare('SELECT 1 FROM reviews WHERE photo = ?').bind(m[1]).first();
    if (!used) await removePhoto(env, m[1]);
    return json(200, {ok:true});
  }
  return json(404, {error:'not-found'});
}

async function login(request, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json(503, {error:'not-configured'});
  const ip = request.headers.get('CF-Connecting-IP') || 'local', now = Date.now();
  await env.DB.prepare('DELETE FROM login_attempts WHERE at < ?').bind(now - 24 * 3600 * 1000).run();
  const {n} = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND at > ?').bind(ip, now - LOGIN_WINDOW).first();
  if (n >= LOGIN_MAX) return json(429, {error:'too-many'});
  let body; try { body = await request.json(); } catch { return json(400, {error:'form'}); }
  const pw = String(body?.password ?? '').slice(0, 200);
  if (!pw || !(await sameText(pw, env.ADMIN_PASSWORD))) {
    await env.DB.prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)').bind(ip, now).run();
    return json(401, {error:'wrong', left:Math.max(0, LOGIN_MAX - n - 1)});
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
  const exp = now + SESSION_DAYS * 86400 * 1000;
  return json(200, {ok:true}, {'Set-Cookie':sessionCookie(`${exp}.${await sign(env, `admin.${exp}`)}`, SESSION_DAYS * 86400)});
}

async function uploadPhoto(request, env) {
  if (!env.PHOTOS) return json(503, {error:'photos-not-configured'});
  let form; try { form = await request.formData(); } catch { return json(400, {error:'form'}); }
  const full = form.get('full'), sm = form.get('sm');
  const ok = f => f && typeof f === 'object' && f.size > 0 && f.size <= PHOTO_MAX && /^image\/(webp|jpeg)$/.test(f.type);
  if (!ok(full) || !ok(sm) || full.type !== sm.type) return json(400, {error:'photo'});
  const ext = full.type === 'image/webp' ? 'webp' : 'jpg';
  const name = `${[...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('')}.${ext}`;
  const meta = {httpMetadata:{contentType:full.type}};
  await Promise.all([env.PHOTOS.put(name, full.stream(), meta), env.PHOTOS.put(smName(name), sm.stream(), meta)]);
  return json(200, {ok:true, photo:name});
}
async function removePhoto(env, name) {
  if (env.PHOTOS && PHOTO_RE.test(name)) await env.PHOTOS.delete([name, smName(name)]);
}

/* 입력값 검사: 화면에서도 막지만 서버에서 한 번 더 확인해요 */
async function readReview(request) {
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return {error:'json'};
  let b; try { b = await request.json(); } catch { return {error:'json'}; }
  const str = (k, max, need) => {
    const v = String(b[k] ?? '').trim();
    if (need && !v) throw `${k}-required`;
    if (v.length > max) throw `${k}-too-long`;
    return v || null;
  };
  const num = (k, min, max, int) => {
    if (b[k] === '' || b[k] == null) return null;
    const v = Number(b[k]);
    if (!Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) throw `${k}-range`;
    return v;
  };
  try {
    const type = String(b.type || '');
    if (!TYPE_BY_KEY[type]) throw 'type';
    const rating = Number(b.rating);
    if (!(rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2))) throw 'rating';
    const tasted = String(b.tasted_on || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tasted) || isNaN(Date.parse(tasted)) || tasted < '1900-01-01' || Date.parse(tasted) > Date.now() + 2 * 86400000) throw 'tasted_on';
    const tags = Array.isArray(b.tags) ? [...new Set(b.tags.map(t => String(t).trim()).filter(Boolean))] : [];
    if (tags.length > LIMITS.tags || tags.some(t => t.length > LIMITS.tag)) throw 'tags';
    const pairing = Array.isArray(b.pairing) ? b.pairing : [];
    if (pairing.length > LIMITS.pairing || pairing.some(f => !/^[a-z0-9-]{1,40}$/.test(f?.id) || !f.ko || String(f.ko).length > 40)) throw 'pairing';
    const photo = b.photo ? String(b.photo) : null;
    if (photo && !PHOTO_RE.test(photo)) throw 'photo';
    return {data:{
      name:str('name', LIMITS.name, true), name_en:str('name_en', LIMITS.name_en), type,
      subtype:str('subtype', LIMITS.subtype), producer:str('producer', LIMITS.producer), country:str('country', LIMITS.country),
      abv:num('abv', 0, 100), price:num('price', 0, 100000000, true), rating, tasted_on:tasted,
      nose:str('nose', LIMITS.note), palate:str('palate', LIMITS.note), finish:str('finish', LIMITS.note),
      tags, review:str('review', LIMITS.review, true), pairing:pairing.map(f => ({id:f.id, ko:String(f.ko)})),
      photo, published:b.published === false ? 0 : 1
    }};
  } catch (e) { return {error:typeof e === 'string' ? e : 'invalid'}; }
}

