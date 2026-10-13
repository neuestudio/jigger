/* 매거진 글: scripts/build.mjs가 /magazine/ 목록과 /magazine/<id>/ 글 페이지로 만들어요.
   주종 페이지(도수 · 제조법)와 겹치지 않게, 상황별 큐레이션과 실전 팁을 다뤄요.
   - title: <title> (40자 안, " | 지거바" 포함) · desc: 80자 안 · h1: 본문 제목
   - date / updated: 게시일 · 수정일 (YYYY-MM-DD)
   - cover: 대표 사진 [폴더, id] (images/<폴더>/<id>.webp)
   - cocktails / foods: 글 끝에 카드로 보여줄 레시피 id
   - sections: [제목, 본문 HTML]. 본문의 링크는 아래 r() · f() · s() · p()로 만들어요 (없는 id면 빌드가 멈춰요)
   - memo: 운영자가 직접 해 보고 남길 한마디 (비어 있으면 안 보여요) */
export default function magazine({R, F, S, P, esc, img}){
  const need = (by, id, kind) => { if (!by[id]) throw new Error(`매거진: 없는 ${kind} id "${id}"`); return by[id]; };
  const r = (id, text) => `<a href="/cocktails/${id}/">${esc(text || need(R, id, '칵테일').ko)}</a>`;
  const f = (id, text) => `<a href="/food/${id}/">${esc(text || need(F, id, '안주').ko)}</a>`;
  const s = (id, text) => `<a href="/spirits/${id}/">${esc(text || need(S, id, '주종').ko)}</a>`;
  const p = (id, text) => `<a href="/party/${id}/">${esc(text || need(P, id, '파티').ko)}</a>`;
  const rec = id => need(R, id, '칵테일');
  // 사진 묶음: g(['c', 칵테일 id, '설명'], ['f', 안주 id, '설명'], ...) → 2~4장 그리드, 사진을 누르면 레시피로 가요
  const g = (...items) => `<div class="mgrid n${items.length}">${items.map(([k, id, note]) => {
    const [dir, x] = k === 'c' ? ['cocktails', need(R, id, '칵테일')] : ['food', need(F, id, '안주')];
    return `<figure><a href="/${dir}/${id}/"><img src="${img([dir, id], true)}" alt="${esc(x.ko)}" width="640" height="640" loading="lazy" decoding="async"></a>
          <figcaption>${x.noLabel ? `<i class="cnum">${x.noLabel}</i>` : ''}<a href="/${dir}/${id}/">${esc(x.ko)}</a>${note ? `<span>${esc(note)}</span>` : ''}</figcaption></figure>`;
  }).join('')}</div>`;
  const ingLine = id => rec(id).ing.map(([n, a, u]) => `${n} ${a}${u && u !== 'dash' ? u : u === 'dash' ? ' dash' : ''}`).join(' · ');

  return [
  {
    id:'highball-at-home', date:'2026-10-08', updated:'2026-10-12',
    eyebrow:'Highball at Home',
    title:'하이볼 만드는 법 · 위스키 비율과 편의점 재료 조합 | 지거바',
    h1:'집에서 만드는 하이볼, 비율 하나만 기억하세요',
    desc:'하이볼 황금비율 1:3~4, 맛있게 만드는 순서, 편의점 탄산 · 과일 조합 5가지와 위스키 고르는 법.',
    lead:'하이볼은 증류주에 탄산을 길게 채운 술이에요. 재료는 단순한데, 비율과 온도, 탄산을 붓는 방법에 따라 맛이 크게 달라져요. 처음 만드는 날에도 바에서 마시는 맛에 가깝게 만드는 방법을 정리했어요.',
    cover:['cocktails', 'whisky-highball'],
    keywords:['하이볼 만들기', '하이볼 비율', '위스키 하이볼', '하이볼 레시피', '편의점 하이볼'],
    sections:[
      ['황금비율은 위스키 1 : 탄산 3~4', `
        <p>가장 무난한 시작점은 <b>위스키 45ml에 탄산수 135~180ml</b>예요. 진하게 마시고 싶으면 1:3, 가볍게 오래 마시려면 1:4로 맞추세요. 계량컵이 없다면 소주잔 한 잔이 약 50ml라서 그대로 기준으로 써도 돼요. 잔 수에 맞춘 계량은 ${r('whisky-highball')} 레시피에서 바로 볼 수 있어요.</p>
        <table class="ptable"><thead><tr><th>스타일</th><th>위스키</th><th>탄산</th><th>느낌</th></tr></thead><tbody>
          <tr><th scope="row">진하게</th><td>45ml</td><td>135ml (1:3)</td><td>위스키 향이 또렷해요</td></tr>
          <tr><th scope="row">기본</th><td>45ml</td><td>160ml</td><td>향과 청량감의 균형</td></tr>
          <tr><th scope="row">가볍게</th><td>45ml</td><td>180ml (1:4)</td><td>식사와 함께 오래 마시기 좋아요</td></tr>
        </tbody></table>
        <p class="note">이 비율로 만들면 얼음이 녹는 것까지 쳐서 대략 맥주보다 조금 센 정도(7~10%)가 돼요. 위스키 자체의 도수와 종류는 ${s('whisky', '위스키 주류 상식')}에 정리돼 있어요.</p>`],
      ['맛있게 만드는 순서', `
        <ol class="steps">
          <li>잔과 탄산수를 미리 차갑게 해 두세요. 미지근한 탄산은 붓는 순간 김이 빠져요.</li>
          <li>하이볼 잔에 얼음을 잔 끝까지 가득 채워요. 얼음이 적으면 빨리 녹아서 맛이 묽어져요.</li>
          <li>위스키를 넣고 바 스푼으로 10번쯤 저어 위스키를 먼저 차갑게 만들어요. 녹은 만큼 얼음을 다시 채워요.</li>
          <li>탄산수는 얼음에 직접 닿지 않게 잔 벽을 따라 천천히 부어요.</li>
          <li>마지막으로 스푼을 바닥까지 넣어 한 번만 살짝 들어 올리듯 섞어요. 여러 번 저으면 탄산이 날아가요.</li>
          <li>레몬 껍질을 잔 위에서 비틀어 향을 뿌리면 완성이에요.</li>
        </ol>
        ${g(['c', 'tom-collins', '얼음은 잔 끝까지 가득'], ['c', 'paloma', '탄산은 잔 벽을 따라'])}`],
      ['편의점에서 사는 재료로 5가지 조합', `
        <p>위스키 한 병만 있으면 편의점 음료로 맛을 바꿀 수 있어요. 탄산수는 <b>무가당</b>을 고르세요. 단맛이 있는 탄산수는 위스키 향을 덮어요.</p>
        <table class="ptable"><thead><tr><th>조합</th><th>더하는 것</th><th>맛</th></tr></thead><tbody>
          <tr><th scope="row">클래식</th><td>탄산수 + 레몬 조각</td><td>깔끔하고 드라이해요. 기본으로 시작하기 좋아요</td></tr>
          <tr><th scope="row">진저</th><td>진저에일</td><td>달콤하고 알싸해요. 버번처럼 단맛 있는 위스키와 잘 맞아요</td></tr>
          <tr><th scope="row">토닉</th><td>토닉워터 + 라임</td><td>쌉쌀한 끝맛. 단 걸 싫어하는 분께 좋아요</td></tr>
          <tr><th scope="row">콜라</th><td>콜라 + 레몬</td><td>달고 친숙한 맛. 위스키를 처음 마시는 친구에게</td></tr>
          <tr><th scope="row">과일청</th><td>탄산수 + 유자청이나 자몽청 1큰술</td><td>상큼하고 향긋해요. 청을 먼저 녹인 뒤 탄산을 부어요</td></tr>
        </tbody></table>
        <p class="note">컵얼음은 편의점 얼음컵 2개면 하이볼 2~3잔이 나와요.</p>
        ${g(['c', 'gin-tonic', '토닉 조합의 원조'], ['c', 'cuba-libre', '콜라 조합은 이런 색'], ['c', 'moscow-mule', '진저 조합의 친척'])}`],
      ['위스키는 이렇게 고르세요', `
        <ul class="plist">
          <li><b>블렌디드 스카치</b>: 맛이 둥글고 무난해서 하이볼 입문용으로 가장 많이 써요.</li>
          <li><b>버번</b>: 바닐라 · 캐러멜 같은 단 향이 있어서 진저에일, 콜라와 특히 잘 어울려요.</li>
          <li><b>재패니즈 위스키</b>: 가볍고 섬세한 편이라 탄산수와 레몬만으로 깔끔하게 마시기 좋아요.</li>
          <li><b>피트(스모키) 위스키</b>: 훈연 향이 강해서 호불호가 있어요. 익숙해지면 탄산이 향을 확 퍼뜨려 줘서 매력이 커져요.</li>
        </ul>
        <p>비싼 싱글몰트를 쓸 필요는 없어요. 탄산이 섞이면 섬세한 차이는 줄어들어서, 하이볼은 오히려 가격 부담이 적은 위스키로 자주 만들어 마시는 게 좋아요.</p>`],
      ['자주 하는 실수', `
        <ul class="plist">
          <li><b>얼음을 조금만 넣기</b>: 얼음이 적을수록 더 빨리 녹아요. 잔 가득 채우는 게 오히려 덜 묽어요.</li>
          <li><b>탄산을 먼저 붓기</b>: 위스키를 나중에 부으면 섞으려고 많이 젓게 되고 탄산이 빠져요.</li>
          <li><b>남은 탄산수를 다음 날 쓰기</b>: 한 번 연 탄산수는 금방 김이 빠져요. 작은 병이나 캔을 쓰세요.</li>
        </ul>`],
      ['하이볼이 마음에 들었다면', `
        <p>위스키 대신 다른 술을 쓰면 하이볼 스타일의 다른 칵테일이 돼요. 진에 토닉워터를 채우면 ${r('gin-tonic')}, 럼에 콜라는 ${r('cuba-libre')}, 보드카에 진저비어는 ${r('moscow-mule')}, 다크 럼에 진저비어는 ${r('dark-n-stormy')}예요. 술 없이 같은 기분을 내고 싶다면 <a href="/magazine/mocktail-party/">무알콜 칵테일 가이드</a>를 참고하세요.</p>
        <p>하이볼은 기름진 안주와 잘 맞아요. 탄산이 입안을 씻어 줘서 ${f('karaage')}, ${f('wings')}, ${f('french-fries')}처럼 튀긴 음식과 함께 먹기 좋아요.</p>
        ${g(['f', 'karaage', '탄산과 튀김은 단짝'], ['f', 'wings', '달고 매운 양념에도'], ['f', 'french-fries', '가장 쉬운 짝꿍'])}`]
    ],
    cocktails:['whisky-highball', 'dark-n-stormy', 'whiskey-sour', 'old-fashioned'],
    foods:['gizzards', 'edamame', 'nuts', 'dried-snacks'],
    memo:''
  },
  {
    id:'halloween-party', date:'2026-10-08', updated:'2026-10-08',
    eyebrow:'Halloween at Home',
    title:'할로윈 홈파티 칵테일 · 안주와 준비 체크리스트 | 지거바',
    h1:'집에서 즐기는 할로윈 파티, 색으로 고르는 칵테일과 안주',
    desc:'핏빛 · 검정 · 초록 칵테일 고르는 법, 무알콜 메뉴, 손 덜 가는 할로윈 안주와 일주일 전부터의 준비 순서.',
    lead:'할로윈 파티는 메뉴를 새로 배울 필요가 없어요. 익숙한 칵테일과 안주도 색과 장식만 바꾸면 충분히 할로윈다워져요. 붐비는 거리 대신 집에서 편하게 즐기는 할로윈 홈파티를 준비해 보세요.',
    cover:['cocktails', 'bloody-mary'],
    keywords:['할로윈 칵테일', '할로윈 홈파티', '할로윈 파티 음식', '할로윈 파티 준비'],
    sections:[
      ['칵테일은 색으로 고르세요', `
        <p>할로윈의 색은 빨강 · 검정 · 주황 · 초록 · 보라예요. 맛보다 색을 먼저 정하면 메뉴가 쉽게 정리돼요.</p>
        <table class="ptable"><thead><tr><th>색</th><th>칵테일</th><th>연출</th></tr></thead><tbody>
          <tr><th scope="row">핏빛 빨강</th><td>${r('bloody-mary')}</td><td>셀러리 스틱을 꽂고, 잔 가장자리에 그레나딘을 흘려요</td></tr>
          <tr><th scope="row">검정</th><td>${r('black-russian')}</td><td>작은 온더록 잔에 큰 얼음 하나. 가장 쉽고 분위기가 좋아요</td></tr>
          <tr><th scope="row">폭풍우 회색</th><td>${r('dark-n-stormy')}</td><td>다크 럼을 마지막에 천천히 띄워 구름 같은 층을 만들어요</td></tr>
          <tr><th scope="row">주황</th><td>${r('tequila-sunrise')}</td><td>호박색 노을. 젓지 않고 그대로 내요</td></tr>
          <tr><th scope="row">마녀의 초록</th><td>${r('grasshopper')}</td><td>민트 초콜릿 맛 디저트 칵테일. 마지막 잔으로 좋아요</td></tr>
          <tr><th scope="row">밤샘용</th><td>${r('espresso-martini')}</td><td>커피가 들어가서 밤 늦게까지 노는 파티에 어울려요</td></tr>
        </tbody></table>
        ${g(['c', 'black-russian', '한밤의 검정'], ['c', 'dark-n-stormy', '먹구름 같은 층'], ['c', 'tequila-sunrise', '호박빛 노을'], ['c', 'grasshopper', '마녀의 초록'])}`],
      ['술을 안 마시는 손님 메뉴', `
        <p>무알콜 메뉴도 같은 색으로 맞추면 함께 건배하기 좋아요. 블러디 메리 대신 ${r('virgin-mary')}, 주황은 ${r('cinderella')}, 빨강은 그레나딘이 들어간 ${r('shirley-temple')}를 추천해요. 더 많은 무알콜 메뉴는 <a href="/magazine/mocktail-party/">무알콜 칵테일 가이드</a>에 모아 두었어요.</p>
        ${g(['c', 'virgin-mary', '핏빛 그대로, 술만 빼고'], ['c', 'cinderella', '주황 과일 칵테일'], ['c', 'shirley-temple', '아이도 함께 건배'])}`],
      ['한 번에 분위기 내는 장식 팁', `
        <ul class="plist">
          <li><b>눈알 가니시</b>: 통조림 리치 속에 블루베리를 넣어 칵테일 픽에 꽂으면 눈알처럼 보여요.</li>
          <li><b>핏빛 테두리</b>: 잔 가장자리를 그레나딘이나 딸기 시럽에 살짝 담갔다 세워 두면 흘러내리는 모양이 나요.</li>
          <li><b>귤 호박</b>: 귤 껍질에 네임펜으로 호박 얼굴을 그리면 과일 접시가 바로 할로윈 테이블이 돼요.</li>
          <li><b>조명</b>: 주황색 전구나 LED 캔들을 쓰세요. 코스튬과 장식이 많은 날에는 진짜 촛불보다 안전해요.</li>
        </ul>
        <p class="note">연기 효과를 내는 드라이아이스는 음료에 직접 넣지 마세요. 삼키면 다칠 수 있어서, 쓰려면 음료와 닿지 않는 별도 그릇에만 두는 게 안전해요.</p>`],
      ['손이 덜 가는 할로윈 안주', `
        <p>파티 당일에는 칵테일 만들기에 손이 많이 가요. 안주는 미리 만들어 두거나 데우기만 하면 되는 메뉴가 좋아요.</p>
        <ul class="plist">
          <li>${f('wings')}: 빨간 양념이 그대로 할로윈 색이에요. 미리 튀겨 두고 먹기 직전에 양념에 버무려요.</li>
          <li>${f('nachos')}와 ${f('guacamole')}: 초록 과카몰리는 ‘늪’, 살사는 ‘피’. 손님이 직접 찍어 먹어서 편해요.</li>
          <li>${f('stuffed-mushrooms')}: 오븐에 넣어 두기만 하면 돼서 칵테일 만드는 동안 완성돼요.</li>
          <li>${f('sausage-stir-fry')}: 아이가 있는 집 파티에 좋아요. 소시지에 칼집을 내면 손가락 모양이 돼요.</li>
          <li>${f('chocolate')}: 마지막 디저트. 그래스호퍼나 에스프레소 마티니와 잘 맞아요.</li>
        </ul>
        ${g(['f', 'wings', '빨간 양념 그대로'], ['f', 'nachos', '찍어 먹는 재미'], ['f', 'guacamole', '초록 늪 소스'], ['f', 'stuffed-mushrooms', '오븐에 맡기기'])}`],
      ['일주일 전부터 준비 순서', `
        <ol class="ptime">
          <li><b>1주 전</b><span>인원과 시간 정하기, 코스튬 여부 알리기. 메뉴는 칵테일 3가지 + 무알콜 1가지 정도가 적당해요</span></li>
          <li><b>3일 전</b><span>술 · 리큐르 · 그레나딘 · 리치 통조림 · 장식 소품 장보기</span></li>
          <li><b>전날</b><span>시럽과 가니시 준비, 안주 밑손질, 잔과 탄산 음료 냉장</span></li>
          <li><b>당일 오전</b><span>얼음 넉넉히 사 두기 (한 사람당 1kg 정도), 조명과 플레이리스트 세팅</span></li>
          <li><b>시작 1시간 전</b><span>오븐 안주 굽기, 첫 잔 재료를 바 위에 꺼내 두기</span></li>
        </ol>
        <p>인원과 예산을 넣으면 수량과 장보기 목록을 계산해 주는 <a href="/party/plan/">내 파티 만들기</a>도 함께 써 보세요. 영화를 같이 볼 계획이라면 ${p('game-night')} 준비물도 참고가 돼요.</p>`]
    ],
    cocktails:['bloody-mary', 'espresso-martini', 'blue-hawaiian', 'b-52'],
    foods:['sausage-stir-fry', 'chocolate', 'fruit-platter', 'garlic-bread'],
    memo:''
  },
  {
    id:'mocktail-party', date:'2026-10-08', updated:'2026-10-08',
    eyebrow:'Zero-Proof Party',
    title:'무알콜 칵테일 레시피 · 술 없이 즐기는 목테일 8가지 | 지거바',
    h1:'술 없이도 파티처럼, 무알콜 칵테일 8가지',
    desc:'운전하는 친구, 임신 중인 손님도 함께 건배하는 무알콜 칵테일 8가지와 술 같은 맛을 내는 팁, 대량으로 만드는 법.',
    lead:'요즘은 술자리에서 무알콜 음료를 고르는 사람이 많아졌어요. 운전하는 친구, 임신 중인 손님, 술을 쉬고 있는 사람도 같은 잔으로 건배할 수 있게 집에서 쉽게 만드는 무알콜 칵테일(목테일)을 모았어요.',
    cover:['cocktails', 'virgin-mojito'],
    keywords:['무알콜 칵테일', '목테일 레시피', '논알콜 칵테일', '무알콜 음료 파티'],
    sections:[
      ['무알콜과 비알콜은 달라요', `
        <p>시판 음료를 살 때는 표기를 확인하세요. <b>무알코올</b>은 알코올이 전혀 없는(0.00%) 제품이고, <b>비알코올</b>은 1% 미만의 알코올이 들어 있을 수 있는 제품이에요. 임신 중이거나 알코올을 완전히 피해야 하는 손님에게는 무알코올 제품이나 직접 만든 목테일을 내세요.</p>`],
      ['집에서 만드는 무알콜 칵테일 8가지', `
        ${g(['c', 'ginger-mule', '알싸한 진저'], ['c', 'shirley-temple', '달콤한 첫 잔'], ['c', 'cinderella', '과일 주스처럼'], ['c', 'arnold-palmer', '식사와 함께'])}
        <table class="ptable"><thead><tr><th>칵테일</th><th>재료</th><th>이런 분께</th></tr></thead><tbody>
          <tr><th scope="row">${r('virgin-mojito')}</th><td>${esc(ingLine('virgin-mojito'))}</td><td>상쾌한 민트를 좋아한다면</td></tr>
          <tr><th scope="row">${r('ginger-mule')}</th><td>${esc(ingLine('ginger-mule'))}</td><td>알싸하고 어른스러운 맛</td></tr>
          <tr><th scope="row">${r('shirley-temple')}</th><td>${esc(ingLine('shirley-temple'))}</td><td>달콤한 첫 잔, 아이와 함께</td></tr>
          <tr><th scope="row">${r('cinderella')}</th><td>${esc(ingLine('cinderella'))}</td><td>과일 주스 같은 편안한 맛</td></tr>
          <tr><th scope="row">${r('arnold-palmer')}</th><td>${esc(ingLine('arnold-palmer'))}</td><td>식사와 함께 마시기 좋아요</td></tr>
          <tr><th scope="row">${r('virgin-mary')}</th><td>${esc(ingLine('virgin-mary'))}</td><td>달지 않은 짭짤한 맛</td></tr>
          <tr><th scope="row">${r('fresh-lemon-squash')}</th><td>${esc(ingLine('fresh-lemon-squash'))}</td><td>재료가 가장 간단해요</td></tr>
          <tr><th scope="row">${r('virgin-colada')}</th><td>${esc(ingLine('virgin-colada'))}</td><td>디저트처럼 진하고 부드럽게</td></tr>
        </tbody></table>
        <p class="note">레시피를 누르면 잔 수에 맞춘 계량과 만드는 순서를 볼 수 있어요.</p>`],
      ['술 같은 맛을 내는 4가지 요령', `
        <ul class="plist">
          <li><b>쓴맛 더하기</b>: 술이 빠지면 단맛만 남기 쉬워요. 토닉워터, 진하게 우린 홍차, 자몽 껍질처럼 쌉쌀한 재료를 조금 넣으면 맛이 단단해져요.</li>
          <li><b>매운맛으로 ‘술 기운’</b>: 진저비어의 생강 맛이나 후추, 타바스코가 목을 데우는 느낌을 대신해 줘요.</li>
          <li><b>신선한 산미</b>: 시판 주스 대신 생레몬 · 라임을 직접 짜면 훨씬 칵테일다워요.</li>
          <li><b>잔과 가니시는 똑같이</b>: 술 마시는 손님과 같은 잔, 같은 장식으로 내면 무알콜이라는 게 티 나지 않아요.</li>
        </ul>
        ${g(['c', 'virgin-mary', '짭짤 · 매콤'], ['c', 'fresh-lemon-squash', '생레몬의 산미'], ['c', 'virgin-colada', '진하고 부드럽게'])}`],
      ['홈파티에서 대량으로 만들기', `
        <p>손님이 많으면 한 잔씩 만들기보다 피처로 미리 섞어 두세요. 탄산은 마지막에 넣어야 해요.</p>
        <ol class="steps">
          <li>시럽 · 주스 · 과일즙만 피처에 먼저 섞어 냉장고에 넣어 둬요. 예를 들어 셜리 템플 10잔이면 그레나딘 150ml와 라임즙 100ml예요.</li>
          <li>손님이 오면 얼음을 채운 잔에 베이스를 3분의 1쯤 붓고 차가운 진저에일 · 탄산수를 채워요.</li>
          <li>민트, 레몬 슬라이스, 체리 같은 가니시를 작은 그릇에 두면 손님이 직접 꾸밀 수 있어요.</li>
        </ol>
        <p>무알콜 음료 코너를 칵테일 옆에 따로 만들어 두면 손님이 눈치 보지 않고 골라 마실 수 있어요. 메뉴판에 술이 없는 메뉴를 같은 크기로 적어 두는 것도 좋은 배려예요.</p>`],
      ['함께 내기 좋은 안주', `
        <p>무알콜 칵테일은 산뜻한 음식과 잘 어울려요. ${f('fruit-platter')}, ${f('caprese')}, ${f('bruschetta')}처럼 가볍게 집어 먹는 메뉴를 추천해요. 하이볼처럼 탄산으로 즐기고 싶다면 <a href="/magazine/highball-at-home/">하이볼 가이드</a>의 편의점 조합에서 위스키만 빼고 만들어도 돼요.</p>
        ${g(['f', 'fruit-platter', '가볍게 집어 먹기'], ['f', 'caprese', '산뜻한 토마토'], ['f', 'bruschetta', '한입 크기'])}`]
    ],
    cocktails:[],
    foods:['guacamole', 'fish-tacos', 'ceviche', 'prosciutto-melon'],
    memo:''
  },
  {
    id:'beaujolais-nouveau', date:'2026-10-20', updated:'2026-10-20',
    eyebrow:'Beaujolais Nouveau',
    title:'보졸레 누보 출시일과 마시는 법 · 어울리는 안주 | 지거바',
    h1:'보졸레 누보, 올해 첫 와인을 집에서 맛있게',
    desc:'2026년 보졸레 누보는 11월 19일 출시. 살짝 차게 마시는 온도, 잔 고르기, 치즈부터 족발까지 어울리는 안주.',
    lead:'보졸레 누보는 그해 수확한 포도로 만든 첫 와인이에요. 무겁고 복잡한 와인이 아니라서 와인을 잘 몰라도 부담 없이 즐기기 좋아요. 출시일에 맞춰 집에서 가볍게 열어 보는 법을 정리했어요.',
    cover:['spirits', 'wine'],
    keywords:['보졸레 누보', '보졸레 누보 출시일', '보졸레 누보 마시는 법', '보졸레 누보 안주'],
    sections:[
      ['보졸레 누보는 어떤 와인인가요', `
        <p>프랑스 부르고뉴 남쪽 보졸레 지역에서 <b>가메(Gamay)</b> 품종으로 만든 레드 와인이에요. 포도를 송이째 발효시키는 방식으로 짧게 만들어서 색이 밝고, 딸기 · 체리 · 바나나 같은 과일 향이 나고, 떫은맛(탄닌)이 적어요.</p>
        <p>해마다 <b>11월 셋째 목요일</b>에 전 세계에서 같은 날 판매를 시작해요. 2026년은 <b>11월 19일(목)</b>이에요. 오래 두고 숙성시키는 와인이 아니라서 사면 몇 달 안에 마시는 게 가장 맛있어요.</p>
        <table class="ptable"><thead><tr><th>이름</th><th>특징</th></tr></thead><tbody>
          <tr><th scope="row">보졸레 누보</th><td>그해 첫 와인. 가볍고 과일 향이 가장 신선해요</td></tr>
          <tr><th scope="row">보졸레 빌라주</th><td>지정된 마을의 포도로 만들어 조금 더 진해요</td></tr>
          <tr><th scope="row">보졸레 크뤼</th><td>이름난 10개 마을 와인. 숙성도 할 수 있어요</td></tr>
        </tbody></table>
        <p class="note">와인 종류와 도수는 ${s('wine', '와인 주류 상식')}에 정리돼 있어요.</p>`],
      ['맛있게 마시는 세 가지', `
        <ul class="plist">
          <li><b>살짝 차갑게</b>: 레드 와인이지만 12~14℃ 정도로 시원하게 마시면 과일 향이 살아나요. 상온에 있던 병이면 냉장고에 20~30분 넣었다 꺼내세요.</li>
          <li><b>잔은 일반 와인잔이면 충분</b>: 향이 모이는 볼이 있는 와인잔이 좋지만, 없으면 물잔도 괜찮아요. 디캔팅은 필요 없어요.</li>
          <li><b>한 번 열면 그날 마시기</b>: 가벼운 와인이라 열어 두면 향이 빨리 빠져요. 남으면 마개를 막아 냉장고에 두고 1~2일 안에 마시세요.</li>
        </ul>`],
      ['어울리는 안주', `
        <p>보졸레 누보는 가볍고 산미가 있어서 무거운 고기보다 짭짤하고 기름기가 적당한 음식과 잘 맞아요.</p>
        <ul class="plist">
          <li><b>치즈 · 햄</b>: ${f('cheese')}의 부드러운 치즈, ${f('prosciutto-melon')}처럼 짭짤한 햄이 가장 쉬운 짝이에요.</li>
          <li><b>한식과도 잘 맞아요</b>: 기름기를 뺀 ${f('suyuk')}이나 ${f('jokbal')}, ${f('beef-jeon')}처럼 간이 세지 않은 음식과 함께 마셔 보세요.</li>
          <li><b>피해야 할 것</b>: 아주 매운 음식은 와인의 과일 향을 덮어요.</li>
        </ul>
        ${g(['f', 'cheese', '부드러운 치즈부터'], ['f', 'prosciutto-melon', '짭짤함과 단맛'], ['f', 'jokbal', '의외의 단짝'], ['f', 'beef-jeon', '간이 순한 전'])}`],
      ['와인 나이트로 즐기기', `
        <p>출시일 저녁에 친구 몇 명과 한 병씩 가져와 비교해 보는 것도 재미있어요. 와인잔, 치즈 플레이트, 준비 순서는 ${p('wine-cheese')} 준비물을 그대로 쓰면 돼요. 인원과 예산을 넣으면 와인 병 수까지 계산해 주는 <a href="/party/plan/">내 파티 만들기</a>도 함께 써 보세요.</p>`],
      ['남은 와인은 뱅쇼로', `
        <p>다 못 마신 보졸레 누보는 오렌지와 시나몬을 넣고 데워 ${r('mulled-wine')}로 만들면 좋아요. 과일 향이 진한 가벼운 레드 와인이라 뱅쇼와 특히 잘 어울려요. 추운 날 위스키로 만드는 따뜻한 술은 ${r('hot-toddy')}예요.</p>
        ${g(['c', 'mulled-wine', '남은 와인의 변신'], ['c', 'hot-toddy', '위스키로 만드는 한 잔'])}`]
    ],
    cocktails:['kir', 'mimosa', 'aperol-spritz'],
    foods:['olives', 'salmon', 'suyuk', 'nuts'],
    memo:''
  },
  {
    id:'suneung-party', date:'2026-10-27', updated:'2026-10-27',
    eyebrow:'After the Exam',
    title:'수능 끝 홈파티 · 무알콜 칵테일과 분식 메뉴 | 지거바',
    h1:'수능 끝난 날, 술 없이 신나는 홈파티',
    desc:'수능 끝난 수험생을 위한 무알콜 칵테일 4가지와 분식 · 튀김 메뉴, 영화 · 게임 홈파티 준비 순서.',
    lead:'시험이 끝난 날은 그동안 고생한 만큼 신나게 축하해 주고 싶죠. 고3 수험생은 대부분 아직 청소년이라 술은 빼고, 대신 칵테일처럼 예쁜 무알콜 음료와 좋아하는 음식으로 파티를 차려 보세요.',
    cover:['cocktails', 'shirley-temple'],
    keywords:['수능 끝 파티', '수능 끝나고', '수험생 파티 음식', '무알콜 칵테일'],
    sections:[
      ['칵테일 잔에 담는 무알콜 4가지', `
        <p>잔과 장식만 칵테일처럼 갖추면 무알콜이어도 특별한 날 기분이 나요. 재료가 간단하고 편의점에서 다 살 수 있는 4가지를 골랐어요.</p>
        ${g(['c', 'shirley-temple', '달콤한 첫 건배'], ['c', 'cinderella', '과일 주스처럼'], ['c', 'virgin-mojito', '상쾌한 민트'], ['c', 'virgin-colada', '디저트처럼 진하게'])}
        <p>더 많은 레시피와 술 같은 맛을 내는 요령은 <a href="/magazine/mocktail-party/">무알콜 칵테일 가이드</a>에 모아 두었어요.</p>`],
      ['좋아하는 음식이 최고의 메뉴', `
        <p>시험 기간 내내 참았던 음식을 차려 주세요. 여럿이 나눠 먹기 좋은 분식과 튀김이 무난해요.</p>
        ${g(['f', 'tteokbokki', '모두가 좋아하는 맛'], ['f', 'wings', '손으로 집어 먹기'], ['f', 'french-fries', '영화엔 감자튀김'], ['f', 'nachos', '나눠 먹는 재미'])}
        <p class="note">${f('sausage-stir-fry')}처럼 10분이면 되는 메뉴를 하나 넣어 두면 늦게 오는 친구 몫도 금방 만들 수 있어요.</p>`],
      ['파티를 채우는 아이디어', `
        <ul class="plist">
          <li><b>그동안 못 본 영화 몰아 보기</b>: 미리 2~3편 골라 두고 투표로 정해요. 준비물은 ${p('game-night')}를 참고하세요.</li>
          <li><b>보드게임 · 노래방 앱</b>: 시험 이야기에서 자연스럽게 벗어나게 해 줘요.</li>
          <li><b>수험표 사진 찍기</b>: 마지막 수험표를 들고 찍는 기념사진은 나중에 좋은 추억이 돼요.</li>
          <li><b>결과 이야기는 꺼내지 않기</b>: 가채점 이야기는 다음 날로 미뤄 두는 게 모두에게 편해요.</li>
        </ul>`],
      ['준비 순서', `
        <ol class="ptime">
          <li><b>2~3일 전</b><span>인원 정하기, 음료 재료(진저에일 · 그레나딘 · 주스 · 민트) 장보기</span></li>
          <li><b>전날</b><span>잔과 음료 차게 두기, 떡볶이 양념 미리 섞어 두기</span></li>
          <li><b>당일</b><span>얼음 넉넉히 준비, 튀김류는 먹기 직전에 데우기</span></li>
        </ol>
        <p>인원과 예산을 넣으면 수량과 장보기 목록을 계산해 주는 <a href="/party/plan/">내 파티 만들기</a>에서 ‘술 없이’ 조건을 골라 보세요.</p>`]
    ],
    cocktails:['ginger-mule', 'arnold-palmer', 'fresh-lemon-squash', 'virgin-mary'],
    foods:['sausage-stir-fry', 'chocolate', 'fruit-platter', 'garlic-bread'],
    memo:''
  },
  {
    id:'year-end-party', date:'2026-11-10', updated:'2026-11-10',
    eyebrow:'Year-End Party',
    title:'송년회 홈파티 준비 · 술 한 병으로 칵테일 4가지 | 지거바',
    h1:'집에서 하는 송년회, 술 한 병으로 칵테일 네 가지',
    desc:'진 한 병으로 만드는 칵테일 4가지, 미리 섞어 두는 피처 칵테일, 든든한 안주와 손님 귀가까지 챙기는 송년회 준비.',
    lead:'연말 모임을 집에서 하면 시끄러운 식당보다 이야기하기 편하고, 비용도 아낄 수 있어요. 술을 여러 병 사지 않고 한 병으로 여러 칵테일을 만드는 방법과 호스트가 덜 바쁜 진행 순서를 정리했어요.',
    cover:['cocktails', 'negroni'],
    keywords:['송년회 홈파티', '연말 홈파티', '홈파티 칵테일', '송년회 메뉴'],
    sections:[
      ['진 한 병이면 네 가지가 돼요', `
        <p>700ml 진 한 병이면 칵테일 한 잔에 45~50ml씩 <b>14잔 정도</b>를 만들 수 있어요. 섞는 재료만 바꿔서 네 가지 메뉴를 준비하면 손님이 골라 마시는 재미가 생겨요.</p>
        ${g(['c', 'gin-tonic', '토닉워터만 있으면'], ['c', 'tom-collins', '레몬 · 시럽 · 소다'], ['c', 'gimlet', '라임과 시럽, 셰이크'], ['c', 'negroni', '진 · 캄파리 · 베르무트'])}
        <p class="note">셰이커가 없다면 진 토닉과 톰 콜린스만으로도 충분해요. 진의 종류와 맛은 ${s('gin', '진 주류 상식')}에 있어요.</p>`],
      ['미리 섞어 두는 피처 칵테일', `
        <p>손님이 오면 호스트는 잔을 채우느라 바빠요. 탄산이 없는 부분만 미리 섞어 두면 따르기만 하면 돼요.</p>
        <ul class="plist">
          <li><b>네그로니 한 병</b>: 진 · 캄파리 · 스위트 베르무트를 같은 양으로 빈 병에 섞어 냉장고에. 낼 때 얼음 잔에 따르고 오렌지 껍질만 올려요.</li>
          <li><b>아페롤 스프리츠 피처</b>: 아페롤만 피처에 담아 두고, 낼 때 얼음 · 프로세코 · 소다수를 차례로 부어요. 탄산은 마지막에.</li>
          <li><b>뱅쇼 한 냄비</b>: 추운 날 손님이 들어오자마자 건네기 좋아요. 약불에 올려 두면 따뜻하게 유지돼요.</li>
        </ul>
        <p>레시피는 ${r('negroni')}, ${r('aperol-spritz')}, ${r('mulled-wine')}에서 잔 수에 맞춰 계량할 수 있어요.</p>
        ${g(['c', 'negroni', '병째 섞어 두기'], ['c', 'aperol-spritz', '탄산은 마지막에'], ['c', 'mulled-wine', '약불에 올려 두기'])}`],
      ['안주는 든든한 메인 하나 + 집어 먹기', `
        <p>저녁을 겸하는 자리라면 든든한 메인 하나에 손으로 집어 먹는 메뉴 두세 가지가 적당해요.</p>
        ${g(['f', 'suyuk', '미리 삶아 두는 메인'], ['f', 'shrimp', '15분이면 완성'], ['f', 'cheese', '자르기만 하면'], ['f', 'garlic-bread', '오븐에 맡기기'])}`],
      ['손님 귀가까지 챙기기', `
        <ul class="plist">
          <li><b>무알콜 메뉴 하나</b>: 운전하는 손님, 술을 쉬는 손님을 위해 ${r('ginger-mule')} 같은 메뉴를 같은 잔으로 준비해요.</li>
          <li><b>물은 눈에 보이는 곳에</b>: 칵테일 사이사이 물을 마시면 다음 날이 훨씬 편해요.</li>
          <li><b>막차 시간 미리 확인</b>: 연말엔 택시 잡기가 어려워요. 시작할 때 각자 막차 시간을 알려 두면 마무리가 자연스러워요.</li>
          <li><b>운전은 절대 안 돼요</b>: 차를 가져온 손님에게는 처음부터 대리운전이나 다음 날 찾아가기를 안내해요.</li>
        </ul>`],
      ['준비 순서', `
        <ol class="ptime">
          <li><b>1주 전</b><span>인원 · 시간 확정, 칵테일 메뉴 4가지 정하기</span></li>
          <li><b>3일 전</b><span>진 · 캄파리 · 토닉워터 · 레몬 · 라임 장보기</span></li>
          <li><b>전날</b><span>네그로니 병 섞어 두기, 수육 고기 손질, 잔 닦아 두기</span></li>
          <li><b>당일 오후</b><span>얼음 넉넉히(한 사람당 1kg 정도), 수육 삶기</span></li>
          <li><b>시작 30분 전</b><span>뱅쇼 데우기, 바 위에 재료 꺼내 두기</span></li>
        </ol>
        <p>연말 분위기 준비물은 ${p('holiday')}, 수량 계산은 <a href="/party/plan/">내 파티 만들기</a>를 함께 보세요.</p>`]
    ],
    cocktails:['whisky-highball', 'hot-toddy', 'ginger-mule', 'old-fashioned'],
    foods:['jokbal', 'nuts', 'olives', 'karaage'],
    memo:''
  },
  {
    id:'christmas-cocktails', date:'2026-11-17', updated:'2026-11-17',
    eyebrow:'Christmas at Home',
    title:'크리스마스 칵테일 추천 · 홈파티 메뉴 12가지 | 지거바',
    h1:'크리스마스 홈파티 칵테일, 분위기별 12가지',
    desc:'따뜻한 뱅쇼와 핫 토디, 빨강 · 초록 칵테일, 디저트 칵테일, 아이와 함께 마시는 무알콜까지 크리스마스 메뉴 12가지.',
    lead:'크리스마스 파티 메뉴는 분위기로 고르면 쉬워요. 들어오자마자 건네는 따뜻한 한 잔, 사진이 예쁜 빨강 · 초록 칵테일, 케이크와 함께하는 디저트 칵테일, 아이와 함께 마실 무알콜까지 순서대로 골랐어요.',
    cover:['cocktails', 'mulled-wine'],
    keywords:['크리스마스 칵테일', '크리스마스 홈파티', '뱅쇼 만들기', '연말 칵테일'],
    sections:[
      ['들어오자마자 건네는 따뜻한 한 잔', `
        <p>추운 날 손님을 맞을 때는 따뜻한 술이 가장 반가워요. 와인으로 만드는 ${r('mulled-wine')}는 한 냄비 끓여 두면 여러 잔을 바로 낼 수 있고, 위스키에 꿀과 레몬을 넣은 ${r('hot-toddy')}는 한 잔씩 금방 만들 수 있어요.</p>
        ${g(['c', 'mulled-wine', '한 냄비로 여러 잔'], ['c', 'hot-toddy', '위스키 · 꿀 · 레몬'])}
        <p class="note">뱅쇼는 끓이지 말고 김이 오를 정도로만 데우세요. 펄펄 끓이면 향이 날아가고 떫어져요.</p>`],
      ['사진이 예쁜 빨강 · 초록', `
        ${g(['c', 'cosmopolitan', '크랜베리 빨강'], ['c', 'kir', '와인빛 분홍'], ['c', 'grasshopper', '민트 초콜릿 초록'], ['c', 'apple-martini', '사과 초록'])}
        <p>로즈마리 한 줄기를 꽂으면 작은 트리처럼 보이고, 잔 테두리에 설탕을 묻히면 눈이 쌓인 것 같은 장식이 돼요.</p>`],
      ['케이크와 함께하는 디저트 칵테일', `
        ${g(['c', 'brandy-alexander', '초콜릿 · 크림'], ['c', 'espresso-martini', '커피와 함께'], ['c', 'b-52', '층이 예쁜 한 잔'])}
        <p>달콤하고 진해서 식사 뒤 작은 잔으로 한 잔씩 내기 좋아요. ${f('chocolate')}와도 잘 어울려요.</p>`],
      ['파티를 여는 가벼운 한 잔', `
        ${g(['c', 'mimosa', '브런치 파티라면'], ['c', 'aperol-spritz', '쌉쌀한 주황'])}
        <p>도수가 낮은 스파클링 칵테일로 시작하면 긴 저녁 동안 부담이 적어요.</p>`],
      ['아이도 함께 건배', `
        <p>가족 파티라면 같은 잔에 담은 무알콜 메뉴를 꼭 준비하세요. 빨간 ${r('shirley-temple')}는 크리스마스 색 그대로예요. 더 많은 메뉴는 <a href="/magazine/mocktail-party/">무알콜 칵테일 가이드</a>에 있어요.</p>`],
      ['크리스마스 안주', `
        ${g(['f', 'steak', '파티의 메인'], ['f', 'salmon', '한입 카나페'], ['f', 'cheese', '와인과 함께'], ['f', 'garlic-bread', '모두가 좋아하는'])}
        <p>연말 홈파티 준비물과 순서는 ${p('holiday')}, 인원에 맞춘 장보기 계산은 <a href="/party/plan/">내 파티 만들기</a>에서 볼 수 있어요. 송년 모임이라면 <a href="/magazine/year-end-party/">송년회 홈파티 준비</a>도 참고하세요.</p>`]
    ],
    cocktails:['shirley-temple', 'manhattan', 'old-fashioned', 'whisky-highball'],
    foods:['shrimp', 'prosciutto-melon', 'fruit-platter', 'nuts'],
    memo:''
  }
  ];
}
