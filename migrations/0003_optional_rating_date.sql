-- 리뷰의 평점 · 마신 날을 비워 둘 수 있게 해요 (예전 기록을 옮길 때 모르는 값이 있어서).
-- 평점이 없는 리뷰는 평균 계산에서 빠져요. SQLite는 NOT NULL을 바로 못 풀어서 표를 새로 만들어 옮겨요.

CREATE TABLE reviews_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  drink_id   INTEGER NOT NULL REFERENCES drinks (id) ON DELETE CASCADE,
  nickname   TEXT    NOT NULL,
  is_admin   INTEGER NOT NULL DEFAULT 0,
  rating     REAL,                        -- 0.5 ~ 5 (0.5 단위), 없으면 NULL
  tasted_on  TEXT,                        -- YYYY-MM-DD, 모르면 NULL
  nose       TEXT    NOT NULL DEFAULT '[]',
  palate     TEXT    NOT NULL DEFAULT '[]',
  finish     TEXT    NOT NULL DEFAULT '[]',
  review     TEXT    NOT NULL,
  pairing    TEXT    NOT NULL DEFAULT '[]',
  status     TEXT    NOT NULL DEFAULT 'published',
  edit_hash  TEXT,
  ip_hash    TEXT,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
INSERT INTO reviews_new SELECT id, drink_id, nickname, is_admin, rating, tasted_on, nose, palate, finish, review, pairing, status, edit_hash, ip_hash, created_at, updated_at FROM reviews;
DROP TABLE reviews;
ALTER TABLE reviews_new RENAME TO reviews;
CREATE INDEX idx_reviews_drink ON reviews (drink_id, status);
CREATE INDEX idx_reviews_nick ON reviews (nickname, status);
CREATE INDEX idx_reviews_ip ON reviews (ip_hash, created_at);
