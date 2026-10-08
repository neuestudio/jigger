/* 테이스팅 노트: 술(drinks) 하나에 여러 사람이 닉네임으로 리뷰(reviews)를 남겨요.
   공개 페이지(서버에서 HTML로 그려요)
   - GET  /tasting/                 술 목록 (술 하나당 한 줄, 평균 평점 · 리뷰 수)
   - GET  /tasting/?by=<닉네임>     그 닉네임의 리뷰 모아 보기 (검색 노출 안 함)
   - GET  /tasting/<번호>/          술 한 개: 평균 · 분포 · 자주 고른 향/맛/여운 · 닉네임별 리뷰 · 리뷰 쓰기
   - GET  /tasting/photo/<파일>     사진 (R2, 연결돼 있을 때만)
   - GET  /sitemap-tasting.xml
   API (/api/tasting/...)
   - 방문자: 리뷰 쓰기 · 자기 리뷰 고치기/지우기(쓸 때 받은 토큰으로)
   - 관리자: 로그인, 술 등록 · 수정 · 삭제, 리뷰 숨기기 · 지우기, 사진 올리기
   데이터: D1(env.DB, migrations/), 사진: R2(env.PHOTOS, 없으면 사진 기능만 꺼져요)
   비밀값: ADMIN_PASSWORD, SESSION_SECRET — wrangler secret put
   페이지 겉모양은 scripts/build.mjs가 만든 shell.js를 써요. */
import { TYPES, TYPE_BY_KEY, NOTE_PARTS, NICK_RE, RESERVED_NICKS, OWNER_NICKS, LIMITS } from './tasting-config.js';
import { SHELL } from './shell.js';

const SITE = 'https://jiggerbar.com';
const COOKIE = 'jt_admin';
const SESSION_DAYS = 30;
const LOGIN_WINDOW = 15 * 60 * 1000, LOGIN_MAX = 5;     // 관리자 로그인: 15분에 5번 틀리면 잠시 막아요
const POST_HOUR = 5, POST_DAY = 20;                     // 방문자 리뷰: 같은 IP에서 1시간 5개, 하루 20개까지
const PHOTO_MAX = 4 * 1024 * 1024;
const PHOTO_RE = /^[a-f0-9]{24}\.(webp|jpg)$/;
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|kr|io|co|me|xyz|info|shop|site)\b)/i;
// 주종 → 주류 상식 페이지
const SPIRIT_PAGE = {whisky:'whisky', wine:'wine', beer:'beer', soju:'soju', makgeolli:'takju', yakju:'yakju',
  gin:'gin', rum:'rum', vodka:'vodka', tequila:'tequila', brandy:'brandy', liqueur:'liqueur'};

