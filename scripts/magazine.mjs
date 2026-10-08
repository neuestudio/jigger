/* 매거진 글: scripts/build.mjs가 /magazine/ 목록과 /magazine/<id>/ 글 페이지로 만들어요.
   주종 페이지(도수 · 제조법)와 겹치지 않게, 상황별 큐레이션과 실전 팁을 다뤄요.
   - title: <title> (40자 안, " | 지거바" 포함) · desc: 80자 안 · h1: 본문 제목
   - date / updated: 게시일 · 수정일 (YYYY-MM-DD)
   - cover: 대표 사진 [폴더, id] (images/<폴더>/<id>.webp)
   - cocktails / foods: 글 끝에 카드로 보여줄 레시피 id
   - sections: [제목, 본문 HTML]. 본문의 링크는 아래 r() · f() · s() · p()로 만들어요 (없는 id면 빌드가 멈춰요)
   - memo: 운영자가 직접 해 보고 남길 한마디 (비어 있으면 안 보여요) */
export default function magazine({R, F, S, P, esc}){
  const need = (by, id, kind) => { if (!by[id]) throw new Error(`매거진: 없는 ${kind} id "${id}"`); return by[id]; };
  const r = (id, text) => `<a href="/cocktails/${id}/">${esc(text || need(R, id, '칵테일').ko)}</a>`;
  const f = (id, text) => `<a href="/food/${id}/">${esc(text || need(F, id, '안주').ko)}</a>`;
  const s = (id, text) => `<a href="/spirits/${id}/">${esc(text || need(S, id, '주종').ko)}</a>`;
  const p = (id, text) => `<a href="/party/${id}/">${esc(text || need(P, id, '파티').ko)}</a>`;
  const rec = id => need(R, id, '칵테일');
  const ingLine = id => rec(id).ing.map(([n, a, u]) => `${n} ${a}${u && u !== 'dash' ? u : u === 'dash' ? ' dash' : ''}`).join(' · ');

  return [
  {
    id:'highball-at-home', date:'2026-10-08', updated:'2026-10-08',
    eyebrow:'Highball at Home',
    title:'하이볼 만드는 법 · 위스키 비율과 편의점 재료 조합 | 지거바',
    h1:'집에서 만드는 하이볼, 비율 하나만 기억하세요',
    desc:'하이볼 황금비율 1:3~4, 맛있게 만드는 순서, 편의점 탄산 · 과일 조합 5가지와 위스키 고르는 법.',
    lead:'하이볼은 증류주에 탄산을 길게 채운 술이에요. 재료는 단순한데, 비율과 온도, 탄산을 붓는 방법에 따라 맛이 크게 달라져요. 처음 만드는 날에도 바에서 마시는 맛에 가깝게 만드는 방법을 정리했어요.',
    cover:['spirits', 'whisky'],
    keywords:['하이볼 만들기', '하이볼 비율', '위스키 하이볼', '하이볼 레시피', '편의점 하이볼'],
    sections:[
      ['황금비율은 위스키 1 : 탄산 3~4', `
        <p>가장 무난한 시작점은 <b>위스키 45ml에 탄산수 135~180ml</b>예요. 진하게 마시고 싶으면 1:3, 가볍게 오래 마시려면 1:4로 맞추세요. 계량컵이 없다면 소주잔 한 잔이 약 50ml라서 그대로 기준으로 써도 돼요.</p>
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
        </ol>`],
      ['편의점에서 사는 재료로 5가지 조합', `
        <p>위스키 한 병만 있으면 편의점 음료로 맛을 바꿀 수 있어요. 탄산수는 <b>무가당</b>을 고르세요. 단맛이 있는 탄산수는 위스키 향을 덮어요.</p>
        <table class="ptable"><thead><tr><th>조합</th><th>더하는 것</th><th>맛</th></tr></thead><tbody>
          <tr><th scope="row">클래식</th><td>탄산수 + 레몬 조각</td><td>깔끔하고 드라이해요. 기본으로 시작하기 좋아요</td></tr>
          <tr><th scope="row">진저</th><td>진저에일</td><td>달콤하고 알싸해요. 버번처럼 단맛 있는 위스키와 잘 맞아요</td></tr>
          <tr><th scope="row">토닉</th><td>토닉워터 + 라임</td><td>쌉쌀한 끝맛. 단 걸 싫어하는 분께 좋아요</td></tr>
          <tr><th scope="row">콜라</th><td>콜라 + 레몬</td><td>달고 친숙한 맛. 위스키를 처음 마시는 친구에게</td></tr>
          <tr><th scope="row">과일청</th><td>탄산수 + 유자청이나 자몽청 1큰술</td><td>상큼하고 향긋해요. 청을 먼저 녹인 뒤 탄산을 부어요</td></tr>
        </tbody></table>
        <p class="note">컵얼음은 편의점 얼음컵 2개면 하이볼 2~3잔이 나와요.</p>`],
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
        <p>하이볼은 기름진 안주와 잘 맞아요. 탄산이 입안을 씻어 줘서 ${f('karaage')}, ${f('wings')}, ${f('french-fries')}처럼 튀긴 음식과 함께 먹기 좋아요.</p>`]
    ],
    cocktails:['gin-tonic', 'cuba-libre', 'moscow-mule', 'dark-n-stormy'],
    foods:['karaage', 'gizzards', 'edamame', 'french-fries'],
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
        </tbody></table>`],
      ['술을 안 마시는 손님 메뉴', `
        <p>무알콜 메뉴도 같은 색으로 맞추면 함께 건배하기 좋아요. 블러디 메리 대신 ${r('virgin-mary')}, 주황은 ${r('cinderella')}, 빨강은 그레나딘이 들어간 ${r('shirley-temple')}를 추천해요. 더 많은 무알콜 메뉴는 <a href="/magazine/mocktail-party/">무알콜 칵테일 가이드</a>에 모아 두었어요.</p>`],
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
        </ul>`],
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
    cocktails:['bloody-mary', 'black-russian', 'dark-n-stormy', 'grasshopper'],
    foods:['wings', 'guacamole', 'stuffed-mushrooms', 'chocolate'],
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
        </ul>`],
      ['홈파티에서 대량으로 만들기', `
        <p>손님이 많으면 한 잔씩 만들기보다 피처로 미리 섞어 두세요. 탄산은 마지막에 넣어야 해요.</p>
        <ol class="steps">
          <li>시럽 · 주스 · 과일즙만 피처에 먼저 섞어 냉장고에 넣어 둬요. 예를 들어 셜리 템플 10잔이면 그레나딘 150ml와 라임즙 100ml예요.</li>
          <li>손님이 오면 얼음을 채운 잔에 베이스를 3분의 1쯤 붓고 차가운 진저에일 · 탄산수를 채워요.</li>
          <li>민트, 레몬 슬라이스, 체리 같은 가니시를 작은 그릇에 두면 손님이 직접 꾸밀 수 있어요.</li>
        </ol>
        <p>무알콜 음료 코너를 칵테일 옆에 따로 만들어 두면 손님이 눈치 보지 않고 골라 마실 수 있어요. 메뉴판에 술이 없는 메뉴를 같은 크기로 적어 두는 것도 좋은 배려예요.</p>`],
      ['함께 내기 좋은 안주', `
        <p>무알콜 칵테일은 산뜻한 음식과 잘 어울려요. ${f('fruit-platter')}, ${f('caprese')}, ${f('bruschetta')}처럼 가볍게 집어 먹는 메뉴를 추천해요. 하이볼처럼 탄산으로 즐기고 싶다면 <a href="/magazine/highball-at-home/">하이볼 가이드</a>의 편의점 조합에서 위스키만 빼고 만들어도 돼요.</p>`]
    ],
    cocktails:['virgin-mojito', 'ginger-mule', 'shirley-temple', 'cinderella'],
    foods:['fruit-platter', 'caprese', 'bruschetta', 'guacamole'],
    memo:''
  }
  ];
}
