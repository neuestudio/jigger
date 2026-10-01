#!/usr/bin/env python3
"""images/ 아래의 png/jpg/jpeg 파일을 웹용 webp로 변환해요.

- 가장 긴 변을 최대 MAX_SIDE px로 줄이고 webp(품질 QUALITY)로 저장
- 파일 이름은 소문자로 맞춤 (Vercel은 대소문자를 구분해요)
- 변환이 끝나면 원본 파일은 삭제
- 이미 webp인 파일은 크기만 확인해서 너무 크면 다시 줄임
- 목록 카드용 작은 이미지(가장 긴 변 SM_SIDE px)를 같은 폴더의 sm/ 에 만들어요 (없거나 원본보다 오래됐을 때)

사용법: python3 scripts/optimize-images.py
(git pre-commit 훅에서 자동으로 실행돼요)
"""
from pathlib import Path
from PIL import Image

MAX_SIDE = 1000
QUALITY = 80
SM_SIDE = 640
SM_DIR = 'sm'
SRC_EXT = {'.png', '.jpg', '.jpeg'}

root = Path(__file__).resolve().parent.parent / 'images'
changed = []

for src in sorted(root.rglob('*')):
    ext = src.suffix.lower()
    if src.parent.name == SM_DIR:
        continue
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

# 목록 카드용 작은 이미지
for src in sorted(root.rglob('*.webp')):
    if src.parent.name == SM_DIR:
        continue
    sm = src.parent / SM_DIR / src.name
    if sm.exists() and sm.stat().st_mtime >= src.stat().st_mtime:
        continue
    sm.parent.mkdir(exist_ok=True)
    with Image.open(src) as im:
        im.load()
        im.thumbnail((SM_SIDE, SM_SIDE), Image.LANCZOS)
        im.save(sm, 'WEBP', quality=QUALITY, method=6)
    changed.append(sm)

# 원본이 지워진 작은 이미지 정리
for sm in sorted(root.rglob(f'{SM_DIR}/*.webp')):
    if not (sm.parent.parent / sm.name).exists():
        sm.unlink()
        print(f'removed {sm.relative_to(root.parent)}')

for p in changed:
    print(f'optimized {p.relative_to(root.parent)} ({p.stat().st_size // 1024} KB)')
