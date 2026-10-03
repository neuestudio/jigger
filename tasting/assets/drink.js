/* 술 상세 페이지: 리뷰 쓰기, 내가 쓴 리뷰 고치기 · 지우기, 관리자는 숨기기 · 지우기
   내가 쓴 리뷰는 쓸 때 받은 토큰(이 브라우저의 localStorage)으로 알아봐요. 서버 API는 worker/tasting.js */
(function(){
'use strict';
var T = window.Tasting, box = document.getElementById('tWrite');
var DATA = JSON.parse(document.getElementById('tData').textContent);
var drink = DATA.drink, byId = {};
DATA.reviews.forEach(function(r){ byId[r.id] = r; });
var TOKENS = 'jigger.tasting.tokens', NICK = 'jigger.tasting.nickname';
var tokens = T.store(TOKENS) || {}, admin = false;

var ERR = {
  'nickname': '닉네임은 한글 · 영문 · 숫자로 2~16자로 적어 주세요.',
  'nickname-reserved': '운영자 닉네임이라 쓸 수 없어요. 다른 닉네임을 적어 주세요.',
  'link': '리뷰와 닉네임에는 링크나 사이트 주소를 넣을 수 없어요.',
  'too-many': '짧은 시간에 리뷰를 많이 남겼어요. 잠시 뒤에 다시 남겨 주세요.',
  'review-too-long': '리뷰는 ' + T.cfg.limits.review + '자까지 쓸 수 있어요.',
  'not-owner': '이 브라우저에서 쓴 리뷰만 고칠 수 있어요.'
};
function api(method, path, body, token){
  var h = {'Content-Type': 'application/json'};
  if (token) h['X-Edit-Token'] = token;
  return fetch('/api/tasting/' + path, {method: method, headers: h, body: body ? JSON.stringify(body) : undefined}).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){ j.status = r.status; return j; });
  });
}
function errText(j){ return ERR[j.error] || (j.status === 404 ? '술 정보를 찾지 못했어요.' : '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); }

/* ---------- 리뷰 쓰기 ---------- */
function formHTML(value, edit){
  return '<form class="form tform" novalidate>' +
    T.reviewFieldsHTML({nickname: true, type: drink.type, foods: T.foods(), value: value}) +
    '<div class="hp" aria-hidden="true"><label for="fWeb">웹사이트</label><input id="fWeb" name="website" tabindex="-1" autocomplete="off"></div>' +
    (edit ? '' : '<p class="note">리뷰는 바로 공개돼요. 고치거나 지우는 건 리뷰를 쓴 이 브라우저에서만 할 수 있어요. 링크는 넣을 수 없고, 다른 사람을 불쾌하게 하는 리뷰는 운영자가 숨길 수 있어요.</p>') +
    '<div class="tbtns"><button class="cta" type="submit">' + (edit ? '고친 내용 저장' : '리뷰 남기기') + '</button>' + (edit ? '<button class="chip" type="button" data-cancel>취소</button>' : '') + '</div>' +
    '<p class="form-status" role="status" aria-live="polite"></p></form>';
}
function readForm(form){
  var v = T.readReview(form);
  if (v.data) { v.data.website = form.elements.website.value; T.store(NICK, v.data.nickname); }
  return v;
}
function mountWrite(){
  box.innerHTML = formHTML({nickname: T.store(NICK) || ''});
  var form = box.querySelector('form'); T.bindReview(form);
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var v = readForm(form); if (v.error) return T.fail(form, v);
    var btn = form.querySelector('[type=submit]'); btn.disabled = true; T.say(form, '저장하는 중…');
    api('POST', 'drinks/' + drink.id + '/reviews', v.data).then(function(j){
      btn.disabled = false;
      if (!j.ok) return T.say(form, errText(j), 'err');
      if (j.id) { tokens[j.id] = j.token; T.store(TOKENS, tokens); }
      location.hash = 'review-' + j.id; location.reload();
    }, function(){ btn.disabled = false; T.say(form, '네트워크 오류예요. 연결을 확인해 주세요.', 'err'); });
  });
}

/* ---------- 내 리뷰 고치기 · 지우기, 관리자 숨기기 ---------- */
function mountActions(){
  document.querySelectorAll('.trv').forEach(function(li){
    var id = +li.dataset.id, mine = !!tokens[id], r = byId[id];
    if (!mine && !admin) return;
    var act = li.querySelector('.trv-act');
    act.innerHTML = (mine ? '<span class="tmine">내가 쓴 리뷰</span>' : '') +
      '<button class="chip" type="button" data-edit>수정</button><button class="chip" type="button" data-del>삭제</button>' +
      (admin ? '<button class="chip" type="button" data-hide>' + (r.status === 'hidden' ? '다시 보이기' : '숨기기') + '</button>' : '');
    act.hidden = false;
  });
}
document.addEventListener('click', function(e){
  var b = e.target.closest('.trv-act [data-edit],.trv-act [data-del],.trv-act [data-hide]'); if (!b) return;
  var li = b.closest('.trv'), id = +li.dataset.id, r = byId[id], tok = tokens[id];
  if (b.hasAttribute('data-del')) {
    if (!confirm(r.nickname + '님의 리뷰를 지울까요? 되돌릴 수 없어요.')) return;
    api('DELETE', 'reviews/' + id, null, tok).then(function(j){
      if (!j.ok) return alert(errText(j));
      delete tokens[id]; T.store(TOKENS, tokens); location.reload();
    });
  }
  if (b.hasAttribute('data-hide')) {
    api('PATCH', 'reviews/' + id, {status: r.status === 'hidden' ? 'published' : 'hidden'}).then(function(j){ if (j.ok) location.reload(); else alert(errText(j)); });
  }
  if (b.hasAttribute('data-edit')) {
    var keep = li.innerHTML;
    li.innerHTML = formHTML(r, true);
    var form = li.querySelector('form'); T.bindReview(form);
    form.querySelector('[data-cancel]').addEventListener('click', function(){ li.innerHTML = keep; });
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      var v = readForm(form); if (v.error) return T.fail(form, v);
      api('PUT', 'reviews/' + id, v.data, tok).then(function(j){
        if (!j.ok) return T.say(form, errText(j), 'err');
        location.hash = 'review-' + id; location.reload();
      });
    });
  }
});

mountWrite();
fetch('/api/tasting/me').then(function(r){ return r.json(); }).then(function(j){ admin = !!j.admin; mountActions(); }, mountActions);
})();
