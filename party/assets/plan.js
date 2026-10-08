/* 내 파티 만들기: 한 화면 입력(질문 3개 + 더 자세히) → 파티 템플릿 추천 → 수량 · 비용 · 장보기 · 준비 순서 계산
   결과는 요약 카드 + 탭 3개(메뉴 · 장보기 · 준비 순서). 장보기에서 “있어요”를 누르면 그 품목은 비용에서 빠져요.
   - 계산은 아래 "계산" 부분의 함수들이 전부 맡아요(화면과 분리). 가격은 plan-data.js의 추정 범위예요.
   - 입력 · 결과 · 체크 상태는 이 브라우저(localStorage)에만 저장해요. 서버로 보내지 않아요.
   데이터: data.js(레시피 · 안주 · 파티), plan-data.js(가격 · 수량 · 템플릿), affiliate.js(도구 링크) */
(function(){
'use strict';
var P = window.JIGGER_PLAN, D = window.JIGGER_DATA, A = window.AFFILIATE;
var root = document.getElementById('planApp');
if (!P || !D || !root) return;
var R = {}, F = {}, PT = {}, G = D.GLASS || {};
D.RECIPES.forEach(function(r){ R[r.id] = r; });
D.FOOD.forEach(function(f){ F[f.id] = f; });
D.PARTIES.forEach(function(p){ PT[p.id] = p; });
var KEY = 'jigger.partyplan.v1';
var LABEL = {};
[P.PURPOSES, P.MOODS, P.DRINK_MODES, P.AVOID, P.OWNABLE].forEach(function(list){ list.forEach(function(x){ LABEL[x[0]] = x[1]; }); });
var TIME_LABEL = {}; P.TIMES.forEach(function(t){ TIME_LABEL[t[0]] = t[1]; });

function esc(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function won(n){ return Math.round(n).toLocaleString('ko-KR') + '원'; }
function range(lo, hi){ return lo === hi ? won(lo) : Math.round(lo).toLocaleString('ko-KR') + '~' + won(hi); }
function minutes(m){ return m >= 60 ? Math.floor(m / 60) + '시간' + (m % 60 ? ' ' + (m % 60) + '분' : '') : m + '분'; }
function hasAny(tags, avoid){ return (tags || []).some(function(t){ return avoid.indexOf(t) >= 0; }); }

/* ======================= 계산 ======================= */
/* 음료 하나의 정보: 칵테일(RECIPES) 또는 병 술(BOTTLES) */
function drinkInfo(key){
  if (key.indexOf('bottle:') === 0) {
    var b = P.BOTTLES[key.slice(7)];
    return {key: key, bottle: b, name: b.name, en: b.en, link: b.link, tags: P.ITEMS[b.item][7], zero: false};
  }
  var r = R[key];
  var tags = (P.COCKTAIL_TAGS[key] || []).slice();
  r.ing.forEach(function(i){ var m = P.COCKTAIL_ING[i[0]]; if (m && P.ITEMS[m[0]]) tags = tags.concat(P.ITEMS[m[0]][7]); });
  return {key: key, recipe: r, name: r.ko, en: r.en, link: '/cocktails/' + r.id + '/', tags: tags, zero: !r.abv};
}
function dishTags(id){
  var d = P.DISHES[id], tags = (d.tags || []).slice();
  d.items.forEach(function(it){ tags = tags.concat(P.ITEMS[it[0]][7]); });
  return tags;
}
/* 준비 시간: 혼자 준비한다고 보고 직접 일하는 시간은 더하고, 기다리는 시간(굽기 · 삶기 · 실온)은 그동안 다른 일을 해요.
   전날 해 두는 것(ahead)은 당일 시간에서 빼요. */
function prepMinutes(dishIds, drinkPrep){
  var active = drinkPrep, longest = 0;
  dishIds.forEach(function(id){ var d = P.DISHES[id]; active += d.active; if (!d.ahead) longest = Math.max(longest, d.active + d.passive); });
  return Math.max(active, longest);
}

/* 템플릿 하나를 조건에 맞춰 준비안으로. 맞출 수 없으면 {fail: 이유} */
function buildPlan(t, inp){
  var people = inp.people, avoid = inp.avoid || [], owned = inp.owned || [];
  var limit = inp.time || Infinity;
  // 1) 음료: 피할 재료가 든 것 빼기, 무알코올은 대안으로 채우기
  var alc = inp.drink === 'zero' ? [] : t.drinks.alc.map(drinkInfo).filter(function(d){ return !hasAny(d.tags, avoid); });
  var zero = t.drinks.zero.map(drinkInfo).filter(function(d){ return !hasAny(d.tags, avoid); });
  if (!zero.length) zero = P.ZERO_FALLBACK.map(drinkInfo).filter(function(d){ return !hasAny(d.tags, avoid); }).slice(0, 2);
  if (inp.drink !== 'zero' && !alc.length) return {fail: 'drinks'};
  if (!zero.length) return {fail: 'drinks'};
  var S = P.SERVINGS[inp.drink || 'alc'];
  var drinks = [];
  [[alc, people * S.alc], [zero, people * S.zero]].forEach(function(pair){
    var list = pair[0], total = pair[1];
    if (!total) return;
    var each = Math.ceil(total / list.length);
    list.forEach(function(d){ drinks.push(Object.assign({servings: each}, d)); });
  });
  var cocktails = drinks.filter(function(d){ return d.recipe; });
  var drinkPrep = drinks.length ? 10 + 5 * cocktails.length : 0;

  // 2) 안주: 피할 재료 빼고, 준비 시간 안에 들어오는 것만 순서대로
  var target = people <= 3 ? 3 : 4;
  var candidates = t.foods.filter(function(id){ return P.DISHES[id] && !hasAny(dishTags(id), avoid); });
  var dishes = [];
  candidates.forEach(function(id){
    if (dishes.length >= target) return;
    if (prepMinutes(dishes.concat(id), drinkPrep) <= limit) dishes.push(id);
  });
  if (dishes.length < 2) return {fail: candidates.length < 2 ? 'avoid' : 'time'};

  // 3) 품목 합산 (공유 재료는 한 줄로)
  var need = {}, uses = {}, pantry = false;
  function add(id, qty, why){ if (!qty) return; need[id] = (need[id] || 0) + qty; (uses[id] = uses[id] || []).indexOf(why) < 0 && uses[id].push(why); }
  var scale = people / 4;
  dishes.forEach(function(id){
    var d = P.DISHES[id];
    d.items.forEach(function(it){ add(it[0], it[1] * scale, F[id].ko); });
    if (d.pantry.length) pantry = true;
  });
  drinks.forEach(function(d){
    if (d.bottle) { add(d.bottle.item, d.bottle.ml * d.servings, d.name); return; }
    d.recipe.ing.forEach(function(i){
      var m = P.COCKTAIL_ING[i[0]];
      if (!m) return;
      if (m[0] === 'pantry') { pantry = true; return; }
      add(m[0], i[1] * m[1] * d.servings, d.name);
    });
  });
  if (cocktails.length) add('ice', people * P.ICE_KG_PER_PERSON, '음료');
  t.decor.forEach(function(x){ add(x[0], x[0] === 'plates' ? people : x[1], '꾸미기'); });
  if (pantry) add('pantry', 1, '안주 · 음료');

  // 4) 구매 단위로 올림 → 비용 (이미 가진 것은 비용에서 빼요)
  var lines = Object.keys(need).map(function(id){
    var it = P.ITEMS[id];
    var units = Math.max(1, Math.ceil(need[id] / it[3] - 1e-9));
    var own = owned.indexOf(id) >= 0;
    return {id: id, name: it[0], cat: it[1], unit: it[4], units: units, need: need[id], base: it[2],
      lo: own ? 0 : units * it[5], hi: own ? 0 : units * it[6], owned: own, uses: uses[id],
      left: it[2] === 'ml' ? Math.round(units * it[3] - need[id]) : 0};
  });
  var cost = {food: [0, 0], drink: [0, 0], decor: [0, 0], total: [0, 0]};
  lines.forEach(function(l){ cost[l.cat][0] += l.lo; cost[l.cat][1] += l.hi; cost.total[0] += l.lo; cost.total[1] += l.hi; });
  var budget = inp.budget > 0 ? inp.budget : null;
  var status = !budget ? 'unknown' : cost.total[1] <= budget ? 'fit' : cost.total[0] <= budget ? 'tight' : 'over';

  // 5) 도구 · 잔
  var toolIds = [], glasses = {};
  cocktails.forEach(function(d){
    if (A) A.toolsFor(d.recipe).forEach(function(x){ var id = Object.keys(A.items).filter(function(k){ return A.items[k] === x; })[0]; if (toolIds.indexOf(id) < 0) toolIds.push(id); });
    var g = G[d.recipe.glass]; if (g) glasses[g.name] = true;
  });
  drinks.forEach(function(d){ if (d.bottle) glasses[d.bottle.item === 'beer' ? '맥주잔' : d.bottle.item === 'soju' ? '소주잔' : d.bottle.item === 'makgeolli' ? '막걸리 잔' : '와인잔'] = true; });
  var tools = toolIds.map(function(id){ var x = A.items[id]; return {id: 'tool:' + id, name: x.name, url: x.url, owned: owned.indexOf('tool:' + id) >= 0}; });
  Object.keys(glasses).forEach(function(g){ tools.push({id: 'glass:' + g, name: g, count: people, owned: owned.indexOf('glass:' + g) >= 0}); });

  // 6) 준비 순서
  var steps = {before: [], start: [], arrive: []};
  steps.before.push('장보기 (아래 목록)');
  if (drinks.length) steps.before.push('술 · 음료를 냉장고에 넣어 차갑게 해요.');
  if (cocktails.length && owned.indexOf('ice') < 0) steps.before.push('얼음을 사 두거나 얼려 둬요 (약 ' + (people * P.ICE_KG_PER_PERSON) + 'kg).');
  dishes.forEach(function(id){ if (P.DISHES[id].ahead) steps.before.push(F[id].ko + ': 미리 만들어 재워 둬요.'); });
  dishes.filter(function(id){ return P.DISHES[id].cook && !P.DISHES[id].ahead; })
    .sort(function(a, b){ return (P.DISHES[b].active + P.DISHES[b].passive) - (P.DISHES[a].active + P.DISHES[a].passive); })
    .forEach(function(id){ var d = P.DISHES[id]; steps.start.push(F[id].ko + ' 만들기 (직접 ' + d.active + '분' + (d.passive ? ' · 기다리는 시간 ' + d.passive + '분' : '') + ')'); });
  dishes.forEach(function(id){ var d = P.DISHES[id]; if (!d.cook && !d.ahead) steps.arrive.push(F[id].ko + ' 담아 내기 (' + d.active + '분)' + (d.note ? ' · ' + d.note : '')); });
  if (cocktails.length) steps.arrive.push('칵테일 재료 손질(시트러스 썰기 · 즙 내기)과 잔 꺼내기 (' + drinkPrep + '분)');
  else if (drinks.length) steps.arrive.push('잔과 음료 꺼내 두기');

  return {id: t.id, party: PT[t.id], people: people, drinks: drinks, dishes: dishes, lines: lines, cost: cost, budget: budget, status: status,
    tools: tools, steps: steps, minutes: prepMinutes(dishes, drinkPrep), ahead: steps.before.length - 1, scale: scale};
}

/* 조건으로 템플릿 점수 매기기 → 가장 맞는 안 1개 + 대안 2개. 맞는 게 없으면 이유 */
function recommend(inp){
  var ok = [], fails = {};
  P.TEMPLATES.forEach(function(t){
    var plan = buildPlan(t, inp);
    if (plan.fail) { fails[plan.fail] = (fails[plan.fail] || 0) + 1; return; }
    var score = 0, why = [];
    if (t.purposes.indexOf(inp.purpose) >= 0) { score += t.purposes[0] === inp.purpose ? 5 : 4; why.push('‘' + LABEL[inp.purpose] + '’에 어울려요'); }
    (inp.mood || []).forEach(function(m){ if (t.moods.indexOf(m) >= 0) { score += 2; why.push('‘' + LABEL[m] + '’ 분위기'); } });
    if (inp.people >= t.ideal[0] && inp.people <= t.ideal[1]) score += 1;
    if (plan.status === 'fit') { score += 3; why.push('예산 안에 들어와요'); } else if (plan.status === 'tight') score += 1; else if (plan.status === 'over') score -= 3;
    plan.score = score; plan.why = why;
    ok.push(plan);
  });
  ok.sort(function(a, b){ return b.score - a.score || a.cost.total[1] - b.cost.total[1]; });
  return {plans: ok.slice(0, 3), fails: fails};
}

/* ======================= 상태 · 저장 ======================= */
function fresh(){ return {input: {purpose: '', people: 4, budgetUnknown: false, budget: '', time: 0, drink: 'alc', mood: [], avoid: [], avoidNote: '', owned: ['pantry']}, done: false, sel: 0, tab: 'menu', checks: {}, prices: false}; }
var state = load() || fresh();
if (!state.input || state.step !== undefined) state = Object.assign(fresh(), {input: Object.assign(fresh().input, state.input || {})});   // 예전 4단계 저장 형식이면 새로 시작
function load(){ try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
function save(){ try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
function input(){ var i = state.input; return {purpose: i.purpose, people: +i.people, budget: i.budgetUnknown ? null : +i.budget, time: +i.time, drink: i.drink, mood: i.mood, avoid: i.avoid, owned: i.owned}; }

/* ======================= 화면: 입력 (한 화면) ======================= */
function chip(name, value, label, checked, type){
  return '<label class="pchip"><input type="' + (type || 'radio') + '" name="' + name + '" value="' + esc(value) + '"' + (checked ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
}
function formView(msg){
  var i = state.input, more = i.time || i.drink !== 'alc' || i.mood.length || i.avoid.length || i.avoidNote;
  root.innerHTML = '<form class="pform" novalidate>' +
    '<fieldset class="pq"><legend>어떤 모임인가요?</legend><div class="pchips">' +
      P.PURPOSES.map(function(x){ return chip('purpose', x[0], x[1], i.purpose === x[0]); }).join('') + '</div></fieldset>' +
    '<div class="prow">' +
      '<fieldset class="pq"><legend>몇 명인가요?</legend><div class="pstep"><button type="button" class="chip" data-people="-1" aria-label="한 명 줄이기">−</button><output id="pPeople">' + i.people + '명</output><button type="button" class="chip" data-people="1" aria-label="한 명 늘리기">+</button></div></fieldset>' +
      '<fieldset class="pq"><legend>예산은요?</legend><div class="field pbudget"><label for="pBudget" class="vh">총예산 (원)</label><input id="pBudget" type="number" inputmode="numeric" min="0" step="10000" placeholder="100000" value="' + esc(i.budget) + '"' + (i.budgetUnknown ? ' disabled' : '') + '><span>원</span></div>' +
        '<label class="check"><input type="checkbox" id="pUnknown"' + (i.budgetUnknown ? ' checked' : '') + '> 아직 몰라요</label></fieldset>' +
    '</div>' +
    '<details class="pmore"' + (more ? ' open' : '') + '><summary>더 자세히 (준비 시간 · 음료 · 피할 음식)</summary>' +
      '<fieldset class="pq"><legend>준비할 시간</legend><div class="pchips">' + P.TIMES.map(function(x){ return chip('time', x[0], x[1], +i.time === x[0]); }).join('') + '</div></fieldset>' +
      '<fieldset class="pq"><legend>음료</legend><div class="pchips">' + P.DRINK_MODES.map(function(x){ return chip('drink', x[0], x[1], i.drink === x[0]); }).join('') + '</div></fieldset>' +
      '<fieldset class="pq"><legend>분위기</legend><div class="pchips">' + P.MOODS.map(function(x){ return chip('mood', x[0], x[1], i.mood.indexOf(x[0]) >= 0, 'checkbox'); }).join('') + '</div></fieldset>' +
      '<fieldset class="pq"><legend>피해야 하는 음식</legend><div class="pchips">' + P.AVOID.map(function(x){ return chip('avoid', x[0], x[1], i.avoid.indexOf(x[0]) >= 0, 'checkbox'); }).join('') + '</div>' +
        '<div class="field"><label for="pAvoidNote">메모</label><input id="pAvoidNote" maxlength="80" value="' + esc(i.avoidNote) + '" placeholder="예: 고수 싫어함 (나에게만 보여요)"></div></fieldset>' +
    '</details>' +
    '<p class="form-status err" role="alert">' + (msg || '') + '</p>' +
    '<div><button type="submit" class="cta">준비안 보기 →</button></div>' +
    '<p class="note">예산은 음식 · 음료 · 꾸미기를 합친 금액이에요(장소비 제외). 입력한 내용은 이 브라우저에만 저장돼요.</p>' +
  '</form>';
}
function readForm(){
  var f = root.querySelector('form'), i = state.input;
  var val = function(n){ var x = f.querySelector('input[name="' + n + '"]:checked'); return x ? x.value : null; };
  var vals = function(n){ return [].map.call(f.querySelectorAll('input[name="' + n + '"]:checked'), function(x){ return x.value; }); };
  i.purpose = val('purpose') || '';
  i.budgetUnknown = f.querySelector('#pUnknown').checked; i.budget = f.querySelector('#pBudget').value;
  i.time = +(val('time') || 0); i.drink = val('drink') || 'alc';
  i.mood = vals('mood'); i.avoid = vals('avoid'); i.avoidNote = f.querySelector('#pAvoidNote').value.trim();
}
function checkForm(){
  var i = state.input;
  if (!i.purpose) return '어떤 모임인지 골라 주세요.';
  if (!i.budgetUnknown && !(+i.budget >= 10000)) return '예산을 1만 원 이상으로 적거나 ‘아직 몰라요’를 골라 주세요.';
  return '';
}

/* ======================= 화면: 결과 (요약 카드 + 탭 3개) ======================= */
var CAT = {drink: '음료', food: '안주 재료', decor: '꾸미기', tool: '잔 · 도구'};
function photo(dir, id){ return window.PHOTOS && window.PHOTOS[dir] && window.PHOTOS[dir].indexOf(id) >= 0 ? '/images/' + dir + '/sm/' + id + '.webp' : ''; }
function card(href, img, glyph, en, ko, meta){
  return '<a class="card" href="' + href + '"><span class="cthumb">' + (img ? '<img src="' + img + '" alt="" width="640" height="640" loading="lazy" decoding="async">' : '<span class="tglyph"><b>' + esc(glyph) + '</b></span>') + '</span>' +
    '<span class="cbody"><span class="cname">' + esc(en) + '</span><span class="cko">' + esc(ko) + ' · ' + esc(meta) + '</span></span></a>';
}
function budgetText(p){
  if (!p.budget) return '';
  if (p.status === 'fit') return '<span class="pok">예산 안 ✓</span>';
  if (p.status === 'tight') return '<span class="pwarn">예산 빠듯 · 최대 ' + won(p.cost.total[1] - p.budget) + ' 넘을 수 있어요</span>';
  return '<span class="pbad">예산보다 약 ' + range(p.cost.total[0] - p.budget, p.cost.total[1] - p.budget) + ' 더 들어요</span>';
}
function resultView(){
  var rec = recommend(input());
  if (!rec.plans.length) return noneView(rec.fails);
  if (state.sel >= rec.plans.length) state.sel = 0;
  var p = rec.plans[state.sel], pt = p.party, tab = state.tab || 'menu';
  var buy = p.lines.filter(function(l){ return !l.owned; });
  var shopN = buy.length + p.tools.filter(function(t){ return !t.owned; }).length;
  var alts = rec.plans.map(function(x, k){ return k === state.sel ? '' : '<button type="button" class="plink" data-sel="' + k + '">' + esc(x.party.ko) + '</button>'; }).filter(Boolean);
  var html = '<section class="psumcard" aria-live="polite">' +
      '<span class="eyebrow">' + (state.sel ? '다른 안' : '추천') + ' · ' + esc(pt.en) + '</span>' +
      '<h2 class="ptitle">' + esc(pt.ko) + ' <span>· ' + p.people + '명</span></h2>' +
      '<p class="pfig"><b>' + range(p.cost.total[0], p.cost.total[1]) + '</b><span>준비 ' + minutes(p.minutes) + '</span></p>' +
      (p.budget ? '<p class="pbud">' + budgetText(p) + '</p>' : '') +
      (p.why.length ? '<p class="pwhy">' + esc(p.why.join(' · ')) + '</p>' : '') +
      (alts.length ? '<p class="palt2">다른 안: ' + alts.join(' · ') + '</p>' : '') +
    '</section>' +
    '<div class="ptabs" role="tablist" aria-label="준비안">' +
      [['menu', '메뉴'], ['shop', '장보기 <i>' + shopN + '</i>'], ['prep', '준비 순서']].map(function(t){
        return '<button type="button" role="tab" id="tab-' + t[0] + '" aria-controls="pane" aria-selected="' + (tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') +
    '</div><div class="ppane" id="pane" role="tabpanel" aria-labelledby="tab-' + tab + '">';

  if (tab === 'menu') {
    html += '<div class="cards">' +
      p.drinks.map(function(d){
        return d.bottle ? card(d.link, '', d.servings, d.en, d.name, d.servings + (d.bottle.item === 'beer' ? '캔' : '잔')) : card(d.link, photo('cocktails', d.key), '', d.en, d.name, d.servings + '잔' + (d.zero ? ' · 무알코올' : ''));
      }).join('') +
      p.dishes.map(function(id){ var f = F[id]; return card('/food/' + id + '/', photo('food', id), '', f.en, f.ko, p.people + '명분'); }).join('') +
      '</div><p class="note">누르면 레시피로 가요. 술은 1인 2잔까지, 무알코올은 항상 함께 준비해요.</p>';
  }
  if (tab === 'shop') {
    var groups = ['drink', 'food', 'decor'].map(function(c){ return [c, p.lines.filter(function(l){ return l.cat === c && l.id !== 'pantry'; })]; });
    var pantry = p.lines.filter(function(l){ return l.id === 'pantry'; });
    if (pantry.length) groups[1][1] = groups[1][1].concat(pantry);
    groups.push(['tool', p.tools.map(function(t){ return {id: t.id, name: t.name, unit: t.count ? t.count + '개' : '', url: t.url, owned: t.owned, tool: true}; })]);
    html += '<div class="pshopbar"><span>' + buy.filter(function(l){ return state.checks[l.id]; }).length + ' / ' + buy.length + ' 샀어요</span>' +
      '<button type="button" class="plink" data-prices>' + (state.prices ? '가격 숨기기' : '가격 보기') + '</button></div>' +
      groups.filter(function(g){ return g[1].length; }).map(function(g){
        return '<h3 class="pgh">' + CAT[g[0]] + '</h3><ul class="pshop2">' + g[1].map(function(l){
          var unit = l.tool ? l.unit : (l.units > 1 ? l.unit + ' × ' + l.units : l.unit);
          return '<li class="' + (l.owned ? 'is-own' : state.checks[l.id] ? 'is-done' : '') + '">' +
            (l.owned || l.tool ? '<span class="pdot" aria-hidden="true"></span>' : '<input type="checkbox" id="c-' + esc(l.id) + '" data-item="' + esc(l.id) + '"' + (state.checks[l.id] ? ' checked' : '') + '>') +
            '<label' + (l.owned || l.tool ? '' : ' for="c-' + esc(l.id) + '"') + '><b>' + esc(l.name) + '</b>' + (unit ? ' <span>' + esc(unit) + '</span>' : '') +
              (state.prices && !l.tool && !l.owned ? ' <small>' + range(l.lo, l.hi) + '</small>' : '') + '</label>' +
            (l.tool && l.url && !l.owned ? '<a class="paff" href="' + esc(l.url) + '" target="_blank" rel="sponsored nofollow noopener">구매 ↗</a>' : '') +
            '<button type="button" class="pown" data-own="' + esc(l.id) + '" aria-pressed="' + !!l.owned + '">' + (l.owned ? '있어요 ✓' : '있어요') + '</button></li>';
        }).join('') + '</ul>';
      }).join('') +
      '<p class="note">“있어요”를 누르면 비용에서 빠져요. 가격은 지거가 정한 추정치예요.' + (A && p.tools.some(function(t){ return t.url && !t.owned; }) ? ' ' + esc(A.disclosure) : '') + '</p>';
  }
  if (tab === 'prep') {
    html += '<ol class="ptime">' + [['전날', p.steps.before], ['시작 전', p.steps.start], ['손님 도착 직전', p.steps.arrive]].filter(function(x){ return x[1].length; }).map(function(x){
      return '<li><b>' + x[0] + '</b><span>' + x[1].map(esc).join('<br>') + '</span></li>'; }).join('') + '</ol>' +
      '<p class="note">혼자 준비할 때 기준이에요. 굽거나 삶는 동안 다른 일을 한다고 계산했어요. <a href="/party/' + pt.id + '/">' + esc(pt.ko) + ' 아이디어 보기 →</a></p>';
  }
  html += '</div><div class="tbtns pfoot"><button type="button" class="cta" data-copy>준비안 복사</button><button type="button" class="chip" data-edit>조건 바꾸기</button><button type="button" class="chip" data-reset>처음부터</button></div>' +
    '<p class="form-status" id="pCopy" role="status"></p>';
  root.innerHTML = html;
  root._plan = p;
}
function noneView(fails){
  var tips = [];
  if (fails.time) tips.push('준비 시간을 늘려 보세요. 지금 시간 안에 만들 수 있는 안주가 2가지보다 적어요.');
  if (fails.avoid) tips.push('피해야 하는 음식을 줄여 보세요. 남는 안주가 2가지보다 적어요.');
  if (fails.drinks) tips.push('음료 조건을 바꿔 보세요.');
  root.innerHTML = '<section class="psumcard"><h2 class="ptitle">조건에 맞는 준비안이 없어요</h2><ul class="plist">' + tips.map(function(t){ return '<li>' + t + '</li>'; }).join('') + '</ul>' +
    '<div class="tbtns"><button type="button" class="cta" data-edit>조건 바꾸기</button></div></section>';
}

/* 공유용 텍스트: 피해야 하는 음식 · 메모 같은 개인 입력은 넣지 않아요 */
function planText(p){
  var L = ['[' + p.party.ko + '] ' + p.people + '명 홈파티 준비안 — Jigger',
    '예상 비용 ' + range(p.cost.total[0], p.cost.total[1]) + ' (추정) · 준비 약 ' + minutes(p.minutes), '',
    '음료: ' + p.drinks.map(function(d){ return d.name; }).join(', '),
    '안주: ' + p.dishes.map(function(id){ return F[id].ko; }).join(', '), '', '장보기:'];
  p.lines.filter(function(l){ return !l.owned; }).forEach(function(l){ L.push('- ' + l.name + ' ' + l.unit + (l.units > 1 ? ' × ' + l.units : '')); });
  L.push('', 'https://jiggerbar.com/party/' + p.party.id + '/');
  return L.join('\n');
}

function render(msg){ if (state.done) resultView(); else formView(msg); save(); }

/* ======================= 이벤트 ======================= */
root.addEventListener('submit', function(e){
  e.preventDefault(); readForm();
  var err = checkForm(); if (err) return render(err);
  state.done = true; state.sel = 0; state.tab = 'menu';
  render(); root.scrollIntoView({block: 'start'});
});
root.addEventListener('click', function(e){
  var b = e.target.closest('button'); if (!b) return;
  var i = state.input;
  if (b.dataset.people) { i.people = Math.min(8, Math.max(2, +i.people + +b.dataset.people)); root.querySelector('#pPeople').textContent = i.people + '명'; return save(); }
  if (b.dataset.sel) { state.sel = +b.dataset.sel; return render(); }
  if (b.dataset.tab) { state.tab = b.dataset.tab; render(); var t = root.querySelector('[data-tab="' + state.tab + '"]'); if (t) t.focus(); return; }
  if (b.hasAttribute('data-prices')) { state.prices = !state.prices; return render(); }
  if (b.dataset.own) {   // 있어요: 이미 가진 것 → 비용 · 장보기에서 빼기 (다시 누르면 되돌리기)
    var id = b.dataset.own, k = i.owned.indexOf(id);
    if (k >= 0) i.owned.splice(k, 1); else i.owned.push(id);
    render(); var again = root.querySelector('[data-own="' + id + '"]'); if (again) again.focus(); return;
  }
  if (b.hasAttribute('data-edit')) { state.done = false; return render(); }
  if (b.hasAttribute('data-reset')) { state = fresh(); return render(); }
  if (b.hasAttribute('data-copy')) {
    var text = planText(root._plan), out = root.querySelector('#pCopy');
    var ok = function(){ out.textContent = '복사했어요. 메신저에 붙여넣어 공유해 보세요.'; out.className = 'form-status ok'; };
    var fallback = function(){ var ta = document.createElement('textarea'); ta.value = text; ta.className = 'pcopy'; out.after(ta); ta.select(); out.textContent = '아래 글을 길게 눌러 복사해 주세요.'; };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
  }
});
root.addEventListener('change', function(e){
  if (e.target.id === 'pUnknown') root.querySelector('#pBudget').disabled = e.target.checked;
  if (e.target.dataset.item) { state.checks[e.target.dataset.item] = e.target.checked; render(); var c = root.querySelector('[data-item="' + e.target.dataset.item + '"]'); if (c) c.focus(); }
});

render();
window.JiggerPlanner = {buildPlan: buildPlan, recommend: recommend, planText: planText};   // 테스트용
})();
