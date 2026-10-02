-- 테이스팅 노트 (Cloudflare D1)
-- 적용: npx wrangler d1 migrations apply jigger-tasting --remote   (로컬 테스트는 --local)

CREATE TABLE reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,            -- 한글 이름 (예: 글렌피딕 12년)
  name_en    TEXT,                        -- 영문 이름 (있으면 카드에 영문 위 · 한글 아래로 보여줘요)
  type       TEXT    NOT NULL,            -- 주종 key (worker/tasting-config.js의 TYPES)
  subtype    TEXT,                        -- 세부 종류 (싱글몰트, 레드 등)
  producer   TEXT,                        -- 생산자 · 브랜드
  country    TEXT,                        -- 나라 · 지역
  abv        REAL,                        -- 도수 (%)
  price      INTEGER,                     -- 가격 (원)
  rating     REAL    NOT NULL,            -- 평점 0.5 ~ 5 (0.5 단위)
  tasted_on  TEXT    NOT NULL,            -- 마신 날짜 YYYY-MM-DD
  nose       TEXT,                        -- 향
  palate     TEXT,                        -- 맛
  finish     TEXT,                        -- 여운
  tags       TEXT    NOT NULL DEFAULT '[]', -- 맛 태그 JSON 배열
  review     TEXT    NOT NULL,            -- 리뷰 본문
  pairing    TEXT    NOT NULL DEFAULT '[]', -- 어울리는 안주 JSON 배열 [{id, ko}]
  photo      TEXT,                        -- 사진 R2 키 (확장자 없이, 원본 <키>.webp · 작은 이미지 <키>-sm.webp)
  published  INTEGER NOT NULL DEFAULT 1,  -- 1 공개, 0 비공개(임시 저장)
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE INDEX idx_reviews_list ON reviews (published, tasted_on);
CREATE INDEX idx_reviews_type ON reviews (published, type);

-- 관리자 로그인 실패 기록 (같은 IP에서 짧은 시간에 여러 번 틀리면 잠시 막아요)
CREATE TABLE login_attempts (
  ip TEXT    NOT NULL,
  at INTEGER NOT NULL                     -- 밀리초 타임스탬프
);
CREATE INDEX idx_login_ip ON login_attempts (ip, at);
