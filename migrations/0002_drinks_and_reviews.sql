-- 테이스팅 노트 v2: 술(drinks)과 리뷰(reviews)를 나눠요. 술 하나에 여러 사람이 닉네임으로 리뷰를 남겨요.
-- 기존 리뷰는 같은 번호의 술 + 운영자(Naano) 리뷰 하나로 옮겨요. 기존 맛 태그는 ‘맛’ 선택지로 합쳐요.

ALTER TABLE reviews RENAME TO reviews_v1;
DROP INDEX IF EXISTS idx_reviews_list;
DROP INDEX IF EXISTS idx_reviews_type;

CREATE TABLE drinks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,            -- 한글 이름
  name_en    TEXT,                        -- 영문 이름
  type       TEXT    NOT NULL,            -- 주종 key (worker/tasting-config.js의 TYPES)
  subtype    TEXT,                        -- 세부 종류 · 품종
  producer   TEXT,                        -- 생산자 · 브랜드
  country    TEXT,                        -- 원산지
  abv        REAL,                        -- 도수 (%)
  price      INTEGER,                     -- 가격 (원)
  photo      TEXT,                        -- 사진 R2 키
  published  INTEGER NOT NULL DEFAULT 1,  -- 1 공개, 0 비공개
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE INDEX idx_drinks_pub ON drinks (published, type);

CREATE TABLE reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  drink_id   INTEGER NOT NULL REFERENCES drinks (id) ON DELETE CASCADE,
  nickname   TEXT    NOT NULL,
  is_admin   INTEGER NOT NULL DEFAULT 0,  -- 운영자가 쓴 리뷰
  rating     REAL    NOT NULL,            -- 0.5 ~ 5 (0.5 단위)
  tasted_on  TEXT    NOT NULL,            -- 마신 날 YYYY-MM-DD
  nose       TEXT    NOT NULL DEFAULT '[]',  -- 향 선택지 JSON 배열
  palate     TEXT    NOT NULL DEFAULT '[]',  -- 맛
  finish     TEXT    NOT NULL DEFAULT '[]',  -- 여운
  review     TEXT    NOT NULL,
  pairing    TEXT    NOT NULL DEFAULT '[]',  -- 함께 먹은 안주 [{id, ko}]
  status     TEXT    NOT NULL DEFAULT 'published',  -- published | hidden(운영자가 숨김)
  edit_hash  TEXT,                        -- 작성자 수정용 토큰의 해시 (방문자 리뷰)
  ip_hash    TEXT,                        -- 도배 방지용 IP 해시
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE INDEX idx_reviews_drink ON reviews (drink_id, status);
CREATE INDEX idx_reviews_nick ON reviews (nickname, status);
CREATE INDEX idx_reviews_ip ON reviews (ip_hash, created_at);

INSERT INTO drinks (id, name, name_en, type, subtype, producer, country, abv, price, photo, published, created_at, updated_at)
  SELECT id, name, name_en, type, subtype, producer, country, abv, price, photo, published, created_at, updated_at FROM reviews_v1;

INSERT INTO reviews (drink_id, nickname, is_admin, rating, tasted_on, nose, palate, finish, review, pairing, status, created_at, updated_at)
  SELECT r.id, 'Naano', 1, r.rating, r.tasted_on,
    CASE WHEN r.nose IS NULL OR r.nose = '' THEN '[]' ELSE json_array(r.nose) END,
    (SELECT json_group_array(value) FROM (
       SELECT value FROM json_each(r.tags)
       UNION ALL SELECT r.palate WHERE r.palate IS NOT NULL AND r.palate != '')),
    CASE WHEN r.finish IS NULL OR r.finish = '' THEN '[]' ELSE json_array(r.finish) END,
    r.review, r.pairing, 'published', r.created_at, r.updated_at
  FROM reviews_v1 r;

DROP TABLE reviews_v1;
