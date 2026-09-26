#!/usr/bin/env python3
"""images/ 아래의 png/jpg/jpeg 파일을 웹용 webp로 변환해요.

- 가장 긴 변을 최대 MAX_SIDE px로 줄이고 webp(품질 QUALITY)로 저장
- 파일 이름은 소문자로 맞춤 (Vercel은 대소문자를 구분해요)
- 변환이 끝나면 원본 파일은 삭제
- 이미 webp인 파일은 크기만 확인해서 너무 크면 다시 줄임

사용법: python3 scripts/optimize-images.py
(git pre-commit 훅에서 자동으로 실행돼요)
"""
from pathlib import Path
from PIL import Image

MAX_SIDE = 1000
QUALITY = 80
SRC_EXT = {'.png', '.jpg', '.jpeg'}

root = Path(__file__).resolve().parent.parent / 'images'
changed = []

for src in sorted(root.rglob('*')):
    ext = src.suffix.lower()
    if not src.is_file() or ext not in SRC_EXT | {'.webp'}:
        continue
    dst = src.with_name(src.stem.lower() + '.webp')
    with Image.open(src) as im:
        if ext == '.webp' and src == dst and max(im.size) <= MAX_SIDE:
            continue
        im.load()
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=QUALITY, method=6)
    if src != dst:
        src.unlink()
    changed.append(dst)

for p in changed:
    print(f'optimized {p.relative_to(root.parent)} ({p.stat().st_size // 1024} KB)')
