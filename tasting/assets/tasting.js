/* 테이스팅 노트 입력 폼: 관리자 화면(admin.js)과 나의 기록장(my.js)이 함께 써요.
   주종 · 맛 태그 · 길이 제한은 config.js(window.TASTING, worker/tasting-config.js에서 빌드)에서 읽어요. */
(function(){
'use strict';
var C = window.TASTING;
var TYPE = {};
C.types.forEach(function(t){ TYPE[t.key] = t; });

function esc(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function today(){ var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function starsHTML(r, big){ return '<span class="stars' + (big ? ' big' : '') + '" style="--r:' + r + '" role="img" aria-label="5점 만점에 ' + r + '점"></span>'; }
function typeOf(k){ return TYPE[k] || TYPE.other; }
function fmtDate(d){ return String(d || '').replace(/-/g, '.'); }
function paras(t){ return String(t || '').trim().split(/\n\s*\n/).map(function(p){ return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); }

/* o: {photo:true(관리자), foods:[{id,ko}]} */
function formHTML(o){
  var L = C.limits;
  var types = C.types.map(function(t){ return '<option value="' + t.key + '">' + esc(t.ko) + '</option>'; }).join('');
  var tags = C.tags.map(function(t){ return '<button class="chip" type="button" data-tag="' + esc(t) + '" aria-pressed="false">' + esc(t) + '</button>'; }).join('');
  var foods = (o.foods || []).map(function(f){ return '<button class="chip" type="button" data-food="' + esc(f.id) + '" data-ko="' + esc(f.ko) + '" aria-pressed="false">' + esc(f.ko) + '</button>'; }).join('');
  return '<form class="form tform" novalidate>' +
    '<div class="tgrid">' +
      '<div class="field"><label for="fName">이름 (필수)</label><input id="fName" name="name" maxlength="' + L.name + '" required placeholder="예: 글렌피딕 12년" autocomplete="off"></div>' +
      '<div class="field"><label for="fNameEn">영문 이름</label><input id="fNameEn" name="name_en" maxlength="' + L.name_en + '" placeholder="예: Glenfiddich 12" autocomplete="off" lang="en"></div>' +
      '<div class="field"><label for="fType">주종 (필수)</label><select id="fType" name="type">' + types + '</select></div>' +
      '<div class="field"><label for="fSub">세부 종류</label><input id="fSub" name="subtype" maxlength="' + L.subtype + '" list="fSubList" autocomplete="off"><datalist id="fSubList"></datalist></div>' +
      '<div class="field"><label for="fProd">생산자 · 브랜드</label><input id="fProd" name="producer" maxlength="' + L.producer + '" autocomplete="off"></div>' +
      '<div class="field"><label for="fCountry">나라 · 지역</label><input id="fCountry" name="country" maxlength="' + L.country + '" autocomplete="off"></div>' +
      '<div class="field"><label for="fAbv">도수 (%)</label><input id="fAbv" name="abv" type="number" min="0" max="100" step="0.1" inputmode="decimal"></div>' +
      '<div class="field"><label for="fPrice">가격 (원)</label><input id="fPrice" name="price" type="number" min="0" step="100" inputmode="numeric"></div>' +
      '<div class="field"><label for="fDate">마신 날 (필수)</label><input id="fDate" name="tasted_on" type="date" required></div>' +
      '<div class="field"><label for="fRating">평점 (필수)</label><div class="trange"><input id="fRating" name="rating" type="range" min="0.5" max="5" step="0.5" value="3.5">' +
        '<span class="stars big" style="--r:3.5" aria-hidden="true"></span><output for="fRating">3.5</output></div></div>' +
    '</div>' +
    '<fieldset class="tfs"><legend>맛 태그</legend><div class="chips" data-tags>' + tags + '</div>' +
      '<div class="field"><label for="fTagX">직접 입력</label><input id="fTagX" name="tags_extra" placeholder="쉼표로 구분 (예: 꿀, 시트러스)" autocomplete="off"></div></fieldset>' +
    '<div class="field"><label for="fReview">리뷰 (필수)</label><textarea id="fReview" name="review" maxlength="' + L.review + '" required placeholder="어떤 자리에서 마셨는지, 어떤 느낌이었는지 자유롭게 적어 주세요."></textarea></div>' +
    '<details class="tmore"><summary>향 · 맛 · 여운 노트 (선택)</summary>' +
      '<div class="field"><label for="fNose">향 · Nose</label><textarea id="fNose" name="nose" rows="2" maxlength="' + L.note + '"></textarea></div>' +
      '<div class="field"><label for="fPalate">맛 · Palate</label><textarea id="fPalate" name="palate" rows="2" maxlength="' + L.note + '"></textarea></div>' +
      '<div class="field"><label for="fFinish">여운 · Finish</label><textarea id="fFinish" name="finish" rows="2" maxlength="' + L.note + '"></textarea></div>' +
    '</details>' +
    (foods ? '<details class="tmore"><summary>함께 먹은 안주 (선택, 최대 ' + L.pairing + '개)</summary><div class="chips" data-foods>' + foods + '</div></details>' : '') +
    (o.photo ? '<div class="field tphoto"><label for="fPhoto">사진</label><div class="tprev" hidden><img alt="선택한 사진 미리보기"><button class="chip" type="button" data-nophoto>사진 빼기</button></div>' +
      '<input id="fPhoto" name="photo_file" type="file" accept="image/*"><p class="note">긴 변 1600px로 줄여서 올려요.</p></div>' +
      '<label class="check"><input type="checkbox" name="published" checked> 공개하기 (끄면 나만 보는 비공개 기록으로 저장돼요)</label>' : '') +
    '<div class="tbtns"><button class="cta" type="submit">저장하기</button><button class="chip" type="button" data-cancel>취소</button></div>' +
    '<p class="form-status" role="status" aria-live="polite"></p>' +
  '</form>';
}

/* 폼 동작(주종 → 세부 종류 추천, 평점 별, 태그 · 안주 토글, 사진 미리보기)을 붙여요 */
function bind(form){
  var type = form.elements.type, sub = form.querySelector('#fSubList'), range = form.elements.rating;
  function subs(){ sub.innerHTML = typeOf(type.value).subs.map(function(s){ return '<option value="' + esc(s) + '">'; }).join(''); }
  function rate(){ form.querySelector('.trange .stars').style.setProperty('--r', range.value); form.querySelector('.trange output').textContent = range.value; }
  type.addEventListener('change', subs); range.addEventListener('input', rate);
  form.addEventListener('click', function(e){
    var b = e.target.closest('[data-tag],[data-food]'); if (!b) return;
    var on = b.getAttribute('aria-pressed') !== 'true';
    if (on && b.dataset.food && form.querySelectorAll('[data-food][aria-pressed="true"]').length >= C.limits.pairing) { say(form, '안주는 ' + C.limits.pairing + '개까지 고를 수 있어요.', 'err'); return; }
    b.setAttribute('aria-pressed', String(on));
  });
  var file = form.elements.photo_file;
  if (file) {
    file.addEventListener('change', function(){
      var f = file.files[0]; if (!f) return;
      form._photoFile = f; form._photoRemoved = false;
      showPhoto(form, URL.createObjectURL(f));
    });
    form.querySelector('[data-nophoto]').addEventListener('click', function(){
      form._photoFile = null; form._photoRemoved = true; file.value = ''; form.querySelector('.tprev').hidden = true;
    });
  }
  subs(); rate();
}
function showPhoto(form, src){ var p = form.querySelector('.tprev'); p.querySelector('img').src = src; p.hidden = false; }

function fill(form, d){
  d = d || {};
  var E = form.elements;
  ['name','name_en','subtype','producer','country','review','nose','palate','finish'].forEach(function(k){ if (E[k]) E[k].value = d[k] || ''; });
  E.type.value = d.type || C.types[0].key; E.type.dispatchEvent(new Event('change'));
  E.abv.value = d.abv == null ? '' : d.abv; E.price.value = d.price == null ? '' : d.price;
  E.tasted_on.value = d.tasted_on || today();
  E.rating.value = d.rating || 3.5; E.rating.dispatchEvent(new Event('input'));
  var tags = d.tags || [], preset = {};
  form.querySelectorAll('[data-tag]').forEach(function(b){ preset[b.dataset.tag] = 1; b.setAttribute('aria-pressed', String(tags.indexOf(b.dataset.tag) >= 0)); });
  E.tags_extra.value = tags.filter(function(t){ return !preset[t]; }).join(', ');
  var foods = (d.pairing || []).map(function(f){ return f.id; });
  form.querySelectorAll('[data-food]').forEach(function(b){ b.setAttribute('aria-pressed', String(foods.indexOf(b.dataset.food) >= 0)); });
  if (E.published) E.published.checked = d.published !== 0 && d.published !== false;
  form._photo = d.photo || null; form._photoFile = null; form._photoRemoved = false;
  if (E.photo_file) { E.photo_file.value = ''; if (d.photo) showPhoto(form, '/tasting/photo/' + d.photo); else form.querySelector('.tprev').hidden = true; }
  say(form, '');
}

/* 입력값 읽기 + 검사 → {data} 또는 {error, field} */
function read(form){
  var E = form.elements, v = function(k){ return E[k] ? E[k].value.trim() : ''; };
  var tags = [].map.call(form.querySelectorAll('[data-tag][aria-pressed="true"]'), function(b){ return b.dataset.tag; })
    .concat(v('tags_extra').split(/[,，]/).map(function(t){ return t.trim(); }).filter(Boolean));
  tags = tags.filter(function(t, i){ return tags.indexOf(t) === i; });
  var d = {
    name: v('name'), name_en: v('name_en'), type: E.type.value, subtype: v('subtype'), producer: v('producer'), country: v('country'),
    abv: v('abv') === '' ? null : Number(v('abv')), price: v('price') === '' ? null : Number(v('price')),
    rating: Number(E.rating.value), tasted_on: v('tasted_on'),
    nose: v('nose'), palate: v('palate'), finish: v('finish'), tags: tags, review: v('review'),
    pairing: [].map.call(form.querySelectorAll('[data-food][aria-pressed="true"]'), function(b){ return {id: b.dataset.food, ko: b.dataset.ko}; }),
    published: E.published ? E.published.checked : true
  };
  if (!d.name) return {error: '이름을 적어 주세요.', field: 'name'};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.tasted_on)) return {error: '마신 날을 골라 주세요.', field: 'tasted_on'};
  if (d.abv != null && !(d.abv >= 0 && d.abv <= 100)) return {error: '도수는 0~100 사이로 적어 주세요.', field: 'abv'};
  if (d.price != null && !(d.price >= 0 && Number.isInteger(d.price))) return {error: '가격은 숫자로만 적어 주세요.', field: 'price'};
  if (tags.length > C.limits.tags) return {error: '맛 태그는 ' + C.limits.tags + '개까지 넣을 수 있어요.', field: 'tags_extra'};
  if (tags.some(function(t){ return t.length > C.limits.tag; })) return {error: '태그 하나는 ' + C.limits.tag + '자 안으로 적어 주세요.', field: 'tags_extra'};
  if (!d.review) return {error: '리뷰를 적어 주세요.', field: 'review'};
  return {data: d};
}
function say(form, t, cls){ var s = form.querySelector('.form-status'); s.textContent = t; s.className = 'form-status ' + (cls || ''); }
function fail(form, r){ say(form, r.error, 'err'); var el = form.elements[r.field]; if (el && el.focus) el.focus(); }

/* 사진을 줄여서 Blob으로 (webp를 못 만드는 브라우저는 jpeg) */
function shrink(file, max, type){
  return createImageBitmap(file).then(function(bmp){
    var s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    var c = document.createElement('canvas');
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

window.Tasting = {cfg: C, TYPE: TYPE, typeOf: typeOf, esc: esc, today: today, starsHTML: starsHTML, fmtDate: fmtDate, paras: paras,
  formHTML: formHTML, bind: bind, fill: fill, read: read, say: say, fail: fail, photoBlobs: photoBlobs};
})();
