/* 나의 술 기록장: 방문자가 자기 브라우저(localStorage)에만 기록을 남겨요. 서버로 보내지 않아요.
   목록은 표(이름 · 마신 날 · 주종 · 원산지 · 품종 · 평점 · 가격 · 리뷰)로 보여주고, 줄을 누르면 자세히 펼쳐져요.
   다른 기기로 옮길 때는 내보내기(JSON 파일) → 가져오기 */
(function(){
'use strict';
var T = window.Tasting, root = document.getElementById('tMy');
var KEY = 'jigger.tasting.my.v1';
var items = [], storeOK = true, view = {type: 'all', q: '', sort: 'date'}, open = null, flash = '';

/* 예전 형식(맛 태그 · 글로 쓴 향/맛/여운)을 새 형식(선택지 배열)으로 바꿔요 */
function upgrade(x){
  var list = function(v){ return Array.isArray(v) ? v : v ? [String(v)] : []; };
  if (!Array.isArray(x.palate) || x.tags) { x.palate = list(x.palate).concat(x.tags || []); delete x.tags; }
  x.nose = list(x.nose); x.finish = list(x.finish); x.pairing = x.pairing || [];
  return x;
}
function valid(x){ return x && typeof x === 'object' && x.id && x.name && x.type && x.rating && x.tasted_on && x.review != null; }
function loadStore(){
  try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); items = Array.isArray(v) ? v.filter(valid).map(upgrade) : []; }
  catch (e) { storeOK = false; items = []; }
}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(items)); return true; } catch (e) { storeOK = false; return false; } }

/* ---------- 목록 (표) ---------- */
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
      '<div class="tctl"><div class="field"><label for="mQ">검색</label><input id="mQ" type="search" placeholder="이름, 원산지, 향 · 맛으로 검색" autocomplete="off" value="' + T.esc(view.q) + '"></div>' +
      '<div class="field"><label for="mSort">정렬</label><select id="mSort">' +
        [['date','최근에 마신 순'],['rating','평점 높은 순'],['rating-asc','평점 낮은 순'],['name','이름순']].map(function(o){ return '<option value="' + o[0] + '"' + (view.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></div></div>' +
      '<div class="chips" role="group" aria-label="주종">' + chips + '</div>' +
      '<div class="sec-h tlisth"><h2>내 기록</h2><span class="prog" id="mStatus" role="status" aria-live="polite"></span></div>' +
      '<div class="twrap"><table class="ttable tmy tresp"><thead><tr><th scope="col">이름</th><th scope="col">마신 날</th><th scope="col">주종</th><th scope="col">원산지</th><th scope="col">품종 · 세부</th><th scope="col">평점</th><th scope="col">가격</th><th scope="col">리뷰</th></tr></thead><tbody id="mBody"></tbody></table></div>'
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
    return [x.name, x.name_en, t.ko, t.en, x.subtype, x.producer, x.country].concat(x.nose, x.palate, x.finish).filter(Boolean).join(' ').toLowerCase().indexOf(q) >= 0;
  }).sort(function(a, b){
    if (view.sort === 'rating') return b.rating - a.rating || (a.tasted_on < b.tasted_on ? 1 : -1);
    if (view.sort === 'rating-asc') return a.rating - b.rating || (a.tasted_on < b.tasted_on ? 1 : -1);
    if (view.sort === 'name') return a.name.localeCompare(b.name, 'ko');
    return a.tasted_on < b.tasted_on ? 1 : a.tasted_on > b.tasted_on ? -1 : b.id - a.id;
  });
  document.getElementById('mStatus').textContent = list.length + '개' + (q ? ' · ‘' + view.q.trim() + '’ 검색' : '');
  document.getElementById('mBody').innerHTML = list.length ? list.map(rowHTML).join('') : '<tr><td colspan="8" class="note">조건에 맞는 기록이 없어요.</td></tr>';
}
function rowHTML(x){
  var t = T.typeOf(x.type), isOpen = open === x.id;
  var snip = x.review.length > 60 ? x.review.slice(0, 59) + '…' : x.review;
  var row = '<tr class="trow-my' + (isOpen ? ' is-open' : '') + '">' +
    '<th scope="row"><button class="tname" type="button" data-open="' + x.id + '" aria-expanded="' + isOpen + '"><b>' + T.esc(x.name) + '</b>' + (x.name_en ? '<span>' + T.esc(x.name_en) + '</span>' : '') + '</button><span class="tmob">' + T.starsHTML(x.rating) + ' <b>' + x.rating + '</b> · ' + T.esc(t.ko) + ' · ' + T.fmtDate(x.tasted_on) + '</span></th>' +
    '<td class="tnum">' + T.fmtDate(x.tasted_on) + '</td>' +
    '<td><span class="ttype">' + T.esc(t.ko) + '</span></td>' +
    '<td>' + T.esc(x.country || '') + '</td>' +
    '<td>' + T.esc(x.subtype || '') + '</td>' +
    '<td class="tavg">' + T.starsHTML(x.rating) + '<b>' + x.rating + '</b></td>' +
    '<td class="tnum">' + T.won(x.price) + '</td>' +
    '<td class="tsnip">' + T.esc(snip) + '</td></tr>';
  if (!isOpen) return row;
  var notes = T.cfg.parts.filter(function(p){ return (x[p[0]] || []).length; });
  return row + '<tr class="tdetail"><td colspan="8"><div class="tdetail-in">' +
    '<div class="treview">' + T.paras(x.review) + '</div>' +
    (notes.length ? '<dl class="trv-notes">' + notes.map(function(p){ return '<div><dt>' + p[1] + '</dt><dd>' + x[p[0]].map(function(v){ return '<span class="tag">' + T.esc(v) + '</span>'; }).join('') + '</dd></div>'; }).join('') + '</dl>' : '') +
    '<p class="trv-pair">' + [x.producer && '생산자 · ' + T.esc(x.producer), x.abv != null && '도수 · ' + x.abv + '%'].filter(Boolean).join('　') + '</p>' +
    (x.pairing.length ? '<p class="trv-pair">함께 먹은 안주 · ' + x.pairing.map(function(f){ return '<a href="/food/' + T.esc(f.id) + '/">' + T.esc(f.ko) + '</a>'; }).join(', ') + '</p>' : '') +
    '<div class="tact"><button class="chip" type="button" data-edit="' + x.id + '">수정</button><button class="chip" type="button" data-del="' + x.id + '">삭제</button></div>' +
    '</div></td></tr>';
}

