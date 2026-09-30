#!/usr/bin/env node
/* 사이트 빌드 (커밋할 때 pre-commit 훅이 실행해요)
   - photos.js : images/ 에 있는 사진 목록. 없는 사진은 요청하지 않게 해요.
   - 검색용 정적 페이지 : /cocktails/<id>/, /spirits/<id>/, /food/<id>/, /quiz/
   - sitemap.xml, robots.txt, index.html 하단의 전체 페이지 링크
   데이터는 index.html의 데이터 구간과 quiz-questions.js에서 그대로 읽어요.
   도메인을 바꾸면 아래 SITE 한 줄만 고치면 돼요. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import {fileURLToPath} from 'url';
import {execFileSync} from 'child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://jiggerbar.com';
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const wr = (f, s) => { const p = path.join(ROOT, f); fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, s); };

/* ---------- 사진 목록 ---------- */
const PHOTOS = {};
for (const d of ['cocktails', 'spirits', 'food']) {
  const dir = path.join(ROOT, 'images', d);
  PHOTOS[d] = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f=>f.endsWith('.webp')).map(f=>f.slice(0, -5)).sort() : [];
}
wr('photos.js', `/* scripts/build.mjs가 자동으로 만들어요. 직접 고치지 마세요. */\nwindow.PHOTOS = ${JSON.stringify(PHOTOS)};\n`);


/* ---------- 데이터 읽기 ---------- */
const html = rd('index.html');
function cut(a, b){
  const i = html.indexOf(a), j = html.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error(`index.html에서 "${a}" 구간을 찾지 못했어요`);
  return html.slice(i, j);
}
const code = cut('/* ---------- 데이터 ---------- */', '/* ---------- 유틸 ---------- */')
  + cut('/* ---------- 유리잔 SVG ---------- */', '/* ---------- 사진')
  + (html.match(/function plateSVG[\s\S]*?\n}\n/) || [''])[0];
const D = vm.runInNewContext(`(function(){ ${code}
  return {RECIPES, SPIRITS, FOOD, BASES, CATS, BASE_EN, CAT_EN, DIFF, EXAM_SOURCE, examAmount, glassSVG, plateSVG}; })()`);
const qctx = {window:{}};
vm.runInNewContext(rd('quiz-questions.js'), qctx);
const QUIZ = qctx.window.QUIZ, QCATS = qctx.window.QUIZ_CATS;

/* 검색에서 자주 쓰는 다른 표기 */
const ALIAS = {
  mojito:['모히또'], margarita:['마르가리타'], 'pina-colada':['피나콜라다'], 'gin-tonic':['진토닉'],
  'moscow-mule':['모스코뮬'], 'dark-n-stormy':['다크앤스토미'], 'tom-collins':['톰콜린스'],
  'old-fashioned':['올드패션드'], 'tequila-sunrise':['데킬라 선라이즈'], 'whiskey-sour':['위스키사워'],
  'singapore-sling':['싱가폴 슬링'], 'blue-hawaiian':['블루 하와이안'], seabreeze:['씨브리즈'], 'pousse-cafe':['푸즈카페'], 'mai-tai':['마이 타이'],
  apricot:['애프리코트'], 'long-island-iced-tea':['롱 아일랜드 아이스티'], 'june-bug':['준벅']
};
const BASE_SPIRIT = {'진':['gin'], '럼':['rum'], '위스키':['whisky'], '보드카':['vodka'], '테킬라':['tequila'], '브랜디':['brandy'], '와인·리큐어':['wine','liqueur'], '우리술':['soju']};
const MARK = ['①','②','③','④'];
const CONTACT = {email:'naanodesign@gmail.com'};
const SPIRIT = Object.fromEntries(D.SPIRITS.map(x=>[x.id, x]));

/* ---------- 공통 ---------- */
const esc = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g,'\\u003c')}</script>`;
const FONT = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
const NAV = [['/cocktails/', '칵테일 레시피', 'cocktail'], ['/spirits/', '주류 상식', 'spirit'], ['/food/', '안주 레시피', 'food'], ['/quiz/', '조주기능사 필기', 'quiz']];

function crumbs(items){
  const list = {'@context':'https://schema.org', '@type':'BreadcrumbList',
    itemListElement: items.map(([name, url], i)=>({'@type':'ListItem', position:i+1, name, item:SITE+url}))};
  const nav = `<nav class="crumbs" aria-label="현재 위치">${items.map(([name, url], i)=>
    i < items.length-1 ? `<a href="${url}">${esc(name)}</a><span aria-hidden="true">›</span>` : `<span aria-current="page">${esc(name)}</span>`).join('')}</nav>`;
  return {list, nav};
}
function page({url, title, desc, image, section, body, jsonld}){
  return `<!DOCTYPE html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${url ? `<link rel="canonical" href="${SITE}${url}">` : '<meta name="robots" content="noindex">'}
<meta property="og:type" content="article">
<meta property="og:site_name" content="Jigger">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${url ? `<meta property="og:url" content="${SITE}${url}">\n` : ''}<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#E9E2D3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#17110C" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/instrument-serif-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/dm-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/dm-mono-500.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="${FONT}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="${FONT}"></noscript>
<link rel="stylesheet" href="/page.css">
<link rel="alternate" type="application/rss+xml" title="Jigger" href="${SITE}/rss.xml">
${jsonld.map(ld).join('\n')}
<div class="wrap">
  <header class="top">
    <a class="brand" href="/">Jigger</a>
    <nav class="tabs" aria-label="주요 메뉴">${NAV.map(([h, t, k])=>`<a href="${h}"${k===section?' aria-current="true"':''}>${t}</a>`).join('')}</nav>
  </header>
  <main>
${body}
  </main>
  <footer class="foot">
    <span>Jigger · 집에서 만드는 칵테일 레시피와 조주기능사 필기 모의고사</span>
    <span><a href="/about/">소개 · 문의</a> · 음주는 성인만, 적당히 즐겨요.</span>
  </footer>
