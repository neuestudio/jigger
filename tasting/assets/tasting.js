/* 테이스팅 노트 공통 화면 부품: 별점 입력, 주종별 향·맛·여운 선택지, 술 정보 · 리뷰 입력 칸
   관리자 화면(admin.js), 술 상세 페이지 리뷰 쓰기(drink.js), 나의 기록장(my.js)이 함께 써요.
   주종 · 선택지 · 길이 제한은 config.js(window.TASTING, worker/tasting-config.js에서 빌드)에서 읽어요. */
(function(){
'use strict';
var C = window.TASTING;
var TYPE = {};
C.types.forEach(function(t){ TYPE[t.key] = t; });

function esc(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function today(){ var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function starsHTML(r, size){ return '<span class="stars' + (size ? ' ' + size : '') + '" style="--r:' + r + '" role="img" aria-label="5점 만점에 ' + r + '점"></span>'; }
function typeOf(k){ return TYPE[k] || TYPE.other; }
function notesOf(k){ return C.notes[typeOf(k).notes] || C.notes.other; }
function fmtDate(d){ return d ? String(d).replace(/-/g, '.') : '날짜 미상'; }
function won(n){ return n == null || n === '' ? '' : Number(n).toLocaleString('ko-KR') + '원'; }
function paras(t){ return String(t || '').trim().split(/\n\s*\n/).map(function(p){ return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
function store(k, v){ try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

/* ---------- 별점 입력: 별을 눌러서 고르고(반 개 단위), 키보드 ← → 로도 바꿀 수 있어요 ---------- */
function starInputHTML(v){
  v = v || 0;
  return '<div class="tstar"><div class="tstar-hit" role="slider" tabindex="0" aria-label="평점" aria-valuemin="0.5" aria-valuemax="5" aria-valuenow="' + v + '" aria-valuetext="' + (v ? '5점 만점에 ' + v + '점' : '아직 고르지 않음') + '">' +
    '<span class="stars xl" style="--r:' + v + '" aria-hidden="true"></span></div>' +
    '<output class="tstar-v">' + (v ? v.toFixed(1) : '–') + '</output>' +
    '<span class="tstar-hint">' + (v ? '' : '별을 눌러 골라 주세요 (왼쪽 절반은 반 개)') + '</span>' +
    '<input type="hidden" name="rating" value="' + (v || '') + '"></div>';
}
function bindStars(root){
  var hit = root.querySelector('.tstar-hit'); if (!hit) return;
  var box = hit.closest('.tstar'), stars = hit.querySelector('.stars'), out = box.querySelector('output'), hint = box.querySelector('.tstar-hint'), input = box.querySelector('input');
  function show(v){ stars.style.setProperty('--r', v); out.textContent = v ? v.toFixed(1) : '–'; }
  function set(v){
    v = Math.min(5, Math.max(0.5, Math.round(v * 2) / 2));
    input.value = v; show(v); hint.textContent = '';
    hit.setAttribute('aria-valuenow', v); hit.setAttribute('aria-valuetext', '5점 만점에 ' + v + '점');
  }
  function at(e){ var r = stars.getBoundingClientRect(); return Math.ceil(Math.min(1, Math.max(0.001, (e.clientX - r.left) / r.width)) * 10) / 2; }
  hit.addEventListener('click', function(e){ set(at(e)); hit.focus(); });
  hit.addEventListener('pointermove', function(e){ if (e.pointerType === 'mouse') show(at(e)); });
  hit.addEventListener('pointerleave', function(){ show(+input.value || 0); });
  hit.addEventListener('keydown', function(e){
    var v = +input.value || 0, k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowUp') set(v ? v + 0.5 : 3);
    else if (k === 'ArrowLeft' || k === 'ArrowDown') set(v ? v - 0.5 : 3);
    else if (k === 'Home') set(0.5);
    else if (k === 'End') set(5);
    else if (/^[1-5]$/.test(k)) set(+k);
    else return;
    e.preventDefault();
  });
  box._set = set;
}

/* ---------- 향 · 맛 · 여운: 주종별 선택지 + 직접 추가 ---------- */
function notesHTML(type, val){
  val = val || {};
  var n = notesOf(type);
  return C.parts.map(function(p){
    var k = p[0], chosen = val[k] || [], opts = n[k] || [];
    var extra = chosen.filter(function(x){ return opts.indexOf(x) < 0; });
    return '<fieldset class="tfs" data-part="' + k + '"><legend>' + p[1] + ' · ' + p[2] + '</legend><div class="chips">' +
      opts.concat(extra).map(function(o){ return '<button class="chip" type="button" data-note="' + esc(o) + '" aria-pressed="' + (chosen.indexOf(o) >= 0) + '">' + esc(o) + '</button>'; }).join('') +
      '<span class="tadd"><input type="text" maxlength="' + C.limits.note + '" placeholder="직접 추가" aria-label="' + p[1] + ' 직접 추가" data-addnote><button class="chip" type="button" data-addbtn aria-label="' + p[1] + ' 추가">+</button></span>' +
      '</div></fieldset>';
  }).join('');
}
function bindNotes(root){
  root.addEventListener('click', function(e){
    var b = e.target.closest('[data-note]');
    if (b) {
      var on = b.getAttribute('aria-pressed') !== 'true', fs = b.closest('[data-part]');
      if (on && fs.querySelectorAll('[data-note][aria-pressed="true"]').length >= C.limits.notes) return flash(b, C.limits.notes + '개까지 고를 수 있어요.');
      b.setAttribute('aria-pressed', String(on)); return;
    }
    var a = e.target.closest('[data-addbtn]'); if (a) addNote(a.previousElementSibling);
  });
  root.addEventListener('keydown', function(e){ if (e.key === 'Enter' && e.target.hasAttribute('data-addnote')) { e.preventDefault(); addNote(e.target); } });
}
function addNote(input){
  var v = input.value.trim(); if (!v) return;
  var fs = input.closest('[data-part]'), exist = [].filter.call(fs.querySelectorAll('[data-note]'), function(b){ return b.dataset.note === v; })[0];
  if (fs.querySelectorAll('[data-note][aria-pressed="true"]').length >= C.limits.notes && !(exist && exist.getAttribute('aria-pressed') === 'true')) return flash(input, C.limits.notes + '개까지 고를 수 있어요.');
  if (!exist) { input.parentNode.insertAdjacentHTML('beforebegin', '<button class="chip" type="button" data-note="' + esc(v) + '" aria-pressed="true">' + esc(v) + '</button>'); }
  else exist.setAttribute('aria-pressed', 'true');
  input.value = '';
}
function readNotes(root){
  var out = {};
  C.parts.forEach(function(p){
    var fs = root.querySelector('[data-part="' + p[0] + '"]');
    out[p[0]] = fs ? [].map.call(fs.querySelectorAll('[data-note][aria-pressed="true"]'), function(b){ return b.dataset.note; }) : [];
  });
  return out;
}
function flash(el, msg){ var f = el.closest('form'); if (f) say(f, msg, 'err'); }

/* ---------- 술 정보 칸 (관리자 술 등록 · 나의 기록장) ---------- */
function drinkFieldsHTML(o){
  var L = C.limits;
  var types = C.types.map(function(t){ return '<option value="' + t.key + '">' + esc(t.ko) + '</option>'; }).join('');
  return '<div class="tgrid">' +
    '<div class="field"><label for="fName">이름 (필수)</label><input id="fName" name="name" maxlength="' + L.name + '" required placeholder="예: 글렌피딕 12년" autocomplete="off"></div>' +
    '<div class="field"><label for="fNameEn">영문 이름</label><input id="fNameEn" name="name_en" maxlength="' + L.name_en + '" placeholder="예: Glenfiddich 12" autocomplete="off" lang="en"></div>' +
    '<div class="field"><label for="fType">주종 (필수)</label><select id="fType" name="type">' + types + '</select></div>' +
    '<div class="field"><label for="fSub">품종 · 세부 종류</label><input id="fSub" name="subtype" maxlength="' + L.subtype + '" list="fSubList" autocomplete="off"><datalist id="fSubList"></datalist></div>' +
    '<div class="field"><label for="fProd">생산자 · 브랜드</label><input id="fProd" name="producer" maxlength="' + L.producer + '" autocomplete="off"></div>' +
    '<div class="field"><label for="fCountry">원산지</label><input id="fCountry" name="country" maxlength="' + L.country + '" placeholder="예: 스코틀랜드, 이탈리아 베네토" autocomplete="off"></div>' +
    '<div class="field"><label for="fAbv">도수 (%)</label><input id="fAbv" name="abv" type="number" min="0" max="100" step="0.1" inputmode="decimal"></div>' +
    '<div class="field"><label for="fPrice">가격 (원)</label><input id="fPrice" name="price" type="number" min="0" step="100" inputmode="numeric"></div>' +
  '</div>';
}
function bindDrink(form, onType){
  var type = form.elements.type, list = form.querySelector('#fSubList');
  function subs(){ list.innerHTML = typeOf(type.value).subs.map(function(s){ return '<option value="' + esc(s) + '">'; }).join(''); if (onType) onType(type.value); }
  type.addEventListener('change', subs); subs();
}
function fillDrink(form, d){
  d = d || {}; var E = form.elements;
  ['name','name_en','subtype','producer','country'].forEach(function(k){ E[k].value = d[k] || ''; });
  E.type.value = d.type || C.types[0].key; E.type.dispatchEvent(new Event('change'));
  E.abv.value = d.abv == null ? '' : d.abv; E.price.value = d.price == null ? '' : d.price;
}
function readDrink(form){
  var E = form.elements, v = function(k){ return E[k].value.trim(); };
  var d = {name: v('name'), name_en: v('name_en'), type: E.type.value, subtype: v('subtype'), producer: v('producer'), country: v('country'),
    abv: v('abv') === '' ? null : Number(v('abv')), price: v('price') === '' ? null : Number(v('price'))};
  if (!d.name) return {error: '이름을 적어 주세요.', field: 'name'};
  if (d.abv != null && !(d.abv >= 0 && d.abv <= 100)) return {error: '도수는 0~100 사이로 적어 주세요.', field: 'abv'};
  if (d.price != null && !(d.price >= 0 && Number.isInteger(d.price))) return {error: '가격은 숫자로만 적어 주세요.', field: 'price'};
  return {data: d};
}

/* ---------- 리뷰 칸 (술 상세 페이지 리뷰 쓰기 · 나의 기록장) ---------- */
/* o: {nickname:true(공개 리뷰), type, foods:[{id,ko}], value:{...}} */
function reviewFieldsHTML(o){
  var L = C.limits, v = o.value || {};
  var chosen = (v.pairing || []).map(function(f){ return f.id; });
  var foods = (o.foods || []).map(function(f){ return '<button class="chip" type="button" data-food="' + esc(f.id) + '" data-ko="' + esc(f.ko) + '" aria-pressed="' + (chosen.indexOf(f.id) >= 0) + '">' + esc(f.ko) + '</button>'; }).join('');
  return '<div class="tgrid">' +
      (o.nickname ? '<div class="field"><label for="fNick">닉네임 (필수)</label><input id="fNick" name="nickname" maxlength="' + L.nick + '" required placeholder="2~16자" autocomplete="nickname" value="' + esc(v.nickname || '') + '"></div>' : '') +
      '<div class="field"><label for="fDate">마신 날 (모르면 비워 두세요)</label><input id="fDate" name="tasted_on" type="date" value="' + esc('tasted_on' in v ? (v.tasted_on || '') : today()) + '"></div>' +
    '</div>' +
    '<div class="field"><span class="flabel" id="fRateL">평점 (필수)</span>' + starInputHTML(v.rating) + '</div>' +
    '<div class="tnotes" data-notes>' + notesHTML(o.type, v) + '</div>' +
    '<div class="field"><label for="fReview">리뷰 (필수)</label><textarea id="fReview" name="review" maxlength="' + L.review + '" required placeholder="어떤 자리에서 마셨는지, 어떤 느낌이었는지 자유롭게 적어 주세요.">' + esc(v.review || '') + '</textarea></div>' +
    (foods ? '<details class="tmore"' + (chosen.length ? ' open' : '') + '><summary>함께 먹은 안주 (선택, 최대 ' + L.pairing + '개)</summary><div class="chips" data-foods>' + foods + '</div></details>' : '');
}
function bindReview(form){
  bindStars(form); bindNotes(form);
  form.addEventListener('click', function(e){
    var b = e.target.closest('[data-food]'); if (!b) return;
    var on = b.getAttribute('aria-pressed') !== 'true';
    if (on && form.querySelectorAll('[data-food][aria-pressed="true"]').length >= C.limits.pairing) return say(form, '안주는 ' + C.limits.pairing + '개까지 고를 수 있어요.', 'err');
    b.setAttribute('aria-pressed', String(on));
  });
}
function readReview(form){
  var E = form.elements;
  var d = {rating: Number(E.rating.value), tasted_on: E.tasted_on.value.trim(), review: E.review.value.trim(),
    pairing: [].map.call(form.querySelectorAll('[data-food][aria-pressed="true"]'), function(b){ return {id: b.dataset.food, ko: b.dataset.ko}; })};
  var n = readNotes(form); d.nose = n.nose; d.palate = n.palate; d.finish = n.finish;
  if (E.nickname) {
    d.nickname = E.nickname.value.trim().replace(/\s+/g, ' ');
    if (!/^[가-힣a-zA-Z0-9 _-]{2,16}$/.test(d.nickname)) return {error: '닉네임은 한글 · 영문 · 숫자로 2~16자로 적어 주세요.', field: 'nickname'};
  }
  if (!d.rating) return {error: '별을 눌러 평점을 골라 주세요.', focus: '.tstar-hit'};
  if (d.tasted_on && !/^\d{4}-\d{2}-\d{2}$/.test(d.tasted_on)) return {error: '마신 날을 다시 골라 주세요.', field: 'tasted_on'};
  if (!d.review) return {error: '리뷰를 적어 주세요.', field: 'review'};
  return {data: d};
}

function say(form, t, cls){ var s = form.querySelector('.form-status'); if (s) { s.textContent = t; s.className = 'form-status ' + (cls || ''); } }
function fail(form, r){ say(form, r.error, 'err'); var el = r.field ? form.elements[r.field] : form.querySelector(r.focus); if (el && el.focus) el.focus(); }
function foods(){ return window.JIGGER_DATA ? window.JIGGER_DATA.FOOD.map(function(f){ return {id: f.id, ko: f.ko}; }) : []; }

/* 사진을 줄여서 Blob으로 (webp를 못 만드는 브라우저는 jpeg) */
function shrink(file, max, type){
  return createImageBitmap(file).then(function(bmp){
    var s = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(function(res, rej){ c.toBlob(function(b){ b ? res(b) : rej(new Error('encode')); }, type, 0.82); });
  });
}
function photoBlobs(file){
  return shrink(file, 1600, 'image/webp').then(function(full){
    var type = full.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    return (type === 'image/webp' ? Promise.resolve(full) : shrink(file, 1600, type)).then(function(full){
      return shrink(file, 640, type).then(function(sm){ return {full: full, sm: sm}; });
    });
  });
}

window.Tasting = {cfg: C, TYPE: TYPE, typeOf: typeOf, notesOf: notesOf, esc: esc, today: today, starsHTML: starsHTML, fmtDate: fmtDate, won: won, paras: paras, store: store,
  starInputHTML: starInputHTML, bindStars: bindStars, notesHTML: notesHTML, bindNotes: bindNotes, readNotes: readNotes,
  drinkFieldsHTML: drinkFieldsHTML, bindDrink: bindDrink, fillDrink: fillDrink, readDrink: readDrink,
  reviewFieldsHTML: reviewFieldsHTML, bindReview: bindReview, readReview: readReview,
  say: say, fail: fail, foods: foods, photoBlobs: photoBlobs};
})();
