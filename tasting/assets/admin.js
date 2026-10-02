/* 테이스팅 노트 관리자 화면: 로그인 → 기록 목록 → 쓰기 · 고치기 · 지우기
   서버 API는 worker/tasting.js (/api/tasting/...) */
(function(){
'use strict';
var T = window.Tasting, root = document.getElementById('tAdmin');
var reviews = [], canPhoto = false, flash = '';

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
  var rows = reviews.map(function(r){
    var t = T.typeOf(r.type);
    return '<li class="trow">' +
      '<div class="tinfo"><b>' + T.esc(r.name) + '</b>' + (r.published ? '' : ' <span class="tag xtag">비공개</span>') +
      '<span class="tsub">' + T.esc(t.ko) + (r.subtype ? ' · ' + T.esc(r.subtype) : '') + ' · ' + T.fmtDate(r.tasted_on) + '</span></div>' +
      '<div class="tscore">' + T.starsHTML(r.rating) + '<b>' + r.rating + '</b></div>' +
      '<div class="tact"><a class="chip" href="/tasting/' + r.id + '/" target="_blank" rel="noopener">보기</a>' +
      '<button class="chip" type="button" data-edit="' + r.id + '">수정</button>' +
      '<button class="chip" type="button" data-del="' + r.id + '">삭제</button></div></li>';
  }).join('');
  root.innerHTML = '<div class="tbar"><button class="cta" type="button" data-new>새 기록 쓰기 +</button>' +
    '<a class="chip" href="/tasting/" target="_blank" rel="noopener">공개 페이지 보기</a>' +
    '<button class="chip" type="button" data-logout>로그아웃</button></div>' +
    (flash ? '<p class="form-status ok" role="status">' + flash + '</p>' : '') +
    (canPhoto ? '' : '<p class="note">사진 저장소(R2)가 아직 연결되지 않아 사진은 올릴 수 없어요.</p>') +
    '<div class="sec-h"><h2>내 기록</h2><span class="prog">' + reviews.length + '개</span></div>' +
    (rows ? '<ul class="tlist">' + rows + '</ul>' : '<p class="note">아직 기록이 없어요. ‘새 기록 쓰기’로 시작해 보세요.</p>');
  flash = '';
}
root.addEventListener('click', function(e){
  var b = e.target.closest('[data-new],[data-edit],[data-del],[data-logout]'); if (!b) return;
  if (b.hasAttribute('data-new')) return editView(null);
  if (b.dataset.edit) return editView(reviews.find(function(r){ return r.id === +b.dataset.edit; }));
  if (b.dataset.del) {
    var r = reviews.find(function(x){ return x.id === +b.dataset.del; });
    if (!confirm('‘' + r.name + '’ 기록을 지울까요? 사진도 함께 지워지고 되돌릴 수 없어요.')) return;
    api('DELETE', 'reviews/' + r.id).then(function(j){
      if (j.status === 401) return loginView('다시 로그인해 주세요.');
      flash = j.ok ? '‘' + T.esc(r.name) + '’ 기록을 지웠어요.' : '지우지 못했어요.';
      load();
    });
  }
  if (b.hasAttribute('data-logout')) api('POST', 'logout').then(function(){ loginView(); });
});

/* ---------- 쓰기 · 고치기 ---------- */
function editView(r){
  var foods = window.JIGGER_DATA ? window.JIGGER_DATA.FOOD.map(function(f){ return {id: f.id, ko: f.ko}; }) : [];
  root.innerHTML = '<div class="sec-h"><h2>' + (r ? '기록 고치기' : '새 기록 쓰기') + '</h2>' +
    (r ? '<a class="prog" href="/tasting/' + r.id + '/" target="_blank" rel="noopener">페이지 보기 →</a>' : '') + '</div>' +
    T.formHTML({photo: canPhoto, foods: foods});
  var form = root.querySelector('form');
  T.bind(form); T.fill(form, r);
  window.scrollTo({top: root.getBoundingClientRect().top + scrollY - 16});
  form.elements.name.focus({preventScroll: true});
  form.querySelector('[data-cancel]').addEventListener('click', function(){ listView(); });
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var v = T.read(form); if (v.error) return T.fail(form, v);
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    var uploaded = null;
    var photo = form._photoFile ? (T.say(form, '사진을 줄여서 올리는 중…'), T.photoBlobs(form._photoFile).then(function(b){
      var fd = new FormData(); fd.append('full', b.full, 'full'); fd.append('sm', b.sm, 'sm');
      return api('POST', 'photo', fd).then(function(j){ if (!j.ok) throw j; uploaded = j.photo; return j.photo; });
    })) : Promise.resolve(form._photoRemoved ? null : form._photo);
    photo.then(function(name){
      v.data.photo = name;
      T.say(form, '저장하는 중…');
      return api(r ? 'PUT' : 'POST', 'reviews' + (r ? '/' + r.id : ''), v.data);
    }).then(function(j){
      btn.disabled = false;
      if (j.status === 401) { cleanup(); return loginView('로그인이 풀렸어요. 다시 로그인한 뒤 저장해 주세요.'); }
      if (!j.ok) { cleanup(); return T.say(form, '저장하지 못했어요 (' + (j.error || j.status) + ').', 'err'); }
      flash = '저장했어요. <a href="/tasting/' + j.id + '/" target="_blank" rel="noopener">페이지 보기 →</a>';
      load();
    }).catch(function(err){
      btn.disabled = false; cleanup();
      T.say(form, err && err.error === 'photo' ? '사진 형식을 확인해 주세요 (JPG · PNG · WEBP).'
        : err && err.status === 503 ? '사진 저장소가 아직 준비되지 않았어요.'
        : '저장하지 못했어요. 사진이 너무 크거나 네트워크가 불안정할 수 있어요.', 'err');
    });
    // 저장에 실패하면 방금 올린 사진은 지워요
    function cleanup(){ if (uploaded) api('DELETE', 'photo/' + uploaded); uploaded = null; }
  });
}

function load(){
  return api('GET', 'reviews').then(function(j){
    if (j.status === 401) return loginView();
    reviews = j.reviews || []; listView();
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