/* ---------- 쓰기 · 고치기 ---------- */
function editView(x){
  root.innerHTML = '<div class="sec-h"><h2>' + (x ? '기록 고치기' : '새 기록 쓰기') + '</h2></div>' +
    '<form class="form tform" novalidate>' + T.drinkFieldsHTML() + '<div data-review></div>' +
    '<div class="tbtns"><button class="cta" type="submit">저장하기</button><button class="chip" type="button" data-cancel>취소</button></div>' +
    '<p class="form-status" role="status" aria-live="polite"></p></form>';
  var form = root.querySelector('form'), slot = form.querySelector('[data-review]'), first = true;
  // 주종을 바꾸면 그 주종의 향 · 맛 · 여운 선택지로 바꿔요 (이미 고른 건 그대로 둬요)
  T.bindDrink(form, function(type){
    var cur = first ? (x || {}) : T.readNotes(form);
    if (first) { slot.innerHTML = T.reviewFieldsHTML({type: type, foods: T.foods(), value: x || {}}); T.bindReview(slot); first = false; }
    else slot.querySelector('[data-notes]').innerHTML = T.notesHTML(type, cur);
  });
  T.fillDrink(form, x);
  window.scrollTo({top: root.getBoundingClientRect().top + scrollY - 16});
  form.elements.name.focus({preventScroll: true});
  form.querySelector('[data-cancel]').addEventListener('click', listView);
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var a = T.readDrink(form); if (a.error) return T.fail(form, a);
    var b = T.readReview(form); if (b.error) return T.fail(form, b);
    var now = new Date().toISOString(), d = Object.assign(a.data, b.data);
    if (x) { var i = items.findIndex(function(y){ return y.id === x.id; }); items[i] = Object.assign({}, x, d, {updated_at: now}); open = x.id; }
    else { var n = Object.assign({id: Date.now()}, d, {created_at: now, updated_at: now}); items.push(n); open = n.id; }
    if (!save()) return T.say(form, '저장하지 못했어요. 브라우저 저장 공간이 꽉 찼거나 막혀 있어요.', 'err');
    flash = '‘' + T.esc(d.name) + '’ 기록을 저장했어요.';
    listView();
  });
}

/* ---------- 내보내기 · 가져오기 ---------- */
function exportFile(){
  var blob = new Blob([JSON.stringify({app: 'jigger-tasting', version: 2, exported_at: new Date().toISOString(), items: items}, null, 2)], {type: 'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'jigger-술기록-' + T.today() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
}
function importFile(file){
  file.text().then(function(txt){
    var data = JSON.parse(txt), list = Array.isArray(data) ? data : data && data.items;
    if (!Array.isArray(list)) throw new Error('format');
    var ok = list.filter(valid).map(upgrade), byId = {}, added = 0, updated = 0;
    items.forEach(function(x){ byId[x.id] = x; });
    ok.forEach(function(x){
      if (!T.TYPE[x.type]) x.type = 'other';
      if (byId[x.id]) { if ((x.updated_at || '') > (byId[x.id].updated_at || '')) { Object.assign(byId[x.id], x); updated++; } }
      else { items.push(x); byId[x.id] = x; added++; }
    });
    if (!save()) throw new Error('save');
    flash = '가져오기 완료: 새 기록 ' + added + '개, 갱신 ' + updated + '개' + (list.length - ok.length ? ', 형식이 맞지 않아 건너뛴 기록 ' + (list.length - ok.length) + '개' : '') + '.';
    listView();
  }).catch(function(){ listView(); root.insertAdjacentHTML('afterbegin', '<p class="form-status err" role="alert">가져오지 못했어요. Jigger에서 내보낸 JSON 파일인지 확인해 주세요.</p>'); });
}

root.addEventListener('click', function(e){
  var b = e.target.closest('[data-new],[data-edit],[data-del],[data-type],[data-export],[data-open]'); if (!b) return;
  if (b.hasAttribute('data-new')) return editView(null);
  if (b.hasAttribute('data-export')) return exportFile();
  if (b.dataset.open) { open = open === +b.dataset.open ? null : +b.dataset.open; return renderList(); }
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
