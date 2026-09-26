#!/usr/bin/env node
/* 사이트 빌드 (커밋할 때 pre-commit 훅이 실행해요)
   - photos.js : images/ 에 있는 사진 목록. 없는 사진은 요청하지 않게 해요.
   - --preview : 검색용 정적 페이지 미리보기 (네그로니, 조주기능사 필기)
   데이터는 index.html의 데이터 구간과 quiz-questions.js에서 그대로 읽어요. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import {fileURLToPath} from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://jigger-cyan.vercel.app';
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const wr = (f, s) => { const p = path.join(ROOT, f); fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, s); };

/* ---------- 사진 목록 ---------- */
const PHOTOS = {};
for (const d of ['cocktails', 'spirits', 'food']) {
  const dir = path.join(ROOT, 'images', d);
  PHOTOS[d] = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f=>f.endsWith('.webp')).map(f=>f.slice(0, -5)).sort() : [];
}
wr('photos.js', `/* scripts/build.mjs가 자동으로 만들어요. 직접 고치지 마세요. */\nwindow.PHOTOS = ${JSON.stringify(PHOTOS)};\n`);

if (!process.argv.includes('--preview')) process.exit(0);

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
  return {RECIPES, SPIRITS, FOOD, BASE_EN, DIFF, glassSVG, plateSVG}; })()`);
const qctx = {window:{}};
vm.runInNewContext(rd('quiz-questions.js'), qctx);
const QUIZ = qctx.window.QUIZ, QCATS = qctx.window.QUIZ_CATS;

/* 검색에서 자주 쓰는 다른 표기 */
const ALIAS = {
  mojito:['모히또'], margarita:['마르가리타'], 'pina-colada':['피나콜라다'], 'gin-tonic':['진토닉'],
  'moscow-mule':['모스코뮬'], 'dark-n-stormy':['다크앤스토미'], 'tom-collins':['톰콜린스'],
  'old-fashioned':['올드패션드'], 'tequila-sunrise':['데킬라 선라이즈'], 'whiskey-sour':['위스키사워']
};
const BASE_SPIRIT = {'진':['gin'], '럼':['rum'], '위스키':['whisky'], '보드카':['vodka'], '테킬라':['tequila'], '브랜디':['brandy'], '와인·리큐어':['wine','liqueur']};
const MARK = ['①','②','③','④'];

/* ---------- 공통 ---------- */
const esc = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g,'\\u003c')}</script>`;
const FONT = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@600;700&display=swap';
const NAV = [['/', '칵테일 레시피', 'cocktail'], ['/#spirits', '주류 상식', 'spirit'], ['/#food', '안주 레시피', 'food'], ['/quiz/', '조주기능사 필기', 'quiz']];

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
<link rel="canonical" href="${SITE}${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Jigger">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${url}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#E9E2D3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#17110C" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONT}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="${FONT}"></noscript>
<link rel="stylesheet" href="/page.css">
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
    <span>음주는 성인만, 적당히 즐겨요.</span>
  </footer>
</div>
`;
}
function thumb(dir, item, alt){
  if (PHOTOS[dir].includes(item.id)) return `<img src="/images/${dir}/${item.id}.webp" alt="${esc(alt)}" width="1000" height="1000" loading="lazy">`;
  return dir==='food' ? D.plateSVG(item, 'c'+item.id) : D.glassSVG(item, 'c'+item.id);
}
function card(dir, item, alt){
  return `<a class="card" href="/${dir}/${item.id}/"><span class="cthumb" style="--liq:${item.liquid||item.color}">${thumb(dir, item, alt)}</span>
      <span class="cname">${esc(item.ko)}</span><span class="cen">${esc(item.en)}</span></a>`;
}
function ingText(i){
  const [name, q, u] = i;
  if (typeof q === 'string') return `${name} ${q}`;
  if (u === 'ml') return `${name} ${q} ml`;
  return `${name} ${q}${u==='dash' ? ' dash' : u}`;
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
  const alias = ALIAS[r.id] || [];
  const diff = D.DIFF[r.diff-1];
  const abv = r.abv ? `약 ${r.abv}%` : '논알콜 (0%)';
  const photo = PHOTOS.cocktails.includes(r.id);
  const image = photo ? `${SITE}/images/cocktails/${r.id}.webp` : `${SITE}/og.jpg`;
  const title = zero ? `${r.ko} 레시피 · 무알콜 칵테일 만드는 법 (${r.en}) | Jigger` : `${r.ko} 레시피 · 만드는 법과 비율 (${r.en}) | Jigger`;
  const desc = `${r.ko}(${r.en}) 만드는 법. 재료: ${r.ing.map(ingText).join(', ')}. ${r.method} 기법, ${r.glassName}. 도수 ${abv}, 난이도 ${diff}.`;
  const c = crumbs([['Jigger','/'], ['칵테일 레시피','/'], [r.ko, url]]);

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
        <h1>${esc(r.ko)} <span class="en">${esc(r.en)}</span></h1>
        ${alias.length ? `<p class="aka">다른 표기: ${alias.map(esc).join(', ')}</p>` : ''}
        <div class="tags">${r.flav.map(f=>`<span class="tag">${f}</span>`).join('')}</div>
        <p class="lead">${esc(r.note)}</p>
        <dl class="spec">
          <div><dt>도수</dt><dd>${abv}</dd></div>
          <div><dt>기법</dt><dd>${r.method}</dd></div>
          <div><dt>글라스</dt><dd>${r.glassName}</dd></div>
          <div><dt>난이도</dt><dd>${diff}</dd></div>
          <div class="wide"><dt>가니시</dt><dd>${esc(r.garnish)}</dd></div>
        </dl>
        <section class="sec">
          <div class="sec-h"><h2>재료</h2><span class="prog">1잔 기준</span></div>
          <ul class="ings">${r.ing.map(i=>`
            <li><span class="sw ${i[3]?'':'none'}"${i[3]?` style="--c:${i[3]}"`:''}></span><span>${esc(i[0])}</span><span class="amt">${
              typeof i[1]==='string' ? esc(i[1]) : i[2]==='ml' ? `${i[1]} ml<i>${ozText(i[1])}</i>` : `${i[1]}${i[2]==='dash'?' dash':i[2]}`}</span></li>`).join('')}
          </ul>
        </section>
        <section class="sec">
          <div class="sec-h"><h2>만드는 법</h2><span class="prog">${r.method}</span></div>
          <ol class="steps">${r.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
        </section>
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
    keywords:[`${r.ko} 레시피`, `${r.ko} 만드는 법`, r.en, zero ? '무알콜 칵테일' : `${r.base} 칵테일`, ...alias].join(', '),
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
      <div class="sec-h"><h2>주류 상식으로 복습하기</h2></div>
      <div class="cards">${D.SPIRITS.slice(0, 4).map(s=>card('spirits', s, s.ko)).join('')}</div>
    </section>`;
  return {url, html:page({url, title, desc, image:`${SITE}/og.jpg`, section:'quiz', body, jsonld:[c.list]})};
}

/* ---------- 쓰기 ---------- */
const pages = [cocktailPage(D.RECIPES.find(r=>r.id==='negroni')), quizPage()];
for (const p of pages) wr(p.url.slice(1) + 'index.html', p.html);
console.log('built', pages.map(p=>p.url).join(', '));