const esc = t => String(t ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g,'\\u003c')}</script>`;
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...headers}});
const smName = name => name.replace(/\.(webp|jpg)$/, '-sm.$1');
const arr = s => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

export async function handleTasting(request, env, url) {
  const p = url.pathname;
  if (p.startsWith('/api/tasting/')) return api(request, env, url);
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  if (p === '/tasting/') return url.searchParams.get('by') ? nickPage(env, url.searchParams.get('by')) : listPage(env);
  let m = p.match(/^\/tasting\/(\d{1,9})\/$/);
  if (m) return drinkPage(request, env, +m[1]);
  m = p.match(/^\/tasting\/photo\/([a-z0-9.-]+)$/);
  if (m) return photo(env, m[1]);
  if (p === '/sitemap-tasting.xml') return sitemap(env);
  return null;
}

/* ---------- 공통 그리기 ---------- */
function shell({url, title, desc, image, body, head = ''}) {
  const fill = {'@@URL@@':url, '@@TITLE@@':esc(title), '@@DESC@@':esc(desc), '@@IMAGE@@':image, '@@HEAD@@':head, '@@BODY@@':body};
  return SHELL.replace(/@@(URL|TITLE|DESC|IMAGE|HEAD|BODY)@@/g, k => fill[k]);
}
const html = (body, status = 200) => new Response(body, {status, headers:{'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-cache'}});
// 제목은 네이버 권장대로 40자 안으로: 40자 안에 드는 첫 후보를 써요
const fitTitle = (...c) => c.find(t => t.length <= 40) || c[c.length - 1];
const fitDesc = (t, max = 80) => { t = String(t).replace(/\s+/g, ' ').trim(); return t.length <= max ? t : t.slice(0, max - 1) + '…'; };
function crumbs(items) {
  return {
    list: {'@context':'https://schema.org', '@type':'BreadcrumbList',
      itemListElement: items.map(([name, u], i) => ({'@type':'ListItem', position:i + 1, name, item:SITE + u}))},
    nav: `<nav class="crumbs" aria-label="현재 위치">${items.map(([name, u], i) =>
      i < items.length - 1 ? `<a href="${u}">${esc(name)}</a><span aria-hidden="true">›</span>` : `<span aria-current="page">${esc(name)}</span>`).join('')}</nav>`
  };
}
const starsHTML = (r, size = '') => `<span class="stars${size ? ' ' + size : ''}" style="--r:${r}" role="img" aria-label="5점 만점에 ${r}점"></span>`;
const typeOf = key => TYPE_BY_KEY[key] || TYPE_BY_KEY.other;
const photoURL = (name, sm) => `/tasting/photo/${sm ? smName(name) : name}`;
const fmtDate = d => d ? String(d).replace(/-/g, '.') : '날짜 미상';
const scoreHTML = r => r == null ? '<span class="tnone">평점 없음</span>' : `${starsHTML(r)}<b>${r}</b>`;
const won = n => n.toLocaleString('ko-KR') + '원';
const avg1 = (sum, n) => n ? Math.round(sum / n * 10) / 10 : null;
const nickURL = n => `/tasting/?by=${encodeURIComponent(n)}`;
const nickHTML = (n, admin) => `<a class="tnick" href="${nickURL(n)}">${esc(n)}</a>${admin ? '<span class="tbadge">운영자</span>' : ''}`;
const paras = t => String(t).trim().split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
function nameCell(d) {
  return `<a class="tname" href="/tasting/${d.id}/"><b>${esc(d.name_en || d.name)}</b>${d.name_en ? `<span>${esc(d.name)}</span>` : ''}</a>`;
}

/* ---------- 목록: 술 하나당 한 줄 ---------- */
async function listPage(env) {
  const {results} = await env.DB.prepare(`
    SELECT d.id, d.name, d.name_en, d.type, d.subtype, d.producer, d.country, d.price,
      COUNT(r.rating) AS n, COUNT(r.id) AS rc, SUM(r.rating) AS sum, MAX(r.tasted_on) AS last,
      (SELECT json_group_array(nickname) FROM (SELECT DISTINCT nickname FROM reviews WHERE drink_id = d.id AND status = 'published')) AS nicks,
      (SELECT review FROM reviews WHERE drink_id = d.id AND status = 'published' ORDER BY tasted_on DESC NULLS LAST, id DESC LIMIT 1) AS latest
    FROM drinks d LEFT JOIN reviews r ON r.drink_id = d.id AND r.status = 'published'
    WHERE d.published = 1 GROUP BY d.id ORDER BY last DESC NULLS LAST, d.id DESC`).all();
  const rows = results.map(d => ({...d, avg:avg1(d.sum, d.n), nicks:arr(d.nicks)}));
  const total = rows.reduce((a, d) => a + d.rc, 0), rated = rows.reduce((a, d) => a + d.n, 0), sum = rows.reduce((a, d) => a + (d.sum || 0), 0);
  const people = new Set(rows.flatMap(d => d.nicks)).size;
  const counts = {};
  for (const d of rows) counts[d.type] = (counts[d.type] || 0) + 1;
  const c = crumbs([['지거바', '/'], ['테이스팅 노트', '/tasting/']]);
  const chips = [`<button class="chip" type="button" data-v="all" aria-pressed="true">전체<span class="n">${rows.length}</span></button>`,
    ...TYPES.filter(t => counts[t.key]).map(t => `<button class="chip" type="button" data-v="${t.key}" aria-pressed="false">${esc(t.ko)}<span class="n">${counts[t.key]}</span></button>`)].join('');
  const tr = d => {
    const t = typeOf(d.type), more = d.nicks.length - 3;
    const hay = [d.name, d.name_en, t.ko, t.en, d.subtype, d.producer, d.country, ...d.nicks].filter(Boolean).join(' ').toLowerCase();
    return `<tr data-type="${d.type}" data-avg="${d.avg ?? 0}" data-n="${d.n}" data-last="${d.last || ''}" data-name="${esc(d.name)}" data-hay="${esc(hay)}">
          <th scope="row">${nameCell(d)}<span class="tmob">${d.n ? `${starsHTML(d.avg)} <b>${d.avg.toFixed(1)}</b> ${d.n}명 · ` : d.rc ? '평점 없음 · ' : '리뷰 없음 · '}${esc(t.ko)}${d.country ? ' · ' + esc(d.country) : ''}</span></th>
          <td><span class="ttype">${esc(t.ko)}</span></td>
          <td>${esc(d.subtype || '')}</td>
          <td>${esc(d.country || '')}</td>
          <td class="tavg">${d.n ? `${starsHTML(d.avg)}<b>${d.avg.toFixed(1)}</b><span>${d.n}명</span>` : `<span class="tnone">${d.rc ? '평점 없음' : '리뷰 없음'}</span>`}</td>
          <td class="tnum">${d.price != null ? won(d.price) : ''}</td>
          <td>${d.nicks.slice(0, 3).map(n => `<a class="tnick" href="${nickURL(n)}">${esc(n)}</a>`).join(' ')}${more > 0 ? ` <span class="tmore-n">외 ${more}명</span>` : ''}</td>
          <td class="tsnip">${d.latest ? esc(fitDesc(d.latest, 70)) : ''}</td>
        </tr>`;
  };
  const body = `    ${c.nav}
    <section class="hero">
      <span class="eyebrow">Tasting Notes · 마셔 본 술 기록</span>
      <h1>테이스팅 노트</h1>
      <p class="lead">함께 마셔 본 술의 평점과 리뷰를 모았어요. 술마다 여러 사람의 평점을 평균 내고, 누가 어떻게 마셨는지 닉네임별로 볼 수 있어요. 마셔 본 술이 있다면 리뷰를 남겨 주세요.</p>
      ${rows.length ? `<p class="tstats"><span>술 <b>${rows.length}</b>가지</span><span>리뷰 <b>${total}</b>개</span><span>참여 <b>${people}</b>명</span>${rated ? `<span>전체 평균 <b>${(sum / rated).toFixed(1)}</b></span>` : ''}</p>` : ''}
      <div class="ctas"><a class="cta" href="/tasting/my/">나만의 기록장 쓰기 →</a></div>
    </section>
    <section class="sec">
      <div class="sec-h"><h2>술 목록</h2><span class="prog" id="tStatus" role="status" aria-live="polite">전체 ${rows.length}가지</span></div>
      ${rows.length ? `<div class="tctl">
        <div class="field"><label for="tQ">검색</label><input id="tQ" type="search" placeholder="이름, 원산지, 닉네임으로 검색" autocomplete="off"></div>
        <div class="field"><label for="tSort">정렬</label><select id="tSort"><option value="last">최근 리뷰 순</option><option value="avg">평균 평점 높은 순</option><option value="n">리뷰 많은 순</option><option value="name">이름순</option></select></div>
      </div>
      <div class="chips" id="tChips" role="group" aria-label="주종">${chips}</div>
      <div class="twrap"><table class="ttable tresp" id="tTable">
        <thead><tr><th scope="col">이름</th><th scope="col">주종</th><th scope="col">품종 · 세부</th><th scope="col">원산지</th><th scope="col">평균 평점</th><th scope="col">가격</th><th scope="col">리뷰한 사람</th><th scope="col">최근 리뷰</th></tr></thead>
        <tbody>${rows.map(tr).join('')}</tbody>
      </table></div>
      <p class="note" id="tEmpty" hidden>조건에 맞는 술이 없어요.</p>` : '<p class="lead">아직 등록된 술이 없어요. 곧 채워질 예정이에요.</p>'}
    </section>
    <script>
    /* 주종 칩 · 검색 · 정렬 (주소 #주종 으로 바로 열 수 있어요) */
    (function(){
      var tb = document.querySelector('#tTable tbody'); if (!tb) return;
      var rows = [].slice.call(tb.rows), chips = document.querySelectorAll('#tChips .chip');
      var q = document.getElementById('tQ'), sort = document.getElementById('tSort'), st = document.getElementById('tStatus'), empty = document.getElementById('tEmpty');
      var type = 'all';
      function apply(){
        var term = q.value.trim().toLowerCase(), n = 0, label = '';
        chips.forEach(function(c){ var on = c.dataset.v === type; c.setAttribute('aria-pressed', String(on)); if (on) label = c.firstChild.textContent; });
        var s = sort.value;
        rows.sort(function(a, b){
          var A = a.dataset, B = b.dataset;
          if (s === 'avg') return B.avg - A.avg || B.n - A.n;
          if (s === 'n') return B.n - A.n || B.avg - A.avg;
          if (s === 'name') return A.name.localeCompare(B.name, 'ko');
          return A.last < B.last ? 1 : A.last > B.last ? -1 : 0;
        }).forEach(function(r){
          var show = (type === 'all' || r.dataset.type === type) && (!term || r.dataset.hay.indexOf(term) >= 0);
          r.hidden = !show; if (show) n++; tb.appendChild(r);
        });
        st.textContent = (type === 'all' ? '전체 ' : label + ' ') + n + '가지' + (term ? ' · ‘' + q.value.trim() + '’ 검색' : '');
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
    itemListElement: rows.slice(0, 100).map((d, i) => ({'@type':'ListItem', position:i + 1, url:`${SITE}/tasting/${d.id}/`, name:d.name}))};
  return html(shell({url:'/tasting/', title:'테이스팅 노트 · 마셔 본 술 평점과 리뷰 | 지거바',
    desc:'위스키, 와인, 맥주, 막걸리, 사케까지 직접 마셔 본 술의 평균 평점과 닉네임별 리뷰를 모았어요.',
    image:`${SITE}/og.jpg`, body, head:[c.list, ...(rows.length ? [items] : [])].map(ld).join('\n')}));
}

/* ---------- 닉네임별 리뷰 ---------- */
async function nickPage(env, nick) {
  nick = nick.trim().slice(0, LIMITS.nick);
  const {results} = await env.DB.prepare(`
    SELECT r.id, r.rating, r.tasted_on, r.review, r.is_admin, d.id AS drink_id, d.name, d.name_en, d.type, d.subtype
    FROM reviews r JOIN drinks d ON d.id = r.drink_id
    WHERE r.nickname = ? AND r.status = 'published' AND d.published = 1 ORDER BY r.tasted_on DESC NULLS LAST, r.id DESC`).bind(nick).all();
  const c = crumbs([['지거바', '/'], ['테이스팅 노트', '/tasting/'], [nick, nickURL(nick)]]);
  const rated = results.filter(r => r.rating != null);
  const avg = rated.length ? (rated.reduce((a, r) => a + r.rating, 0) / rated.length).toFixed(1) : null;
  const body = `    ${c.nav}
    <section class="hero">
      <span class="eyebrow">Reviews by · 닉네임별 리뷰</span>
      <h1>${esc(nick)}${results.some(r => r.is_admin) ? '<span class="tbadge big">운영자</span>' : ''}</h1>
      ${results.length ? `<p class="tstats"><span>리뷰 <b>${results.length}</b>개</span>${avg ? `<span>평균 평점 <b>${avg}</b></span>` : ''}</p>` : '<p class="lead">이 닉네임으로 남긴 리뷰가 없어요.</p>'}
    </section>
    ${results.length ? `<section class="sec">
      <div class="twrap"><table class="ttable tresp">
        <thead><tr><th scope="col">이름</th><th scope="col">마신 날</th><th scope="col">주종</th><th scope="col">평점</th><th scope="col">리뷰</th></tr></thead>
        <tbody>${results.map(r => `<tr>
          <th scope="row">${nameCell({id:r.drink_id, name:r.name, name_en:r.name_en})}<span class="tmob">${scoreHTML(r.rating)} · ${fmtDate(r.tasted_on)}</span></th>
          <td class="tnum">${fmtDate(r.tasted_on)}</td>
          <td><span class="ttype">${esc(typeOf(r.type).ko)}</span>${r.subtype ? ` <span class="tsub">${esc(r.subtype)}</span>` : ''}</td>
          <td class="tavg">${scoreHTML(r.rating)}</td>
          <td class="tsnip"><a href="/tasting/${r.drink_id}/#review-${r.id}">${esc(fitDesc(r.review, 90))}</a></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>` : ''}
    <div class="ctas"><a class="cta" href="/tasting/">술 목록으로 →</a></div>`;
  return html(shell({url:'/tasting/', title:`${nick}의 테이스팅 노트 | 지거바`, desc:fitDesc(`${nick}님이 남긴 술 리뷰 ${results.length}개.`),
    image:`${SITE}/og.jpg`, body, head:'<meta name="robots" content="noindex">'}));
}

/* ---------- 술 한 개 ---------- */
async function drinkPage(request, env, id) {
  const d = await env.DB.prepare('SELECT * FROM drinks WHERE id = ?').bind(id).first();
  const admin = await isAdmin(request, env);
  if (!d || (!d.published && !admin)) return notFound(request, env);
  const {results} = await env.DB.prepare(
    `SELECT id, nickname, is_admin, rating, tasted_on, nose, palate, finish, review, pairing, status, created_at FROM reviews
     WHERE drink_id = ? ${admin ? '' : "AND status = 'published'"} ORDER BY tasted_on DESC NULLS LAST, id DESC`).bind(id).all();
  const reviews = results.map(r => ({...r, nose:arr(r.nose), palate:arr(r.palate), finish:arr(r.finish), pairing:arr(r.pairing)}));
  const pub = reviews.filter(r => r.status === 'published');
  const rated = pub.filter(r => r.rating != null);   // 평점 없는 리뷰는 평균에서 빼요
  const t = typeOf(d.type), n = rated.length;
  const avg = n ? rated.reduce((a, r) => a + r.rating, 0) / n : 0;
  const dist = [5, 4, 3, 2, 1].map(s => [s, rated.filter(r => Math.max(1, Math.floor(r.rating)) === s).length]);
  // 여러 사람이 고른 향 · 맛 · 여운 (많이 고른 순)
  const top = NOTE_PARTS.map(([k, ko, en]) => {
    const cnt = {};
    for (const r of pub) for (const v of r[k]) cnt[v] = (cnt[v] || 0) + 1;
    return [ko, en, Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).slice(0, 6)];
  }).filter(x => x[2].length);
  const pairs = {};
  for (const r of pub) for (const f of r.pairing) pairs[f.id] = f.ko;
  const c = crumbs([['지거바', '/'], ['테이스팅 노트', '/tasting/'], [d.name, `/tasting/${d.id}/`]]);
  const spirit = SPIRIT_PAGE[d.type];
  const facts = [
    [t.en + ' · ' + t.ko, spirit ? `/spirits/${spirit}/` : null],
    [d.subtype], [d.producer], [d.country], [d.abv != null ? `${d.abv}%` : null], [d.price != null ? won(d.price) : null]
  ].filter(f => f[0]);
  const reviewHTML = r => `<li class="trv${r.status === 'hidden' ? ' is-hidden' : ''}" id="review-${r.id}" data-id="${r.id}">
          <div class="trv-h">
            <span class="trv-who">${nickHTML(r.nickname, r.is_admin)}</span>
            <span class="trv-score">${scoreHTML(r.rating)}</span>
            <span class="trv-date">${fmtDate(r.tasted_on)}</span>
          </div>
          ${r.status === 'hidden' ? '<p class="tdraft">숨긴 리뷰예요. 관리자에게만 보여요.</p>' : ''}
          <div class="treview">${paras(r.review)}</div>
          ${NOTE_PARTS.some(([k]) => r[k].length) ? `<dl class="trv-notes">${NOTE_PARTS.filter(([k]) => r[k].length).map(([k, ko]) =>
            `<div><dt>${ko}</dt><dd>${r[k].map(v => `<span class="tag">${esc(v)}</span>`).join('')}</dd></div>`).join('')}</dl>` : ''}
          ${r.pairing.length ? `<p class="trv-pair">함께 먹은 안주 · ${r.pairing.map(f => `<a href="/food/${esc(f.id)}/">${esc(f.ko)}</a>`).join(', ')}</p>` : ''}
          <div class="trv-act" hidden></div>
        </li>`;
  const body = `    ${c.nav}
    ${d.published ? '' : '<p class="tdraft" role="note">비공개로 설정된 술이에요. 관리자에게만 보여요.</p>'}
    <header class="thead">
      <div class="thead-txt">
        <span class="eyebrow">Tasting Note · No.${String(d.id).padStart(3, '0')}</span>
        <h1 class="title"><span class="en">${esc(d.name_en || d.name)}</span>${d.name_en ? ` <span class="ko">${esc(d.name)}</span>` : ''}</h1>
        <ul class="tfacts">${facts.map(([v, href]) => `<li>${href ? `<a href="${href}">${esc(v)}</a>` : esc(v)}</li>`).join('')}</ul>
      </div>
      ${d.photo ? `<div class="thead-img"><img src="${photoURL(d.photo, true)}" alt="${esc(d.name)}" width="640" height="640" fetchpriority="high"></div>` : ''}
    </header>
    <section class="tscore" aria-label="평점 요약">
      <div class="tscore-avg">
        <b>${n ? avg.toFixed(1) : '–'}</b>
        ${n ? starsHTML(Math.round(avg * 2) / 2, 'big') : ''}
        <span>${n ? `${n}명의 평균 평점` : pub.length ? '아직 평점이 없어요' : '아직 리뷰가 없어요'}</span>
      </div>
      ${n ? `<ul class="tdist" aria-label="평점 분포">${dist.map(([s, k]) =>
        `<li><span>${s}점</span><i style="--w:${Math.round(k / n * 100)}%"></i><span>${k}</span></li>`).join('')}</ul>` : ''}
      ${top.length ? `<dl class="ttop">${top.map(([ko, en, list]) =>
        `<div><dt>${ko} · ${en}</dt><dd>${list.map(([v, k]) => `<span class="tag">${esc(v)}${k > 1 ? `<i>${k}</i>` : ''}</span>`).join('')}</dd></div>`).join('')}</dl>` : ''}
    </section>
    <section class="sec" id="reviews">
      <div class="sec-h"><h2>닉네임별 리뷰</h2><span class="prog">${pub.length}개</span></div>
      ${reviews.length ? `<ul class="trvs">${reviews.map(reviewHTML).join('')}</ul>` : '<p class="note">첫 리뷰를 남겨 주세요.</p>'}
    </section>
    ${Object.keys(pairs).length ? `<section class="sec">
      <div class="sec-h"><h2>함께 먹은 안주</h2></div>
      <ul class="alllinks">${Object.entries(pairs).map(([fid, ko]) => `<li><a href="/food/${esc(fid)}/">${esc(ko)}</a></li>`).join('')}</ul>
    </section>` : ''}
    <section class="sec twrite" id="write">
      <div class="sec-h"><h2>이 술 리뷰 남기기</h2></div>
      <div id="tWrite" data-drink="${d.id}" data-type="${d.type}"><noscript><p class="note">리뷰를 쓰려면 자바스크립트를 켜 주세요.</p></noscript></div>
    </section>
    <div class="ctas"><a class="cta" href="/tasting/">술 목록으로 →</a></div>
    <script type="application/json" id="tData">${JSON.stringify({drink:{id:d.id, type:d.type, name:d.name},
      reviews:reviews.map(r => ({id:r.id, nickname:r.nickname, rating:r.rating, tasted_on:r.tasted_on, nose:r.nose, palate:r.palate, finish:r.finish, review:r.review, pairing:r.pairing, status:r.status}))}).replace(/</g, '\\u003c')}</script>
    <script src="/data.js" defer></script>
    <script src="/tasting/assets/config.js" defer></script>
    <script src="/tasting/assets/tasting.js" defer></script>
    <script src="/tasting/assets/drink.js" defer></script>`;
  const image = d.photo ? SITE + photoURL(d.photo) : `${SITE}/og.jpg`;
  const product = {'@context':'https://schema.org', '@type':'Product', name: d.name_en ? `${d.name} (${d.name_en})` : d.name,
    ...(d.photo ? {image} : {}), ...(d.producer ? {brand:{'@type':'Brand', name:d.producer}} : {}),
    ...(n ? {aggregateRating:{'@type':'AggregateRating', ratingValue:Math.round(avg * 10) / 10, bestRating:5, worstRating:0.5, reviewCount:n},
      review:rated.slice(0, 5).map(r => ({'@type':'Review', author:{'@type':'Person', name:r.nickname},
        datePublished:r.created_at.slice(0, 10), reviewRating:{'@type':'Rating', ratingValue:r.rating, bestRating:5, worstRating:0.5},
        reviewBody:fitDesc(r.review, 300)}))} : {})};
  const head = [c.list, ...(n ? [product] : [])].map(ld).join('\n') + (d.published ? '' : '\n<meta name="robots" content="noindex">');
  return html(shell({url:`/tasting/${d.id}/`,
    title:fitTitle(`${d.name}${d.name_en ? ` (${d.name_en})` : ''} 리뷰${n ? ` · 평균 ${avg.toFixed(1)}점` : ''} | 지거바`,
      `${d.name} 리뷰${n ? ` · 평균 ${avg.toFixed(1)}점` : ''} | 지거바`, `${d.name} 리뷰 | 지거바`, `${d.name}`.slice(0, 31) + ' 리뷰 | 지거바'),
    desc:fitDesc(n ? `${d.name} 리뷰 ${pub.length}개, 평균 평점 ${avg.toFixed(1)}/5. ${pub[0].review}` : `${d.name} (${t.ko}) 테이스팅 노트. 마셔 봤다면 첫 리뷰를 남겨 주세요.`),
    image, body, head}));
}

async function notFound(request, env) {
  const res = await env.ASSETS.fetch(new Request(new URL('/__tasting-not-found__/', request.url)));
  return new Response(res.body, {status:404, headers:res.headers});
}
async function photo(env, name) {
  if (!env.PHOTOS || !/^[a-f0-9]{24}(-sm)?\.(webp|jpg)$/.test(name)) return new Response('Not found', {status:404});
  const obj = await env.PHOTOS.get(name);
  if (!obj) return new Response('Not found', {status:404});
  return new Response(obj.body, {headers:{'Content-Type':obj.httpMetadata?.contentType || 'image/webp',
    'Cache-Control':'public, max-age=31536000, immutable', 'ETag':obj.httpEtag}});
}
async function sitemap(env) {
  const {results} = await env.DB.prepare(`SELECT d.id, MAX(d.updated_at, COALESCE(MAX(r.updated_at), '')) AS u FROM drinks d
    LEFT JOIN reviews r ON r.drink_id = d.id AND r.status = 'published' WHERE d.published = 1 GROUP BY d.id ORDER BY d.id`).all();
  const urls = results.map(r => `  <url><loc>${SITE}/tasting/${r.id}/</loc><lastmod>${r.u.slice(0, 10)}</lastmod></url>`);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    {headers:{'Content-Type':'application/xml; charset=utf-8', 'Cache-Control':'public, max-age=3600'}});
}

/* ---------- 관리자 로그인 ---------- */
const enc = new TextEncoder();
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function sign(env, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(`${env.SESSION_SECRET}|${env.ADMIN_PASSWORD}`), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
async function sameText(a, b) {
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
const sessionCookie = (value, maxAge) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
const ipOf = request => request.headers.get('CF-Connecting-IP') || 'local';

/* ---------- API ---------- */
async function api(request, env, url) {
  const p = url.pathname.replace(/\/$/, ''), method = request.method;
  if (method !== 'GET') {
    const origin = request.headers.get('Origin');
    if (!origin || new URL(origin).host !== url.host) return json(403, {error:'origin'});
  }
  if (!env.DB) return json(503, {error:'db-not-configured'});
  const admin = await isAdmin(request, env);

  if (p === '/api/tasting/login' && method === 'POST') return login(request, env);
  if (p === '/api/tasting/logout' && method === 'POST') return json(200, {ok:true}, {'Set-Cookie':sessionCookie('', 0)});
  if (p === '/api/tasting/me' && method === 'GET') return json(200, {admin, photos:!!env.PHOTOS});

  // 리뷰 쓰기 (방문자 · 관리자)
  let m = p.match(/^\/api\/tasting\/drinks\/(\d{1,9})\/reviews$/);
  if (m && method === 'POST') return createReview(request, env, +m[1], admin);
  // 리뷰 고치기 · 지우기 · 숨기기
  m = p.match(/^\/api\/tasting\/reviews\/(\d{1,9})$/);
  if (m) return changeReview(request, env, +m[1], admin, method);

  if (!admin) return json(401, {error:'login'});

  // ---- 여기부터 관리자 전용 ----
  if (p === '/api/tasting/admin/drinks' && method === 'GET') {
    const {results} = await env.DB.prepare(`SELECT d.*, COUNT(r.id) AS n, AVG(r.rating) AS avg FROM drinks d
      LEFT JOIN reviews r ON r.drink_id = d.id AND r.status = 'published' GROUP BY d.id ORDER BY d.id DESC`).all();
    return json(200, {drinks:results});
  }
  if (p === '/api/tasting/admin/reviews' && method === 'GET') {
    const {results} = await env.DB.prepare(`SELECT r.id, r.drink_id, r.nickname, r.is_admin, r.rating, r.tasted_on, r.review, r.status, r.created_at, d.name
      FROM reviews r JOIN drinks d ON d.id = r.drink_id ORDER BY r.id DESC LIMIT 200`).all();
    return json(200, {reviews:results});
  }
  if (p === '/api/tasting/drinks' && method === 'POST') {
    const v = await readDrink(request); if (v.error) return json(400, v);
    const now = new Date().toISOString(), d = v.data;
    const row = await env.DB.prepare(`INSERT INTO drinks (name, name_en, type, subtype, producer, country, abv, price, photo, published, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`)
      .bind(d.name, d.name_en, d.type, d.subtype, d.producer, d.country, d.abv, d.price, d.photo, d.published, now, now).first();
    return json(200, {ok:true, id:row.id});
  }
  m = p.match(/^\/api\/tasting\/drinks\/(\d{1,9})$/);
  if (m && method === 'PUT') {
    const old = await env.DB.prepare('SELECT photo FROM drinks WHERE id = ?').bind(+m[1]).first();
    if (!old) return json(404, {error:'not-found'});
    const v = await readDrink(request); if (v.error) return json(400, v);
    const d = v.data;
    await env.DB.prepare(`UPDATE drinks SET name=?, name_en=?, type=?, subtype=?, producer=?, country=?, abv=?, price=?, photo=?, published=?, updated_at=? WHERE id=?`)
      .bind(d.name, d.name_en, d.type, d.subtype, d.producer, d.country, d.abv, d.price, d.photo, d.published, new Date().toISOString(), +m[1]).run();
    if (old.photo && old.photo !== d.photo) await removePhoto(env, old.photo);
    return json(200, {ok:true, id:+m[1]});
  }
  if (m && method === 'DELETE') {
    const old = await env.DB.prepare('SELECT photo FROM drinks WHERE id = ?').bind(+m[1]).first();
    if (!old) return json(404, {error:'not-found'});
    await env.DB.batch([env.DB.prepare('DELETE FROM reviews WHERE drink_id = ?').bind(+m[1]), env.DB.prepare('DELETE FROM drinks WHERE id = ?').bind(+m[1])]);
    if (old.photo) await removePhoto(env, old.photo);
    return json(200, {ok:true});
  }
  if (p === '/api/tasting/photo' && method === 'POST') return uploadPhoto(request, env);
  m = p.match(/^\/api\/tasting\/photo\/([a-f0-9]{24}\.(?:webp|jpg))$/);
  if (m && method === 'DELETE') {
    const used = await env.DB.prepare('SELECT 1 FROM drinks WHERE photo = ?').bind(m[1]).first();
    if (!used) await removePhoto(env, m[1]);
    return json(200, {ok:true});
  }
  return json(404, {error:'not-found'});
}

async function login(request, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json(503, {error:'not-configured'});
  const ip = ipOf(request), now = Date.now();
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

/* 방문자 리뷰 쓰기: 닉네임 규칙 · 링크 금지 · 숨은 칸(봇) · IP당 개수 제한 */
async function createReview(request, env, drinkId, admin) {
  const d = await env.DB.prepare('SELECT id, type, published FROM drinks WHERE id = ?').bind(drinkId).first();
  if (!d || (!d.published && !admin)) return json(404, {error:'not-found'});
  const v = await readReview(request, d.type, admin); if (v.error) return json(400, v);
  if (v.bot) return json(200, {ok:true, id:0, token:''});
  const ipHash = (await sha(`${env.SESSION_SECRET || ''}|${ipOf(request)}`)).slice(0, 32);
  if (!admin) {
    const now = Date.now();
    const {h, day} = await env.DB.prepare(`SELECT SUM(created_at > ?) AS h, COUNT(*) AS day FROM reviews WHERE ip_hash = ? AND is_admin = 0 AND created_at > ?`)
      .bind(new Date(now - 3600e3).toISOString(), ipHash, new Date(now - 86400e3).toISOString()).first();
    if ((h || 0) >= POST_HOUR || (day || 0) >= POST_DAY) return json(429, {error:'too-many'});
  }
  const token = b64url(crypto.getRandomValues(new Uint8Array(24)));
  const now = new Date().toISOString(), r = v.data;
  const owner = admin && OWNER_NICKS.includes(r.nickname.replace(/\s/g, '').toLowerCase());   // ‘운영자’ 표시
  const row = await env.DB.prepare(`INSERT INTO reviews (drink_id, nickname, is_admin, rating, tasted_on, nose, palate, finish, review, pairing, status, edit_hash, ip_hash, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,'published',?,?,?,?) RETURNING id`)
    .bind(drinkId, r.nickname, owner ? 1 : 0, r.rating, r.tasted_on, JSON.stringify(r.nose), JSON.stringify(r.palate), JSON.stringify(r.finish),
      r.review, JSON.stringify(r.pairing), await sha(token), ipHash, now, now).first();
  return json(200, {ok:true, id:row.id, token});
}
async function changeReview(request, env, id, admin, method) {
  const old = await env.DB.prepare('SELECT r.id, r.edit_hash, r.is_admin, d.type FROM reviews r JOIN drinks d ON d.id = r.drink_id WHERE r.id = ?').bind(id).first();
  if (!old) return json(404, {error:'not-found'});
  const token = request.headers.get('X-Edit-Token') || '';
  const owner = !!token && !!old.edit_hash && await sameText(await sha(token), old.edit_hash);
  if (!owner && !admin) return json(403, {error:'not-owner'});
  if (method === 'DELETE') {
    await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
    return json(200, {ok:true});
  }
  if (method === 'PATCH' && admin) {   // 숨기기 · 다시 보이기
    let b; try { b = await request.json(); } catch { return json(400, {error:'json'}); }
    if (!['published', 'hidden'].includes(b?.status)) return json(400, {error:'status'});
    await env.DB.prepare('UPDATE reviews SET status = ?, updated_at = ? WHERE id = ?').bind(b.status, new Date().toISOString(), id).run();
    return json(200, {ok:true});
  }
  if (method === 'PUT') {
    const v = await readReview(request, old.type, admin || !!old.is_admin); if (v.error) return json(400, v);
    const r = v.data;
    await env.DB.prepare(`UPDATE reviews SET nickname=?, rating=?, tasted_on=?, nose=?, palate=?, finish=?, review=?, pairing=?, updated_at=? WHERE id=?`)
      .bind(r.nickname, r.rating, r.tasted_on, JSON.stringify(r.nose), JSON.stringify(r.palate), JSON.stringify(r.finish), r.review, JSON.stringify(r.pairing), new Date().toISOString(), id).run();
    return json(200, {ok:true, id});
  }
  return json(405, {error:'method'});
}

async function uploadPhoto(request, env) {
  if (!env.PHOTOS) return json(503, {error:'photos-not-configured'});
  let form; try { form = await request.formData(); } catch { return json(400, {error:'form'}); }
  const full = form.get('full'), sm = form.get('sm');
  const ok = f => f && typeof f === 'object' && f.size > 0 && f.size <= PHOTO_MAX && /^image\/(webp|jpeg)$/.test(f.type);
  if (!ok(full) || !ok(sm) || full.type !== sm.type) return json(400, {error:'photo'});
  const name = `${hex(crypto.getRandomValues(new Uint8Array(12)))}.${full.type === 'image/webp' ? 'webp' : 'jpg'}`;
  const meta = {httpMetadata:{contentType:full.type}};
  await Promise.all([env.PHOTOS.put(name, full.stream(), meta), env.PHOTOS.put(smName(name), sm.stream(), meta)]);
  return json(200, {ok:true, photo:name});
}
async function removePhoto(env, name) {
  if (env.PHOTOS && PHOTO_RE.test(name)) await env.PHOTOS.delete([name, smName(name)]);
}

/* ---------- 입력값 검사 (화면에서도 막지만 서버에서 한 번 더) ---------- */
async function body(request) {
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) throw 'json';
  try { return await request.json(); } catch { throw 'json'; }
}
function str(b, k, max, need) {
  const v = String(b[k] ?? '').trim();
  if (need && !v) throw `${k}-required`;
  if (v.length > max) throw `${k}-too-long`;
  return v || null;
}
function num(b, k, min, max, int) {
  if (b[k] === '' || b[k] == null) return null;
  const v = Number(b[k]);
  if (!Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) throw `${k}-range`;
  return v;
}
async function readDrink(request) {
  try {
    const b = await body(request);
    if (!TYPE_BY_KEY[b.type]) throw 'type';
    const photo = b.photo ? String(b.photo) : null;
    if (photo && !PHOTO_RE.test(photo)) throw 'photo';
    return {data:{name:str(b, 'name', LIMITS.name, true), name_en:str(b, 'name_en', LIMITS.name_en), type:b.type,
      subtype:str(b, 'subtype', LIMITS.subtype), producer:str(b, 'producer', LIMITS.producer), country:str(b, 'country', LIMITS.country),
      abv:num(b, 'abv', 0, 100), price:num(b, 'price', 0, 100000000, true), photo, published:b.published === false ? 0 : 1}};
  } catch (e) { return {error:typeof e === 'string' ? e : 'invalid'}; }
}
async function readReview(request, type, admin) {
  try {
    const b = await body(request);
    if (String(b.website || '').trim()) return {bot:true};   // 사람에게는 안 보이는 칸
    const nickname = String(b.nickname ?? '').trim().replace(/\s+/g, ' ');
    if (!NICK_RE.test(nickname)) throw 'nickname';
    if (!admin && RESERVED_NICKS.includes(nickname.replace(/\s/g, '').toLowerCase())) throw 'nickname-reserved';
    const rating = Number(b.rating);
    if (!(rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2))) throw 'rating';
    const tasted = String(b.tasted_on || '') || null;   // 모르면 비워 둬도 돼요
    if (tasted && (!/^\d{4}-\d{2}-\d{2}$/.test(tasted) || isNaN(Date.parse(tasted)) || tasted < '1900-01-01' || Date.parse(tasted) > Date.now() + 2 * 86400000)) throw 'tasted_on';
    const notes = {};
    for (const [k] of NOTE_PARTS) {
      const list = Array.isArray(b[k]) ? [...new Set(b[k].map(x => String(x).trim()).filter(Boolean))] : [];
      if (list.length > LIMITS.notes || list.some(x => x.length > LIMITS.note || LINK_RE.test(x))) throw k;
      notes[k] = list;
    }
    const review = str(b, 'review', LIMITS.review, true);
    if (!admin && (LINK_RE.test(review) || LINK_RE.test(nickname))) throw 'link';
    const pairing = Array.isArray(b.pairing) ? b.pairing : [];
    if (pairing.length > LIMITS.pairing || pairing.some(f => !/^[a-z0-9-]{1,40}$/.test(f?.id) || !f.ko || String(f.ko).length > 40)) throw 'pairing';
    return {data:{nickname, rating, tasted_on:tasted, ...notes, review, pairing:pairing.map(f => ({id:f.id, ko:String(f.ko)}))}};
  } catch (e) { return {error:typeof e === 'string' ? e : 'invalid'}; }
}

