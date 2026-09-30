/* 쿠팡 파트너스 제휴 링크: 상품을 추가하거나 바꿀 때는 이 파일만 고치면 돼요.
   - items: 파트너스에서 만든 단축 URL. url이 빈 항목은 사이트에 표시되지 않아요.
   - toolsFor: 레시피마다 어떤 도구를 보여줄지 정해요 (기법·글라스 정보 사용).
   메인 페이지(index.html)와 검색용 페이지(scripts/build.mjs)가 함께 읽어요. */
window.AFFILIATE = {
  disclosure: '이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
  items: {
    jigger:      {name: '지거',          desc: '재료를 정확히 계량해요',          url: 'https://link.coupang.com/a/hth22mLbi0'},
    shaker:      {name: '칵테일 셰이커', desc: '셰이크 기법에 필요해요',          url: 'https://link.coupang.com/a/hth41HoCTQ'},
    mixingGlass: {name: '믹싱 글라스',   desc: '스터 기법으로 저을 때 필요해요',  url: 'https://link.coupang.com/a/hth7VULBoy'}
  },
  toolsFor: function (r) {
    var ids = ['jigger'];
    if (r.method.indexOf('셰이크') >= 0) ids.push('shaker');
    if (r.method.indexOf('스터') >= 0) ids.push('mixingGlass');
    var items = this.items;
    return ids.map(function (id) { return items[id]; }).filter(function (x) { return x && x.url; });
  }
};
