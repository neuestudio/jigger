/* 나의 술 기록장: 방문자가 자기 브라우저(localStorage)에만 기록을 남겨요. 서버로 보내지 않아요.
   다른 기기로 옮길 때는 내보내기(JSON 파일) → 가져오기 */
(function(){
'use strict';
var T = window.Tasting, root = document.getElementById('tMy');
var KEY = 'jigger.tasting.my.v1';
var items = [], storeOK = true, view = {type: 'all', q: '', sort: 'date'}, flash = '';

function loadStore(){
  try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); items = Array.isArray(v) ? v.filter(valid) : []; }
  catch (e) { storeOK = false; items = []; }
}
function save(){
  try { localStorage.setItem(KEY, JSON.stringify(items)); return true; }
  catch (e) { storeOK = false; return false; }
}
function valid(x){ return x && typeof x === 'object' && x.id && x.name && x.type && x.rating && x.tasted_on && x.review != null; }

/* ---------- 목록 ---------- */
function listView(){
  var counts = {};
  items.forEach(function(x){ counts[x.type] = (counts[x.type] || 0) + 1; });
  var avg = items.length ? (items.reduce(function(a, x){ return a + x.rating; }, 0) / items.length).toFixed(1) : '-';
  var chips = '<button class="chip" type="button" data-type="all" aria-pressed="' + (view.type === 'all') + '">전체<span class="n">' + items.length + '</span></button>' +
    T.cfg.types.filter(function(t){ return counts[t.key]; }).map(function(t){
      return '<button class="chip" type="button" data-type="' + t.key + '" aria-pressed="' + (view.type === t.key) + '">' + T.esc(t.ko) + '<span class="n">' + counts[t.key] + '</span></button>';
    }).join('');
  root.innerHTML =
    (storeOK ? '' : '<p class="form-status err" role="alert">이 브라우저에서는 저장소를 쓸 수 없어요 (시크릿 모드이거나 사이트 데이터가 막혀 있을 수 있어요). 기록이 저장되지 않아요.</p>') +
    '<div class="tbar"><button class="cta" type="button" data-new>새 기록 쓰기 +</button>' +
    '<button class="chip" type="button" data-export' + (items.length ? '' : ' disabled') + '>내보내기</button>' +
    '<label class="chip tfile">가져오기<input type="file" accept="application/json,.json" data-import></label></div>' +
    (flash ? '<p class="form-status ok" role="status">' + flash + '</p>' : '') +
    (items.length ? '<p class="tstats"><span>기록 <b>' + items.length + '</b>개</span><span>평균 평점 <b>' + avg + '</b></span><span>주종 <b>' + Object.keys(counts).length + '</b>가지</span></p>' +
      '<div class="tctl"><div class="field"><label for="mQ">검색</label><input id="mQ" type="search" placeholder="이름, 생산자, 맛 태그로 검색" autocomplete="off" value="' + T.esc(view.q) + '"></div>' +
      '<div class="field"><label for="mSort">정렬</label><select id="mSort">' +
        [['date','최근에 마신 순'],['rating','평점 높은 순'],['rating-asc','평점 낮은 순'],['name','이름순']].map(function(o){ return '<option value="' + o[0] + '"' + (view.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></div></div>' +
      '<div class="chips" role="group" aria-label="주종">' + chips + '</div>' +
      '<div class="sec-h tlisth"><h2>내 기록</h2><span class="prog" id="mStatus" role="status" aria-live="polite"></span></div>' +
      '<ul class="tlist" id="mList"></ul>'
    : '<p class="lead">아직 기록이 없어요. 오늘 마신 술부터 남겨 보세요.</p>');
  flash = '';
  if (items.length) renderList();
}
function renderList(){
  var q = view.q.trim().toLowerCase();
  var list = items.filter(function(x){
    if (view.type !== 'all' && x.type !== view.type) return false;
    if (!q) return true;
    var t = T.typeOf(x.type);
    return [x.name, x.name_en, t.ko, t.en, x.subtype, x.producer, x.country].concat(x.tags || []).filter(Boolean).join(' ').toLowerCase().indexOf(q) >= 0;
  }).sort(function(a, b){
    if (view.sort === 'rating') return b.rating - a.rating || (a.tasted_on < b.tasted_on ? 1 : -1);
    if (view.sort === 'rating-asc') return a.rating - b.rating || (a.tasted_on < b.tasted_on ? 1 : -1);
    if (view.sort === 'name') return a.name.localeCompare(b.name, 'ko');
    return a.tasted_on < b.tasted_on ? 1 : a.tasted_on > b.tasted_on ? -1 : b.id - a.id;
  });
  document.getElementById('mStatus').textContent = list.length + '개' + (q ? ' · ‘' + view.q.trim() + '’ 검색' : '');
  document.getElementById('mList').innerHTML = list.length ? list.map(entryHTML).join('') : '<li class="note">조건에 맞는 기록이 없어요.</li>';
}
function entryHTML(x){
  var t = T.typeOf(x.type);
  var spec = [['주종', t.ko + (x.subtype ? ' · ' + x.subtype : '')], ['생산자', x.producer], ['나라 · 지역', x.country],
    ['도수', x.abv != null ? x.abv + '%' : ''], ['가격', x.price != null ? x.price.toLocaleString('ko-KR') + '원' : ''], ['마신 날', T.fmtDate(x.tasted_on)]]
    .filter(function(s){ return s[1]; });
  var notes = [['향 · Nose', x.nose], ['맛 · Palate', x.palate], ['여운 · Finish', x.finish]].filter(function(n){ return n[1]; });
  return '<li class="trow tentry"><details>' +
    '<summary><span class="tinfo"><b>' + T.esc(x.name) + '</b><span class="tsub">' + T.esc(t.ko) + (x.subtype ? ' · ' + T.esc(x.subtype) : '') + ' · ' + T.fmtDate(x.tasted_on) + '</span></span>' +
    '<span class="tscore">' + T.starsHTML(x.rating) + '<b>' + x.rating + '</b></span></summary>' +
    '<div class="tbody">' +
      (x.name_en ? '<p class="note">' + T.esc(x.name_en) + '</p>' : '') +
      ((x.tags || []).length ? '<div class="tags">' + x.tags.map(function(g){ return '<span class="tag">' + T.esc(g) + '</span>'; }).join('') + '</div>' : '') +
      '<dl class="spec">' + spec.map(function(s){ return '<div><dt>' + s[0] + '</dt><dd>' + T.esc(s[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="treview">' + T.paras(x.review) + '</div>' +
      (notes.length ? '<ul class="subtypes">' + notes.map(function(n){ return '<li><b>' + n[0] + '</b>' + T.esc(n[1]) + '</li>'; }).join('') + '</ul>' : '') +
      ((x.pairing || []).length ? '<ul class="alllinks">' + x.pairing.map(function(f){ return '<li><a href="/food/' + T.esc(f.id) + '/">' + T.esc(f.ko) + '</a></li>'; }).join('') + '</ul>' : '') +
      '<div class="tact"><button class="chip" type="button" data-edit="' + x.id + '">수정</button><button class="chip" type="button" data-del="' + x.id + '">삭제</button></div>' +
    '</div></details></li>';
}

/* ---------- 쓰기 · 고치기 ---------- */
function editView(x){
  var foods = window.JIGGER_DATA ? window.JIGGER_DATA.FOOD.map(function(f){ return {id: f.id, ko: f.ko}; }) : [];
  root.innerHTML = '<div class="sec-h"><h2>' + (x ? '기록 고치기' : '새 기록 쓰기') + '</h2></div>' + T.formHTML({foods: foods});
  var form = root.querySelector('form');
  T.bind(form); T.fill(form, x);
  window.scrollTo({top: root.getBoundingClientRect().top + scrollY - 16});
  form.elements.name.focus({preventScroll: true});
  form.querySelector('[data-cancel]').addEventListener('click', listView);
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var v = T.read(form); if (v.error) return T.fail(form, v);
    var now = new Date().toISOString(), d = v.data;
    delete d.published;
    if (x) { var i = items.findIndex(function(y){ return y.id === x.id; }); items[i] = Object.assign({}, x, d, {updated_at: now}); }
    else items.push(Object.assign({id: Date.now()}, d, {created_at: now, updated_at: now}));
    if (!save()) return T.say(form, '저장하지 못했어요. 브라우저 저장 공간이 꽉 찼거나 막혀 있어요.', 'err');
    flash = '‘' + T.esc(d.name) + '’ 기록을 저장했어요.';
    listView();
  });
}

/* ---------- 내보내기 · 가져오기 ---------- */
function exportFile(){
  var blob = new Blob([JSON.stringify({app: 'jigger-tasting', version: 1, exported_at: new Date().toISOString(), items: items}, null, 2)], {type: 'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'jigger-술기록-' + T.today() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
}
function importFile(file){
  file.text().then(function(txt){
    var data = JSON.parse(txt), list = Array.isArray(data) ? data : data && data.items;
    if (!Array.isArray(list)) throw new Error('format');
    var ok = list.filter(valid), byId = {}, added = 0, updated = 0;
    items.forEach(function(x){ byId[x.id] = x; });
    ok.forEach(function(x){
      if (!T.TYPE[x.type]) x.type = 'other';
      if (byId[x.id]) { if ((x.updated_at || '') > (byId[x.id].updated_at || '')) { Object.assign(byId[x.id], x); updated++; } }
      else { items.push(x); byId[x.id] = x; added++; }
    });
    if (!save()) throw new Error('save');
    flash = '가져오기 완료: 새 기록 ' + added + '개, 갱신 ' + updated + '개' + (list.length - ok.length ? ', 형식이 맞지 않아 건너뛴 기록 ' + (list.length - ok.length) + '개' : '') + '.';
    listView();
  }).catch(function(){ flash = ''; listView(); root.insertAdjacentHTML('afterbegin', '<p class="form-status err" role="alert">가져오지 못했어요. Jigger에서 내보낸 JSON 파일인지 확인해 주세요.</p>'); });
}

root.addEventListener('click', function(e){
  var b = e.target.closest('[data-new],[data-edit],[data-del],[data-type],[data-export]'); if (!b) return;
  if (b.hasAttribute('data-new')) return editView(null);
  if (b.hasAttribute('data-export')) return exportFile();
  if (b.dataset.type) { view.type = b.dataset.type; root.querySelectorAll('[data-type]').forEach(function(c){ c.setAttribute('aria-pressed', String(c === b)); }); return renderList(); }
  var x = items.find(function(y){ return y.id === +(b.dataset.edit || b.dataset.del); });
  if (b.dataset.edit) return editView(x);
  if (b.dataset.del && confirm('‘' + x.name + '’ 기록을 지울까요? 되돌릴 수 없어요.')) {
    items = items.filter(function(y){ return y !== x; }); save();
    flash = '‘' + T.esc(x.name) + '’ 기록을 지웠어요.'; listView();
  }
});
root.addEventListener('input', function(e){ if (e.target.id === 'mQ') { view.q = e.target.value; renderList(); } });
root.addEventListener('change', function(e){
  if (e.target.id === 'mSort') { view.sort = e.target.value; renderList(); }
  if (e.target.hasAttribute('data-import') && e.target.files[0]) importFile(e.target.files[0]);
});

loadStore(); listView();
})();
