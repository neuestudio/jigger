/* 테이스팅 노트 공통 설정: 주종 · 맛 태그 · 입력 제한
   Worker(공개 페이지·API)와 scripts/build.mjs(관리자 화면, 나의 기록장)가 함께 읽어요.
   주종을 추가하려면 TYPES에 한 줄 넣으면 돼요. key는 저장되는 값이라 한번 쓰면 바꾸지 마세요. */
export const TYPES = [
  {key:'whisky',     ko:'위스키',          en:'Whisky',           subs:['싱글몰트', '블렌디드', '버번', '라이', '아이리시', '재패니즈']},
  {key:'wine',       ko:'와인',            en:'Wine',             subs:['레드', '화이트', '로제', '스파클링', '주정강화', '내추럴']},
  {key:'beer',       ko:'맥주',            en:'Beer',             subs:['라거', '페일 에일', 'IPA', '스타우트', '밀맥주', '사워']},
  {key:'sake',       ko:'사케',            en:'Sake',             subs:['준마이', '긴조', '다이긴조', '혼조조', '니고리']},
  {key:'makgeolli',  ko:'막걸리',          en:'Makgeolli',        subs:['생막걸리', '살균 막걸리', '과일 막걸리']},
  {key:'yakju',      ko:'약주 · 청주',     en:'Yakju',            subs:['약주', '청주', '과실주']},
  {key:'soju',       ko:'소주',            en:'Soju',             subs:['희석식', '증류식']},
  {key:'baijiu',     ko:'고량주',          en:'Baijiu',           subs:['장향', '농향', '청향']},
  {key:'gin',        ko:'진',              en:'Gin',              subs:['런던 드라이', '뉴 웨스턴', '올드 톰']},
  {key:'rum',        ko:'럼',              en:'Rum',              subs:['화이트', '골드', '다크', '스파이스드', '아그리콜']},
  {key:'vodka',      ko:'보드카',          en:'Vodka',            subs:['플레인', '플레이버드']},
  {key:'tequila',    ko:'테킬라 · 메즈칼', en:'Tequila & Mezcal', subs:['블랑코', '레포사도', '아녜호', '메즈칼']},
  {key:'brandy',     ko:'브랜디',          en:'Brandy',           subs:['코냑', '아르마냑', '칼바도스']},
  {key:'liqueur',    ko:'리큐르',          en:'Liqueur',          subs:['허브', '과일', '크림', '커피']},
  {key:'cocktail',   ko:'칵테일',          en:'Cocktail',         subs:['클래식', '시그니처']},
  {key:'other',      ko:'기타',            en:'Other',            subs:[]}
];
export const TYPE_BY_KEY = Object.fromEntries(TYPES.map(t => [t.key, t]));

/* 맛 태그 (직접 입력한 태그도 함께 저장돼요) */
export const TAGS = ['달콤', '드라이', '산뜻', '과일향', '꽃향', '허브향', '스모키', '피트', '오크', '바닐라', '스파이시', '고소', '쌉쌀', '짭짤', '묵직', '가벼움', '탄산'];

/* 입력 길이 제한 (서버와 화면이 같은 값을 써요) */
export const LIMITS = {
  name: 80, name_en: 80, subtype: 40, producer: 80, country: 40,
  note: 600, review: 5000, tag: 20, tags: 12, pairing: 8
};