</div>
`;
}
function thumb(dir, item, alt){
  if (PHOTOS[dir].includes(item.id)) return `<img src="/images/${dir}/${item.id}.webp" alt="${esc(alt)}" width="1000" height="1000" loading="lazy">`;
  return dir==='food' ? D.plateSVG(item, 'c'+item.id) : D.glassSVG(item, 'c'+item.id);
}
// 카드 이름: 앱 목록과 같이 영문(위) · 한글(아래)
function cardText(en, ko){
  return `<span class="cbody"><span class="cname">${esc(en)}</span><span class="cko">${esc(ko)}</span></span>`;
}
function card(dir, item, alt){
  return `<a class="card" href="/${dir}/${item.id}/"><span class="cthumb" style="--liq:${item.liquid||item.color}">${thumb(dir, item, alt)}</span>
      ${cardText(item.en, item.ko)}</a>`;
}
// 설명 문구(meta description)가 검색 결과에서 잘리지 않게 160자 안으로: 넘치면 재료를 앞의 몇 가지로 줄여요
const DESC_MAX = 160;
function fitDesc(make, list){
  for (let n = list.length; n >= 1; n--) {
    const shown = n < list.length ? `${list.slice(0, n).join(', ')} 외 ${list.length - n}가지` : list.join(', ');
    const d = make(shown);
    if (d.length <= DESC_MAX) return d;
  }
  return make(list[0]);
}
function ingText(i){
  const [name, q, u] = i;
  if (typeof q === 'string') return `${name} ${q}`;
  if (u === 'ml') return `${name} ${q} ml`;
  return `${name} ${q}${u==='dash' || u==='tsp' ? ' '+u : u}`;
}
function ozText(ml){
  const FR = {0:'', 0.25:'¼', 0.5:'½', 0.75:'¾'};
  const x = Math.round(ml/30*4)/4; if (!x) return '';
  const w = Math.floor(x); return '≈ ' + (w || '') + FR[Math.round((x-w)*100)/100] + ' oz';
}

/* ---------- 칵테일 페이지 ---------- */
function cocktailPage(r){
  const url = `/cocktails/${r.id}/`;
  const zero = r.base === '논알콜';
  const e = r.exam;
  // 시험 한글 표기가 사이트 표기와 다르면(띄어쓰기 차이 제외) 다른 표기에 함께 넣어요
  const alias = [...(ALIAS[r.id] || []), ...(e && e.ko.replace(/\s/g,'') !== r.ko.replace(/\s/g,'') ? [e.ko] : [])];
  const diff = D.DIFF[r.diff-1];
  const abv = r.abv ? `약 ${r.abv}%` : '논알콜 (0%)';
  const photo = PHOTOS.cocktails.includes(r.id);
  const image = photo ? `${SITE}/images/cocktails/${r.id}.webp` : `${SITE}/og.jpg`;
  const title = e ? `${r.ko} 레시피 · 조주기능사 실기 표준 (${r.en}) | Jigger`
    : zero ? `${r.ko} 레시피 · 무알콜 칵테일 만드는 법 (${r.en}) | Jigger` : `${r.ko} 레시피 · 만드는 법과 비율 (${r.en}) | Jigger`;
  const desc = fitDesc(ings=>`${r.ko}(${r.en}) 만드는 법${e ? `과 조주기능사 실기 표준(${e.method}, ${e.glass})` : ''}. 재료: ${ings}. ${r.method} 기법, ${r.glassName}. 도수 ${abv}, 난이도 ${diff}.`, r.ing.map(ingText));
  const c = crumbs([['Jigger','/'], ['칵테일 레시피','/cocktails/'], [r.ko, url]]);

  const same = D.RECIPES.filter(x=>x.base===r.base && x.id!==r.id);
  const more = [...same, ...D.RECIPES.filter(x=>x.base!==r.base && x.id!==r.id)].slice(0, 4);
  const spirits = BASE_SPIRIT[r.base] || [];
  const foods = D.FOOD.filter(f=>f.pairsWith.some(id=>spirits.includes(id))).slice(0, 4);

  const body = `    ${c.nav}
    <article class="item">
      <div class="media" style="--liq:${r.liquid}">${photo
        ? `<img src="/images/cocktails/${r.id}.webp" alt="${esc(r.ko)} 칵테일" width="1000" height="1000" fetchpriority="high">`
        : D.glassSVG(r, 'hero')}</div>
      <div class="body">
        <span class="eyebrow">${D.BASE_EN[r.base]} · ${zero ? '무알콜 칵테일' : r.base+' 베이스'}</span>
        <h1 class="title"><span class="en">${esc(r.en)}</span> <span class="ko">${esc(r.ko)}</span></h1>
        ${alias.length ? `<p class="aka">다른 표기: ${alias.map(esc).join(', ')}</p>` : ''}
        <div class="tags">${e ? '<span class="tag xtag">조주기능사 실기</span>' : ''}${r.flav.map(f=>`<span class="tag">${f}</span>`).join('')}</div>
        <p class="lead">${esc(r.note)}</p>
        <dl class="spec">
          <div><dt>도수</dt><dd>${abv}</dd></div>
          <div><dt>기법</dt><dd>${r.method}</dd></div>
          <div><dt>글라스</dt><dd>${r.glassName}</dd></div>
          <div><dt>난이도</dt><dd>${diff}</dd></div>
          <div><dt>베이스</dt><dd>${spirits.length ? spirits.map(id=>`<a href="/spirits/${id}/">${esc(SPIRIT[id].ko)}</a>`).join(' · ') : '논알콜'}</dd></div>
          <div><dt>가니시</dt><dd>${esc(r.garnish)}</dd></div>
        </dl>
        <section class="sec">
          <div class="sec-h"><h2>재료</h2><span class="prog">1잔 기준</span></div>
          <ul class="ings">${r.ing.map(i=>`
            <li><span class="sw ${i[3]?'':'none'}"${i[3]?` style="--c:${i[3]}"`:''}></span><span>${esc(i[0])}</span><span class="amt">${
              typeof i[1]==='string' ? esc(i[1]) : i[2]==='ml' ? `${i[1]} ml<i>${ozText(i[1])}</i>` : `${i[1]}${i[2]==='dash'||i[2]==='tsp'?' '+i[2]:i[2]}`}</span></li>`).join('')}
          </ul>
        </section>
        <section class="sec">
          <div class="sec-h"><h2>만드는 법</h2><span class="prog">${r.method}</span></div>
          <ol class="steps">${r.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
        </section>
        ${e ? `<section class="sec">
          <div class="sec-h"><h2>조주기능사 실기 표준</h2><span class="prog">No.${e.no}</span></div>
          <dl class="spec">
            <div><dt>시험 표기</dt><dd>${esc(e.en)}<br>${esc(e.ko)}</dd></div>
            <div><dt>조주법</dt><dd>${esc(e.method)}</dd></div>
            <div><dt>글라스</dt><dd>${esc(e.glass)}</dd></div>
            <div><dt>가니시</dt><dd>${esc(e.garnish)}</dd></div>
          </dl>
          <ul class="exing">${e.ing.map(([n, a])=>`<li><span>${esc(n)}</span><span class="amt">${esc(D.examAmount(a))}</span></li>`).join('')}</ul>
          <p class="src">출처: ${esc(D.EXAM_SOURCE)}. 실기시험은 재료·조주법·글라스·가니시를 이 기준으로 채점해요.</p>
        </section>` : ''}
        <a class="cta" href="/#${r.id}">Jigger에서 잔 수에 맞춰 계량하기 →</a>
      </div>
    </article>
    <section class="more">
      <div class="sec-h"><h2>${same.length ? (zero ? '다른 무알콜 칵테일' : `${r.base} 베이스 칵테일 더 보기`) : '다른 칵테일 레시피'}</h2></div>
      <div class="cards">${more.map(x=>card('cocktails', x, `${x.ko} 칵테일`)).join('')}</div>
    </section>
    ${foods.length ? `<section class="more">
      <div class="sec-h"><h2>어울리는 안주</h2></div>
      <div class="cards">${foods.map(f=>card('food', f, f.ko)).join('')}</div>
    </section>` : ''}
    <section class="more">
      <div class="sec-h"><h2>칵테일 레시피 전체</h2><span class="prog">${D.RECIPES.length}가지</span></div>
      <ul class="alllinks">${D.RECIPES.map(x=>`<li><a href="/cocktails/${x.id}/"${x.id===r.id?' aria-current="page"':''}>${esc(x.ko)}</a></li>`).join('')}</ul>
    </section>`;

  const recipe = {'@context':'https://schema.org', '@type':'Recipe',
    name:`${r.ko} (${r.en})`, image:[image], description:r.note,
    author:{'@type':'Organization', name:'Jigger', url:SITE+'/'},
    recipeCategory:zero ? '무알콜 칵테일' : '칵테일', recipeYield:'1잔',
    keywords:[`${r.ko} 레시피`, `${r.ko} 만드는 법`, r.en, zero ? '무알콜 칵테일' : `${r.base} 칵테일`, ...(e ? ['조주기능사 실기', `${r.ko} 조주기능사`] : []), ...alias].join(', '),
    recipeIngredient:r.ing.map(ingText),
    recipeInstructions:r.steps.map(text=>({'@type':'HowToStep', text}))};
  return {url, html:page({url, title, desc, image, section:'cocktail', body, jsonld:[recipe, c.list]})};
}

/* ---------- 조주기능사 필기 페이지 ---------- */
function perm(id){ // 문제마다 고정된 보기 순서 (정답이 항상 ①이 되지 않게)
  let h = 0; for (const ch of id) h = (h*31 + ch.charCodeAt(0)) >>> 0;
  const a = [0,1,2,3];
  for (let i = 3; i > 0; i--){ h = (Math.imul(h, 1103515245) + 12345) >>> 0; const j = h % (i+1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function quizPage(){
  const url = '/quiz/';
  const title = `조주기능사 필기 모의고사 · 무료 예상문제 ${QUIZ.length}개와 해설 | Jigger`;
  const desc = `조주기능사 필기시험 대비 무료 모의고사. 양조주·증류주·혼성주·전통주, 칵테일 조주, 바 영업, 영어까지 예상문제 ${QUIZ.length}개와 해설, 60문항 60분 실전 모의고사와 오답노트.`;
  const c = crumbs([['Jigger','/'], ['조주기능사 필기', url]]);
  let n = 0;
  const groups = QCATS.map((cat, ci)=>{
    const qs = QUIZ.filter(q=>q.cat===cat);
    return `    <section class="sec" id="cat-${ci+1}">
      <div class="sec-h"><h2>${cat} 예상문제</h2><span class="prog">${qs.length}문제</span></div>
      <ol class="qlist">${qs.map(q=>{
        const order = perm(q.id); n++;
        return `
        <li class="qi"><p class="qq"><span class="qn">Q${n}</span>${esc(q.q)}</p>
          <ol class="opts">${order.map((o, k)=>`<li${o===0?' class="ok"':''}><span class="mk">${MARK[k]}</span>${esc(q.o[o])}</li>`).join('')}</ol>
          <details><summary>정답과 해설 보기</summary><p class="ans">정답 ${MARK[order.indexOf(0)]} ${esc(q.o[0])}</p><p class="ex">${esc(q.e)}</p></details></li>`;
      }).join('')}
      </ol>
    </section>`;
  }).join('\n');
  const body = `    ${c.nav}
    <section class="hero">
      <span class="eyebrow">Written Exam · Free Mock Test</span>
      <h1>조주기능사 필기 모의고사</h1>
      <p class="lead">조주기능사 필기시험 출제 범위를 바탕으로 직접 만든 예상문제 ${QUIZ.length}개예요. 문제마다 해설이 있고, 실전처럼 60문항을 60분 동안 푸는 모의고사와 틀린 문제만 다시 푸는 오답노트를 무료로 쓸 수 있어요.</p>
      <p class="note">실제 기출문제가 아닌 예상문제예요. 공부 방향을 잡는 용도로 활용해 주세요.</p>
      <div class="ctas"><a class="cta" href="/#quiz">모의고사 · 연습 모드 시작하기 →</a></div>
    </section>
    <section class="sec">
      <div class="sec-h"><h2>조주기능사 필기시험 안내</h2></div>
      <dl class="spec">
        <div><dt>출제 형식</dt><dd>4지선다 객관식</dd></div>
        <div><dt>문항 수</dt><dd>60문항</dd></div>
        <div><dt>시험 시간</dt><dd>60분</dd></div>
        <div><dt>합격 기준</dt><dd>100점 만점에 60점 이상</dd></div>
      </dl>
    </section>
    <section class="sec">
      <div class="sec-h"><h2>분야별 예상문제</h2><span class="prog">${QUIZ.length}문제</span></div>
      <ul class="alllinks">${QCATS.map((cat, ci)=>`<li><a href="#cat-${ci+1}">${cat} <span class="n">${QUIZ.filter(q=>q.cat===cat).length}</span></a></li>`).join('')}</ul>
    </section>
${groups}
    <section class="more">
      <div class="sec-h"><h2>조주기능사 실기 칵테일 40가지</h2><span class="prog">표준 레시피</span></div>
      <ul class="alllinks">${D.RECIPES.filter(x=>x.exam).sort((a, b)=>a.exam.no-b.exam.no).map(x=>`<li><a href="/cocktails/${x.id}/">${esc(x.exam.ko)}</a></li>`).join('')}</ul>
    </section>
    <section class="more">
      <div class="sec-h"><h2>주류 상식으로 복습하기</h2></div>
      <div class="cards">${D.SPIRITS.map(s=>card('spirits', s, s.ko)).join('')}</div>
    </section>`;
  return {url, html:page({url, title, desc, image:`${SITE}/og.jpg`, section:'quiz', body, jsonld:[c.list]})};
}

/* ---------- 주류 상식 페이지 ---------- */
function spiritNames(sp){ return sp.ko.split(/[()·]/).map(t=>t.trim()).filter(Boolean); }
function relatedQuiz(sp){
  // "가진"의 "진", "처럼"의 "럼"처럼 다른 낱말 속 글자는 빼고, 조사가 붙은 경우만 인정해요
  const res = spiritNames(sp).map(n=>new RegExp(`(^|[^가-힣])${n}(?=$|[^가-힣]|[은는이가의을를와과로에도])`));
  return QUIZ.filter(q=>res.some(re=>re.test(q.q) || re.test(q.o[0]))).slice(0, 4);
}
function miniQuiz(qs){
  return `<ol class="qlist">${qs.map((q, n)=>{ const order = perm(q.id); return `
        <li class="qi"><p class="qq"><span class="qn">Q${n+1}</span>${esc(q.q)}</p>
          <ol class="opts">${order.map((o, k)=>`<li${o===0?' class="ok"':''}><span class="mk">${MARK[k]}</span>${esc(q.o[o])}</li>`).join('')}</ol>
          <details><summary>정답과 해설 보기</summary><p class="ans">정답 ${MARK[order.indexOf(0)]} ${esc(q.o[0])}</p><p class="ex">${esc(q.e)}</p></details></li>`; }).join('')}
      </ol>`;
}
function spiritPage(sp){
  const url = `/spirits/${sp.id}/`;
  const photo = PHOTOS.spirits.includes(sp.id);
  const image = photo ? `${SITE}/images/spirits/${sp.id}.webp` : `${SITE}/og.jpg`;
  const title = `${sp.ko} 종류와 제조법 · 원료, 도수 정리 (${sp.en}) | Jigger`;
  const desc = `${sp.ko}(${sp.en}) · ${sp.cat}. 원료 ${sp.material}, 도수 ${sp.abv}. 종류: ${sp.types}. 조주기능사 필기 대비 주류 상식 정리.`;
  const c = crumbs([['Jigger','/'], ['주류 상식','/spirits/'], [sp.ko, url]]);
  const bases = Object.entries(BASE_SPIRIT).filter(([, ids])=>ids.includes(sp.id)).map(([b])=>b);
  const cocktails = D.RECIPES.filter(r=>bases.includes(r.base)).slice(0, 4);
  const foods = D.FOOD.filter(f=>f.pairsWith.includes(sp.id)).slice(0, 4);
  const qs = relatedQuiz(sp);
  const same = D.SPIRITS.filter(x=>x.cat===sp.cat && x.id!==sp.id);
  const body = `    ${c.nav}
    <article class="item">
      <div class="media" style="--liq:${sp.liquid}">${photo
        ? `<img src="/images/spirits/${sp.id}.webp" alt="${esc(sp.ko)}" width="1000" height="1000" fetchpriority="high">`
        : D.glassSVG(sp, 'hero')}</div>
      <div class="body">
        <span class="eyebrow">${D.CAT_EN[sp.cat]} · ${sp.cat}</span>
        <h1 class="title"><span class="en">${esc(sp.en)}</span> <span class="ko">${esc(sp.ko)}</span></h1>
        <p class="lead">${esc(sp.process)}</p>
        <dl class="spec">
          <div><dt>원료</dt><dd>${esc(sp.material)}</dd></div>
          <div><dt>도수</dt><dd>${esc(sp.abv)}</dd></div>
          <div><dt>종류</dt><dd>${esc(sp.types)}</dd></div>
          <div><dt>분류</dt><dd>${sp.cat}</dd></div>
        </dl>
        <section class="sec">
          <div class="sec-h"><h2>세부 종류</h2><span class="prog">${sp.sub.length}가지</span></div>
          <ul class="subtypes">${sp.sub.map(x=>`<li><b>${esc(x.name)}</b>${esc(x.desc)}</li>`).join('')}</ul>
        </section>
        <section class="sec">
          <div class="sec-h"><h2>조주기능사 시험 포인트</h2></div>
          <p class="lead">${esc(sp.note)}</p>
        </section>
      </div>
    </article>
    ${qs.length ? `<section class="more">
      <div class="sec-h"><h2>${esc(spiritNames(sp)[0])} 관련 필기 예상문제</h2><a class="prog" href="/quiz/">전체 ${QUIZ.length}문제 →</a></div>
      ${miniQuiz(qs)}
    </section>` : ''}
    ${cocktails.length ? `<section class="more">
      <div class="sec-h"><h2>${esc(spiritNames(sp)[0])}로 만드는 칵테일</h2></div>
      <div class="cards">${cocktails.map(x=>card('cocktails', x, `${x.ko} 칵테일`)).join('')}</div>
    </section>` : ''}
    ${foods.length ? `<section class="more">
      <div class="sec-h"><h2>어울리는 안주</h2></div>
      <div class="cards">${foods.map(f=>card('food', f, f.ko)).join('')}</div>
    </section>` : ''}
    <section class="more">
      <div class="sec-h"><h2>주류 상식 전체</h2><span class="prog">${same.length ? `같은 ${sp.cat} ${same.length}가지 포함` : ''}</span></div>
      <ul class="alllinks">${D.SPIRITS.map(x=>`<li><a href="/spirits/${x.id}/"${x.id===sp.id?' aria-current="page"':''}>${esc(x.ko)}</a></li>`).join('')}</ul>
    </section>`;
  const article = {'@context':'https://schema.org', '@type':'Article', headline:`${sp.ko}(${sp.en}) 종류와 제조법`,
    description:desc, image:[image], author:{'@type':'Organization', name:'Jigger', url:SITE+'/'}, inLanguage:'ko'};
  return {url, html:page({url, title, desc, image, section:'spirit', body, jsonld:[article, c.list]})};
}

/* ---------- 안주 페이지 ---------- */
function foodPage(f){
  const url = `/food/${f.id}/`;
  const photo = PHOTOS.food.includes(f.id);
  const image = photo ? `${SITE}/images/food/${f.id}.webp` : `${SITE}/og.jpg`;
  const pairs = f.pairsWith.map(id=>SPIRIT[id]);
  const pairNames = pairs.map(x=>spiritNames(x)[0]);
  const diff = D.DIFF[f.diff-1];
  const title = `${f.ko} 만드는 법 · ${pairNames.join('·')} 안주 레시피 | Jigger`;
  const desc = fitDesc(mats=>`${f.ko} 레시피. 조리 시간 ${f.time}, 난이도 ${diff}. 재료: ${mats}. ${pairNames.join('·')}와 잘 어울리는 안주예요.`, f.material);
  const c = crumbs([['Jigger','/'], ['안주 레시피','/food/'], [f.ko, url]]);
  const bases = Object.entries(BASE_SPIRIT).filter(([, ids])=>ids.some(id=>f.pairsWith.includes(id))).map(([b])=>b);
  const cocktails = D.RECIPES.filter(r=>bases.includes(r.base)).slice(0, 4);
  const others = D.FOOD.filter(x=>x.id!==f.id && x.pairsWith.some(id=>f.pairsWith.includes(id))).slice(0, 4);
  const body = `    ${c.nav}
    <article class="item">
      <div class="media" style="--liq:${f.color}">${photo
        ? `<img src="/images/food/${f.id}.webp" alt="${esc(f.ko)}" width="1000" height="1000" fetchpriority="high">`
        : D.plateSVG(f, 'hero')}</div>
      <div class="body">
        <span class="eyebrow">Food Pairing · 안주 레시피</span>
        <h1 class="title"><span class="en">${esc(f.en)}</span> <span class="ko">${esc(f.ko)}</span></h1>
        <div class="tags">${pairs.map(x=>`<a class="tag" href="/spirits/${x.id}/">${esc(x.ko)}</a>`).join('')}</div>
        <p class="lead">${esc(f.note)}</p>
        <dl class="spec">
          <div><dt>조리 시간</dt><dd>${esc(f.time)}</dd></div>
          <div><dt>난이도</dt><dd>${diff}</dd></div>
          <div class="wide"><dt>어울리는 술</dt><dd>${pairs.map(x=>`<a href="/spirits/${x.id}/">${esc(x.ko)}</a>`).join(' · ')}</dd></div>
        </dl>
        <section class="sec">
          <div class="sec-h"><h2>재료</h2></div>
          <ul class="ings">${f.material.map(m=>`<li><span class="sw none"></span><span>${esc(m)}</span><span></span></li>`).join('')}</ul>
        </section>
        <section class="sec">
          <div class="sec-h"><h2>만드는 법</h2></div>
          <ol class="steps">${f.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
        </section>
        <a class="cta" href="/#${f.id}">Jigger에서 재료 체크하며 만들기 →</a>
      </div>
    </article>
    ${cocktails.length ? `<section class="more">
      <div class="sec-h"><h2>함께 마시기 좋은 칵테일</h2></div>
      <div class="cards">${cocktails.map(x=>card('cocktails', x, `${x.ko} 칵테일`)).join('')}</div>
    </section>` : ''}
    ${others.length ? `<section class="more">
      <div class="sec-h"><h2>비슷한 술에 어울리는 안주</h2></div>
      <div class="cards">${others.map(x=>card('food', x, x.ko)).join('')}</div>
    </section>` : ''}
    <section class="more">
      <div class="sec-h"><h2>안주 레시피 전체</h2><span class="prog">${D.FOOD.length}가지</span></div>
      <ul class="alllinks">${D.FOOD.map(x=>`<li><a href="/food/${x.id}/"${x.id===f.id?' aria-current="page"':''}>${esc(x.ko)}</a></li>`).join('')}</ul>
    </section>`;
  const mins = /^(\d+)분$/.exec(f.time);
  const recipe = {'@context':'https://schema.org', '@type':'Recipe', name:`${f.ko} (${f.en})`, image:[image], description:f.note,
    author:{'@type':'Organization', name:'Jigger', url:SITE+'/'}, recipeCategory:'안주',
    keywords:[`${f.ko} 만드는 법`, ...pairNames.map(n=>`${n} 안주`)].join(', '),
    ...(mins ? {totalTime:`PT${mins[1]}M`} : {}),
    recipeIngredient:f.material, recipeInstructions:f.steps.map(text=>({'@type':'HowToStep', text}))};
  return {url, html:page({url, title, desc, image, section:'food', body, jsonld:[recipe, c.list]})};
}

/* ---------- 목록 페이지 (/cocktails/, /spirits/, /food/) ---------- */
function listPage({url, section, eyebrow, h1, lead, title, desc, groups, dir, crumbName, extra=''}){
  const c = crumbs([['Jigger','/'], [crumbName, url]]);
  const all = groups.flatMap(g=>g.items);
  const body = `    ${c.nav}
    <section class="hero">
      <span class="eyebrow">${eyebrow}</span>
      <h1>${h1}</h1>
      <p class="lead">${lead}</p>
    </section>
    ${groups.length > 1 ? `<section class="sec">
      <div class="sec-h"><h2>바로 가기</h2><span class="prog">${all.length}가지</span></div>
      <ul class="alllinks">${groups.map((g, i)=>`<li><a href="#g-${i+1}">${esc(g.name)} <span class="n">${g.items.length}</span></a></li>`).join('')}</ul>
    </section>` : ''}
${groups.map((g, i)=>`    <section class="more" id="g-${i+1}">
      <div class="sec-h"><h2>${esc(g.name)}</h2><span class="prog">${g.items.length}가지</span></div>
      <div class="cards">${g.items.map(x=>card(dir, x, x.ko)).join('')}</div>
    </section>`).join('\n')}
${extra}`;
  const list = {'@context':'https://schema.org', '@type':'ItemList', name:h1,
    itemListElement: all.map((x, i)=>({'@type':'ListItem', position:i+1, url:`${SITE}/${dir}/${x.id}/`, name:x.ko}))};
  return {url, html:page({url, title, desc, image:`${SITE}/og.jpg`, section, body, jsonld:[list, c.list]})};
}
function cocktailsIndex(){
  const exam = D.RECIPES.filter(r=>r.exam).length;
  return listPage({url:'/cocktails/', section:'cocktail', dir:'cocktails', crumbName:'칵테일 레시피', eyebrow:'Cocktail Recipes',
    h1:'칵테일 레시피', title:`칵테일 레시피 ${D.RECIPES.length}가지 · 집에서 만드는 법과 조주기능사 실기 ${exam}가지 | Jigger`,
    desc:`집에서 만드는 칵테일 레시피 ${D.RECIPES.length}가지. 진, 럼, 위스키, 보드카, 테킬라, 우리술, 무알콜까지 베이스별로 재료·비율·만드는 법을 정리했고, 조주기능사 실기 ${exam}가지 표준 레시피도 함께 볼 수 있어요.`,
    lead:`집에서 만드는 칵테일 ${D.RECIPES.length}가지를 베이스별로 모았어요. 조주기능사 실기 ${exam}가지는 시험 표준 레시피(조주법·글라스·가니시)도 함께 볼 수 있어요.`,
    groups: D.BASES.map(b=>({name:`${b} ${b==='논알콜'?'칵테일':'베이스'}`, items:D.RECIPES.filter(r=>r.base===b)})).filter(g=>g.items.length),
    extra:`    <section class="more">
      <div class="sec-h"><h2>조주기능사 실기 칵테일 ${exam}가지</h2><a class="prog" href="/quiz/">필기 예상문제 →</a></div>
      <ul class="alllinks">${D.RECIPES.filter(x=>x.exam).sort((a, b)=>a.exam.no-b.exam.no).map(x=>`<li><a href="/cocktails/${x.id}/">${esc(x.exam.ko)}</a></li>`).join('')}</ul>
    </section>`});
}
function spiritsIndex(){
  return listPage({url:'/spirits/', section:'spirit', dir:'spirits', crumbName:'주류 상식', eyebrow:'Spirits Guide',
    h1:'주류 상식', title:`주류 상식 ${D.SPIRITS.length}가지 · 양조주·증류주·전통주·혼성주 정리 | Jigger`,
    desc:`맥주, 와인, 위스키, 브랜디, 진, 보드카, 럼, 테킬라, 막걸리, 청주·약주, 소주, 리큐르까지 ${D.SPIRITS.length}가지 술의 원료, 제조법, 도수, 세부 종류를 조주기능사 필기 대비로 정리했어요.`,
    lead:`조주기능사 필기시험의 주류학 범위를 기준으로 ${D.SPIRITS.length}가지 술을 양조주·증류주·전통주·혼성주로 나눠 원료와 제조 공정, 도수를 정리했어요.`,
    groups: D.CATS.map(cat=>({name:cat, items:D.SPIRITS.filter(x=>x.cat===cat)})).filter(g=>g.items.length)});
}
function foodIndex(){
  return listPage({url:'/food/', section:'food', dir:'food', crumbName:'안주 레시피', eyebrow:'Food Pairing',
    h1:'안주 레시피', title:`안주 레시피 ${D.FOOD.length}가지 · 술 종류별 어울리는 안주 | Jigger`,
    desc:`맥주, 소주, 와인, 위스키, 막걸리, 칵테일에 어울리는 안주 레시피 ${D.FOOD.length}가지. 조리 시간과 난이도, 재료와 만드는 법, 어울리는 술을 함께 정리했어요.`,
    lead:`술 종류에 어울리는 안주 ${D.FOOD.length}가지를 모았어요. 안주마다 조리 시간과 난이도, 어울리는 술을 함께 볼 수 있어요.`,
    groups:[{name:'안주 레시피 전체', items:D.FOOD}],
    extra:`    <section class="more">
      <div class="sec-h"><h2>술 종류별로 어울리는 안주 보기</h2></div>
      <ul class="alllinks">${D.SPIRITS.map(x=>`<li><a href="/spirits/${x.id}/">${esc(x.ko)} <span class="n">${D.FOOD.filter(f=>f.pairsWith.includes(x.id)).length}</span></a></li>`).join('')}</ul>
    </section>`});
}

/* ---------- 소개 · 문의 페이지 ---------- */
function aboutPage(){
  const url = '/about/';
  const title = 'Jigger 소개 · 문의 | 칵테일 레시피와 조주기능사 필기';
  const desc = `Jigger는 집에서 만드는 칵테일 레시피 ${D.RECIPES.length}가지, 주류 상식, 안주 레시피, 조주기능사 필기 예상문제 ${QUIZ.length}개를 모은 사이트예요. 콘텐츠 기준과 문의 방법을 안내해요.`;
  const c = crumbs([['Jigger','/'], ['소개 · 문의', url]]);
  const body = `    ${c.nav}
    <section class="hero">
      <span class="eyebrow">About · Contact</span>
      <h1>Jigger 소개</h1>
      <p class="lead">Jigger는 집에서 칵테일을 만들고, 술을 조금 더 알고 싶은 사람을 위한 사이트예요. 칵테일은 잔 수에 맞춰 계량할 수 있게, 술은 원료와 제조 방식부터, 조주기능사 필기는 해설과 함께 풀어볼 수 있게 정리했어요.</p>
    </section>
    <section class="sec">
      <div class="sec-h"><h2>무엇을 담았나요</h2></div>
      <dl class="spec">
        <div><dt>칵테일 레시피</dt><dd><a href="/cocktails/">${D.RECIPES.length}가지</a> · 재료, 비율, 만드는 법</dd></div>
        <div><dt>주류 상식</dt><dd><a href="/spirits/">${D.SPIRITS.length}가지</a> · 원료, 제조법, 세부 종류</dd></div>
        <div><dt>안주 레시피</dt><dd><a href="/food/">${D.FOOD.length}가지</a> · 어울리는 술과 함께</dd></div>
        <div><dt>조주기능사 필기</dt><dd><a href="/quiz/">예상문제 ${QUIZ.length}개</a> · 모의고사, 오답노트</dd></div>
      </dl>
    </section>
    <section class="sec">
      <div class="sec-h"><h2>콘텐츠 기준</h2></div>
      <ul class="subtypes">
        <li><b>레시피 도수</b>얼음이 녹은 뒤를 기준으로 한 대략적인 추정치예요. 재료 브랜드와 만드는 방법에 따라 달라질 수 있어요.</li>
        <li><b>조주기능사 필기 문제</b>출제 범위를 바탕으로 직접 만든 예상문제예요. 실제 기출문제가 아니며, 시험 준비의 방향을 잡는 용도로 활용해 주세요.</li>
        <li><b>오류 제보</b>정답이나 레시피에 틀린 내용이 있으면 아래 연락처로 알려 주세요. 확인한 뒤 바로 고칠게요.</li>
        <li><b>음주 안내</b>음주는 성인만, 적당히 즐겨 주세요. 음주 후에는 운전하지 마세요.</li>
      </ul>
    </section>
    <section class="sec">
      <div class="sec-h"><h2>개인정보</h2></div>
      <p class="lead">Jigger는 회원가입이 없고 개인정보를 수집하지 않아요. 즐겨찾기, 오답노트, 모의고사 기록은 사용하는 브라우저 안에만 저장되고 서버로 전송되지 않아요. 브라우저의 사이트 데이터를 지우면 함께 삭제돼요.</p>
    </section>
    <section class="sec">
      <div class="sec-h"><h2>문의</h2></div>
      <dl class="spec">
        <div class="wide"><dt>이메일</dt><dd><a href="mailto:${CONTACT.email}">${CONTACT.email}</a></dd></div>
      </dl>
      <p class="note">레시피·문제 오류 제보, 제휴 문의 모두 환영해요.</p>
    </section>`;
  const about = {'@context':'https://schema.org', '@type':'AboutPage', name:title, url:SITE+url, inLanguage:'ko',
    mainEntity:{'@type':'Organization', name:'Jigger', url:SITE+'/', logo:SITE+'/apple-touch-icon.png',
      email:CONTACT.email,
      contactPoint:{'@type':'ContactPoint', contactType:'customer support', email:CONTACT.email, availableLanguage:['Korean']}}};
  return {url, html:page({url, title, desc, image:`${SITE}/og.jpg`, section:null, body, jsonld:[about, c.list]})};
}

/* ---------- 쓰기 ---------- */
const pages = [
  cocktailsIndex(), spiritsIndex(), foodIndex(),
  quizPage(),
  ...D.RECIPES.map(cocktailPage),
  ...D.SPIRITS.map(spiritPage),
  ...D.FOOD.map(foodPage),
  aboutPage()
];
for (const p of pages) wr(p.url.slice(1) + 'index.html', p.html);

// 카테고리 카드: 사진이 있는 첫 항목을 대표 이미지로 써요
function hubCard(href, dir, list, name, en){
  const item = list.find(x=>PHOTOS[dir].includes(x.id)) || list[0];
  return `<a class="card" href="${href}"><span class="cthumb" style="--liq:${item.liquid||item.color}">${thumb(dir, item, name)}</span>
      ${cardText(en, name)}</a>`;
}
// 없는 주소로 들어왔을 때 보여줄 404 페이지 (Vercel이 /404.html을 자동으로 써요)
wr('404.html', page({url:null, title:'페이지를 찾을 수 없어요 | Jigger', desc:'주소가 바뀌었거나 없는 페이지예요. 칵테일 레시피, 주류 상식, 안주 레시피, 조주기능사 필기 모의고사로 이동해 보세요.',
  image:`${SITE}/og.jpg`, section:null, jsonld:[], body:`    <section class="hero">
      <span class="eyebrow">404 · Not Found</span>
      <h1>페이지를 찾을 수 없어요</h1>
      <p class="lead">주소가 바뀌었거나 없는 페이지예요. 아래에서 찾으시는 내용을 골라 보세요.</p>
      <div class="ctas"><a class="cta" href="/">Jigger 홈으로 →</a></div>
    </section>
    <section class="more">
      <div class="sec-h"><h2>둘러보기</h2></div>
      <div class="cards">
        ${hubCard('/cocktails/', 'cocktails', D.RECIPES, '칵테일 레시피', 'Cocktail Recipes')}
        ${hubCard('/spirits/', 'spirits', D.SPIRITS, '주류 상식', 'Spirits Guide')}
        ${hubCard('/food/', 'food', D.FOOD, '안주 레시피', 'Food Pairing')}
        <a class="card" href="/quiz/"><span class="cthumb qthumb"><span>${QUIZ.length}</span></span>${cardText('Written Exam', '조주기능사 필기')}</a>
      </div>
    </section>
    <section class="more">
      <div class="sec-h"><h2>칵테일 레시피</h2></div>
      <ul class="alllinks">${D.RECIPES.map(x=>`<li><a href="/cocktails/${x.id}/">${esc(x.ko)}</a></li>`).join('')}</ul>
    </section>
    <section class="more">
      <div class="sec-h"><h2>주류 상식</h2></div>
      <ul class="alllinks">${D.SPIRITS.map(x=>`<li><a href="/spirits/${x.id}/">${esc(x.ko)}</a></li>`).join('')}</ul>
    </section>
    <section class="more">
      <div class="sec-h"><h2>안주 레시피</h2></div>
      <ul class="alllinks">${D.FOOD.map(x=>`<li><a href="/food/${x.id}/">${esc(x.ko)}</a></li>`).join('')}</ul>
    </section>`}));

// 데이터에서 지운 항목의 페이지 정리
for (const [dir, list] of [['cocktails', D.RECIPES], ['spirits', D.SPIRITS], ['food', D.FOOD]]) {
  const keep = new Set(list.map(x=>x.id));
  for (const d of fs.readdirSync(path.join(ROOT, dir))) {
    if (!keep.has(d) && fs.existsSync(path.join(ROOT, dir, d, 'index.html'))) fs.rmSync(path.join(ROOT, dir, d), {recursive:true});
  }
}

wr('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', ...pages.map(p=>p.url)].map(u=>`  <url><loc>${SITE}${u}</loc></url>`).join('\n')}
</urlset>
`);
// RSS (네이버 서치어드바이저용): 페이지마다 처음 게시된 날짜를 scripts/published.json에 기록해 두고 최신순으로 내보내요
const PUB_FILE = 'scripts/published.json';
const published = fs.existsSync(path.join(ROOT, PUB_FILE)) ? JSON.parse(rd(PUB_FILE)) : {};
const firstAdded = f => { try { return execFileSync('git', ['log', '--diff-filter=A', '--format=%aI', '--', f], {cwd: ROOT, encoding:'utf8'}).trim().split('\n').pop(); } catch (e) { return ''; } };
const feedPages = pages.filter(p=>/^\/(cocktails|spirits|food)\/[^/]+\/$|^\/quiz\/$/.test(p.url));
let pubChanged = false;
for (const p of feedPages) if (!published[p.url]) { published[p.url] = firstAdded(p.url.slice(1) + 'index.html') || new Date().toISOString(); pubChanged = true; }
if (pubChanged) wr(PUB_FILE, JSON.stringify(Object.fromEntries(Object.entries(published).sort()), null, 1) + '\n');
const pick = (h, re) => (h.match(re) || [, ''])[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const items = feedPages.map(p=>({url:p.url, date:published[p.url], title:pick(p.html, /<title>([^<]*)<\/title>/).replace(/ \| Jigger$/, ''), desc:pick(p.html, /<meta name="description" content="([^"]*)"/)}))
  .sort((a, b)=>b.date.localeCompare(a.date) || a.url.localeCompare(b.url));
const x = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
wr('rss.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Jigger | 칵테일 레시피 · 안주 · 조주기능사</title>
  <link>${SITE}/</link>
  <description>집에서 만드는 칵테일 레시피, 조주기능사 실기 표준과 필기 예상문제, 주류 상식과 안주 레시피</description>
  <language>ko</language>
  <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml"/>
  <lastBuildDate>${new Date(items[0].date).toUTCString()}</lastBuildDate>
${items.map(i=>`  <item>
    <title>${x(i.title)}</title>
    <link>${SITE}${i.url}</link>
    <guid isPermaLink="true">${SITE}${i.url}</guid>
    <description>${x(i.desc)}</description>
    <pubDate>${new Date(i.date).toUTCString()}</pubDate>
  </item>`).join('\n')}
</channel>
</rss>
`);

wr('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

// index.html 하단: 검색엔진이 따라갈 수 있는 전체 페이지 링크
const links = `<!-- build:links (scripts/build.mjs가 자동으로 만들어요) -->
  <nav class="sitelinks" aria-label="전체 페이지">
    <div><h2><a href="/cocktails/">칵테일 레시피</a></h2><ul>${D.RECIPES.map(x=>`<li><a href="/cocktails/${x.id}/">${esc(x.ko)}</a></li>`).join('')}</ul></div>
    <div><h2><a href="/spirits/">주류 상식</a></h2><ul>${D.SPIRITS.map(x=>`<li><a href="/spirits/${x.id}/">${esc(x.ko)}</a></li>`).join('')}</ul></div>
    <div><h2><a href="/food/">안주 레시피</a></h2><ul>${D.FOOD.map(x=>`<li><a href="/food/${x.id}/">${esc(x.ko)}</a></li>`).join('')}</ul></div>
    <div><h2>조주기능사</h2><ul><li><a href="/quiz/">필기 예상문제 ${QUIZ.length}개와 해설</a></li></ul></div>
    <div><h2>Jigger</h2><ul><li><a href="/about/">소개 · 문의</a></li></ul></div>
  </nav>
  <!-- /build:links -->`;
const re = /<!-- build:links[\s\S]*?<!-- \/build:links -->/;
if (!re.test(html)) throw new Error('index.html에 build:links 자리 표시가 없어요');
const next = html.replace(re, links);
if (next !== html) { wr('index.html', next); console.log('updated index.html links'); }
console.log(`built ${pages.length} pages + sitemap.xml`);
