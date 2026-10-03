/* 테이스팅 노트 관리자 화면
   - 술: 등록 · 수정 · 삭제(리뷰도 함께 지워져요), 공개/비공개, 사진(R2 연결 시)
   - 리뷰: 최근 리뷰를 보고 숨기기 · 지우기. 내 리뷰는 술 상세 페이지에서 직접 써요 (로그인 상태면 ‘운영자’ 표시)
   서버 API는 worker/tasting.js (/api/tasting/...) */
(function(){
'use strict';
var T = window.Tasting, root = document.getElementById('tAdmin');
var drinks = [], reviews = [], canPhoto = false, tab = 'drinks', flash = '';

function api(method, path, body){
  var opt = {method: method, headers: {}};
  if (body instanceof FormData) opt.body = body;
  else if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  return fetch('/api/tasting/' + path, opt).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){ j.status = r.status; return j; });
  });
}

/* ---------- 로그인 ---------- */
function loginView(msg){
  root.innerHTML = '<form class="form tlogin" novalidate>' +
    '<div class="field"><label for="aPw">관리자 비밀번호</label><input id="aPw" name="password" type="password" autocomplete="current-password" required></div>' +
    '<div><button class="cta" type="submit">로그인</button></div>' +
    '<p class="form-status" role="status" aria-live="polite"></p></form>';
  var f = root.querySelector('form');
  if (msg) T.say(f, msg, 'err');
  f.elements.password.focus();
  f.addEventListener('submit', function(e){
    e.preventDefault();
    var pw = f.elements.password.value; if (!pw) return T.say(f, '비밀번호를 적어 주세요.', 'err');
    var btn = f.querySelector('button'); btn.disabled = true; T.say(f, '확인하는 중…');
    api('POST', 'login', {password: pw}).then(function(r){
      btn.disabled = false;
      if (r.ok) return start();
      f.elements.password.value = '';
      T.say(f, r.status === 429 ? '여러 번 틀려서 잠시 막혔어요. 15분 뒤에 다시 시도해 주세요.'
        : r.status === 503 ? '관리자 비밀번호가 아직 설정되지 않았어요.'
        : r.error === 'wrong' ? '비밀번호가 맞지 않아요.' + (r.left != null ? ' (남은 시도 ' + r.left + '번)' : '')
        : '로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'err');
    }, function(){ btn.disabled = false; T.say(f, '네트워크 오류예요. 연결을 확인해 주세요.', 'err'); });
  });
}

/* ---------- 목록 ---------- */
function listView(){
  var head = '<div class="tbar"><button class="cta" type="button" data-new>새 술 등록 +</button>' +
    '<a class="chip" href="/tasting/" target="_blank" rel="noopener">공개 페이지 보기</a>' +
    '<button class="chip" type="button" data-logout>로그아웃</button></div>' +
    (flash ? '<p class="form-status ok" role="status">' + flash + '</p>' : '') +
    (canPhoto ? '' : '<p class="note">사진 저장소(R2)가 아직 연결되지 않아 사진은 올릴 수 없어요.</p>') +
    '<div class="chips ttabs" role="tablist">' +
      '<button class="chip" type="button" role="tab" data-tab="drinks" aria-selected="' + (tab === 'drinks') + '" aria-pressed="' + (tab === 'drinks') + '">술 ' + drinks.length + '</button>' +
      '<button class="chip" type="button" role="tab" data-tab="reviews" aria-selected="' + (tab === 'reviews') + '" aria-pressed="' + (tab === 'reviews') + '">최근 리뷰 ' + reviews.length + '</button></div>';
  var body = tab === 'drinks'
    ? (drinks.length ? '<div class="twrap"><table class="ttable"><thead><tr><th scope="col">이름</th><th scope="col">주종</th><th scope="col">원산지</th><th scope="col">평균</th><th scope="col">공개</th><th scope="col">관리</th></tr></thead><tbody>' +
        drinks.map(function(d){
          return '<tr><th scope="row"><a class="tname" href="/tasting/' + d.id + '/" target="_blank" rel="noopener"><b>' + T.esc(d.name_en || d.name) + '</b>' + (d.name_en ? '<span>' + T.esc(d.name) + '</span>' : '') + '</a></th>' +
            '<td><span class="ttype">' + T.esc(T.typeOf(d.type).ko) + '</span>' + (d.subtype ? ' <span class="tsub">' + T.esc(d.subtype) + '</span>' : '') + '</td>' +
            '<td>' + T.esc(d.country || '') + '</td>' +
            '<td class="tavg">' + (d.n ? T.starsHTML(Math.round(d.avg * 2) / 2) + '<b>' + d.avg.toFixed(1) + '</b><span>' + d.n + '명</span>' : '<span class="tnone">리뷰 없음</span>') + '</td>' +
            '<td>' + (d.published ? '공개' : '<span class="tag xtag">비공개</span>') + '</td>' +
            '<td class="tact"><a class="chip" href="/tasting/' + d.id + '/#write" target="_blank" rel="noopener">리뷰 쓰기</a><button class="chip" type="button" data-edit="' + d.id + '">수정</button><button class="chip" type="button" data-del="' + d.id + '">삭제</button></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="note">아직 등록한 술이 없어요. ‘새 술 등록’으로 시작해 보세요.</p>')
    : (reviews.length ? '<div class="twrap"><table class="ttable"><thead><tr><th scope="col">술</th><th scope="col">닉네임</th><th scope="col">평점</th><th scope="col">마신 날</th><th scope="col">리뷰</th><th scope="col">관리</th></tr></thead><tbody>' +
        reviews.map(function(r){
          return '<tr' + (r.status === 'hidden' ? ' class="is-hidden"' : '') + '><th scope="row"><a href="/tasting/' + r.drink_id + '/#review-' + r.id + '" target="_blank" rel="noopener">' + T.esc(r.name) + '</a></th>' +
            '<td>' + T.esc(r.nickname) + (r.is_admin ? ' <span class="tbadge">운영자</span>' : '') + '</td>' +
            '<td class="tavg">' + T.starsHTML(r.rating) + '<b>' + r.rating + '</b></td>' +
            '<td class="tnum">' + T.fmtDate(r.tasted_on) + '</td>' +
            '<td class="tsnip">' + (r.status === 'hidden' ? '<span class="tag xtag">숨김</span> ' : '') + T.esc(r.review.length > 60 ? r.review.slice(0, 59) + '…' : r.review) + '</td>' +
            '<td class="tact"><button class="chip" type="button" data-hide="' + r.id + '">' + (r.status === 'hidden' ? '보이기' : '숨기기') + '</button><button class="chip" type="button" data-rdel="' + r.id + '">삭제</button></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="note">아직 리뷰가 없어요.</p>');
  root.innerHTML = head + body;
  flash = '';
}
root.addEventListener('click', function(e){
  var b = e.target.closest('[data-new],[data-edit],[data-del],[data-logout],[data-tab],[data-hide],[data-rdel]'); if (!b) return;
  if (b.dataset.tab) { tab = b.dataset.tab; return listView(); }
  if (b.hasAttribute('data-new')) return editView(null);
  if (b.dataset.edit) return editView(drinks.find(function(d){ return d.id === +b.dataset.edit; }));
  if (b.hasAttribute('data-logout')) return api('POST', 'logout').then(function(){ loginView(); });
  if (b.dataset.del) {
    var d = drinks.find(function(x){ return x.id === +b.dataset.del; });
    if (!confirm('‘' + d.name + '’을(를) 지울까요? 이 술의 리뷰 ' + d.n + '개도 함께 지워지고 되돌릴 수 없어요.')) return;
    return api('DELETE', 'drinks/' + d.id).then(done('‘' + T.esc(d.name) + '’을(를) 지웠어요.'));
  }
  if (b.dataset.hide) {
    var r = reviews.find(function(x){ return x.id === +b.dataset.hide; });
    return api('PATCH', 'reviews/' + r.id, {status: r.status === 'hidden' ? 'published' : 'hidden'}).then(done(r.status === 'hidden' ? '리뷰를 다시 보이게 했어요.' : '리뷰를 숨겼어요.'));
  }
  if (b.dataset.rdel) {
    var rv = reviews.find(function(x){ return x.id === +b.dataset.rdel; });
    if (!confirm(rv.nickname + '님의 리뷰를 지울까요? 되돌릴 수 없어요.')) return;
    return api('DELETE', 'reviews/' + rv.id).then(done('리뷰를 지웠어요.'));
  }
});
function done(msg){ return function(j){ if (j.status === 401) return loginView('다시 로그인해 주세요.'); flash = j.ok ? msg : '처리하지 못했어요.'; load(); }; }

/* ---------- 술 등록 · 수정 ---------- */
function editView(d){
  root.innerHTML = '<div class="sec-h"><h2>' + (d ? '술 정보 고치기' : '새 술 등록') + '</h2>' +
    (d ? '<a class="prog" href="/tasting/' + d.id + '/" target="_blank" rel="noopener">페이지 보기 →</a>' : '') + '</div>' +
    '<form class="form tform" novalidate>' + T.drinkFieldsHTML() +
    (canPhoto ? '<div class="field tphoto"><label for="fPhoto">사진</label><div class="tprev" hidden><img alt="선택한 사진 미리보기"><button class="chip" type="button" data-nophoto>사진 빼기</button></div>' +
      '<input id="fPhoto" name="photo_file" type="file" accept="image/*"><p class="note">긴 변 1600px로 줄여서 올려요.</p></div>' : '') +
    '<label class="check"><input type="checkbox" name="published"' + (!d || d.published ? ' checked' : '') + '> 공개하기 (끄면 나만 보는 비공개로 저장돼요)</label>' +
    '<div class="tbtns"><button class="cta" type="submit">저장하기</button><button class="chip" type="button" data-cancel>취소</button></div>' +
    '<p class="form-status" role="status" aria-live="polite"></p></form>' +
    (d ? '' : '<p class="note">저장한 뒤 술 페이지에서 내 리뷰를 바로 남길 수 있어요.</p>');
  var form = root.querySelector('form'), photo = d ? d.photo : null, file = null, removed = false;
  T.bindDrink(form); T.fillDrink(form, d);
  window.scrollTo({top: root.getBoundingClientRect().top + scrollY - 16});
  form.elements.name.focus({preventScroll: true});
  form.querySelector('[data-cancel]').addEventListener('click', listView);
  var input = form.elements.photo_file, prev = form.querySelector('.tprev');
  if (input) {
    if (photo) { prev.querySelector('img').src = '/tasting/photo/' + photo; prev.hidden = false; }
    input.addEventListener('change', function(){ file = input.files[0] || null; removed = false; if (file) { prev.querySelector('img').src = URL.createObjectURL(file); prev.hidden = false; } });
    form.querySelector('[data-nophoto]').addEventListener('click', function(){ file = null; removed = true; input.value = ''; prev.hidden = true; });
  }
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var v = T.readDrink(form); if (v.error) return T.fail(form, v);
    v.data.published = form.elements.published.checked;
    var btn = form.querySelector('[type=submit]'); btn.disabled = true;
    var uploaded = null;
    var ph = file ? (T.say(form, '사진을 줄여서 올리는 중…'), T.photoBlobs(file).then(function(b){
      var fd = new FormData(); fd.append('full', b.full, 'full'); fd.append('sm', b.sm, 'sm');
      return api('POST', 'photo', fd).then(function(j){ if (!j.ok) throw j; uploaded = j.photo; return j.photo; });
    })) : Promise.resolve(removed ? null : photo);
    ph.then(function(name){
      v.data.photo = name; T.say(form, '저장하는 중…');
      return api(d ? 'PUT' : 'POST', 'drinks' + (d ? '/' + d.id : ''), v.data);
    }).then(function(j){
      btn.disabled = false;
      if (j.status === 401) { cleanup(); return loginView('로그인이 풀렸어요. 다시 로그인한 뒤 저장해 주세요.'); }
      if (!j.ok) { cleanup(); return T.say(form, '저장하지 못했어요 (' + (j.error || j.status) + ').', 'err'); }
      flash = '저장했어요. <a href="/tasting/' + j.id + '/" target="_blank" rel="noopener">페이지 보기</a> · <a href="/tasting/' + j.id + '/#write" target="_blank" rel="noopener">내 리뷰 쓰기 →</a>';
      tab = 'drinks'; load();
    }).catch(function(err){
      btn.disabled = false; cleanup();
      T.say(form, err && err.status === 503 ? '사진 저장소가 아직 준비되지 않았어요.' : '저장하지 못했어요. 사진이 너무 크거나 네트워크가 불안정할 수 있어요.', 'err');
    });
    function cleanup(){ if (uploaded) api('DELETE', 'photo/' + uploaded); uploaded = null; }
  });
}

function load(){
  return Promise.all([api('GET', 'admin/drinks'), api('GET', 'admin/reviews')]).then(function(res){
    if (res[0].status === 401) return loginView();
    drinks = (res[0].drinks || []).map(function(d){ d.avg = d.avg || 0; return d; });
    reviews = res[1].reviews || [];
    listView();
  }, function(){ root.innerHTML = '<p class="form-status err">불러오지 못했어요. 새로고침해 주세요.</p>'; });
}
function start(){
  api('GET', 'me').then(function(j){
    canPhoto = !!j.photos;
    if (j.admin) load(); else loginView(j.status === 503 ? '데이터베이스가 아직 연결되지 않았어요.' : '');
  }, function(){ root.innerHTML = '<p class="form-status err">서버에 연결하지 못했어요.</p>'; });
}
start();
})();
