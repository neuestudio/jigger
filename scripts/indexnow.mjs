// IndexNow: 배포 후 바뀐 페이지 주소를 네이버 · 빙(Bing 등 IndexNow 참여 검색엔진)에 바로 알려요.
// 사용법 (npx wrangler deploy 다음에 실행):
//   node scripts/indexnow.mjs          지난번 알린 커밋 이후 바뀐 페이지만 (처음이면 사이트맵 전체)
//   node scripts/indexnow.mjs --all    사이트맵 전체
//   node scripts/indexnow.mjs --dry    보내지 않고 보낼 주소만 출력
// 키 파일은 루트의 <키>.txt 예요 (내용 = 키). 지난번 알린 커밋은 .indexnow-last에 저장해요 (저장소에 안 올라가요).
import {readFileSync, writeFileSync, existsSync, readdirSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'jiggerbar.com';
const SITE = `https://${HOST}`;
const ENDPOINTS = ['https://searchadvisor.naver.com/indexnow', 'https://api.indexnow.org/indexnow'];
const STATE = join(ROOT, '.indexnow-last');
const args = process.argv.slice(2);

const keyFile = readdirSync(ROOT).find(f => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('루트에 IndexNow 키 파일(<키>.txt)이 없어요');
const key = keyFile.slice(0, -4);

const git = cmd => execSync(`git ${cmd}`, {cwd:ROOT, encoding:'utf8'}).trim();
const sitemap = [...readFileSync(join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const head = git('rev-parse HEAD');
const last = !args.includes('--all') && existsSync(STATE) ? readFileSync(STATE, 'utf8').trim() : null;

let urls = sitemap;
if (last) {
  // 바뀐 index.html → 페이지 주소 (index.html → /, cocktails/mojito/index.html → /cocktails/mojito/)
  const changed = git(`diff --name-only ${last} ${head}`).split('\n').filter(f => /(^|\/)index\.html$/.test(f))
    .map(f => `${SITE}/${f.replace(/index\.html$/, '')}`);
  urls = sitemap.filter(u => changed.includes(u));
}

if (!urls.length) { console.log('IndexNow: 지난번 이후 바뀐 페이지가 없어요'); process.exit(0); }
console.log(`IndexNow: ${urls.length}개 주소${last ? ` (${last.slice(0, 7)} 이후 바뀐 페이지)` : ' (사이트맵 전체)'}`);
if (args.includes('--dry')) { console.log(urls.join('\n')); process.exit(0); }

const body = JSON.stringify({host:HOST, key, keyLocation:`${SITE}/${keyFile}`, urlList:urls.slice(0, 10000)});
let naverOK = false;
for (const ep of ENDPOINTS) {
  try {
    const res = await fetch(ep, {method:'POST', headers:{'Content-Type':'application/json; charset=utf-8'}, body});
    const ok = res.status === 200 || res.status === 202;
    if (ep.includes('naver')) naverOK = ok;
    console.log(`  ${new URL(ep).host}: ${res.status}${ok ? ' 접수됨' : ` ${(await res.text()).slice(0, 200)}`}`);
  } catch (e) {
    console.log(`  ${new URL(ep).host}: 실패 ${e.message}`);
  }
}
if (naverOK) writeFileSync(STATE, head + '\n');
