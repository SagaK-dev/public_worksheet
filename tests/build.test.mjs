import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function sandbox(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'worksheet-site-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of ['scripts', 'assets', 'vendor', 'materials', 'posts', 'site.json']) {
    await cp(path.join(root, name), path.join(dir, name), { recursive: true });
  }
  return dir;
}

function build(dir) {
  return spawnSync(process.execPath, [path.join(dir, 'scripts/build.mjs')], { encoding: 'utf8' });
}

test('materials and posts build into portable links with escaped content', async (t) => {
  const dir = await sandbox(t);
  await mkdir(path.join(dir, 'materials', 'all'));
  await writeFile(path.join(dir, 'materials', 'all', '日本語 & 1.PDF'), 'pdf data');
  await writeFile(path.join(dir, 'materials', '数学', '二次関数.docx'), 'doc data');
  await writeFile(path.join(dir, 'posts', '2026-11-15-test.md'), [
    '# 学習 <script>タイトル</script>', '',
    '[公式](https://example.org/?a=1&b=2)', '',
    '[危険](java&#x73;cript:alert(1))', '',
    '<img src=x onerror=alert(1)>'
  ].join('\n'));
  const result = build(dir);
  assert.equal(result.status, 0, result.stderr);
  const home = await readFile(path.join(dir, 'dist', 'index.html'), 'utf8');
  assert.match(home, /data-filter-all/);
  assert.match(home, /data-filter-category="all"/);
  assert.match(home, /materials\/all\/%E6%97%A5%E6%9C%AC%E8%AA%9E%20%26%201\.PDF/);
  assert.equal(await readFile(path.join(dir, 'dist', 'materials', 'all', '日本語 & 1.PDF'), 'utf8'), 'pdf data');
  const article = await readFile(path.join(dir, 'dist', 'blog', '2026-11-15-test', 'index.html'), 'utf8');
  assert.match(article, /href="\.\.\/\.\.\/assets\/style\.css"/);
  assert.match(article, /学習 &lt;script&gt;タイトル&lt;\/script&gt;/);
  assert.match(article, /href="https:\/\/example\.org\/\?a=1&amp;b=2"/);
  assert.doesNotMatch(article, /href="java&#x73;cript:/);
  assert.match(article, /&lt;img src=x onerror=alert\(1\)&gt;/);
  await assert.rejects(readFile(path.join(dir, 'dist', 'materials', 'README.md')));
});

test('invalid article dates fail before replacing the previous build', async (t) => {
  const dir = await sandbox(t);
  assert.equal(build(dir).status, 0);
  const before = await readFile(path.join(dir, 'dist', 'index.html'), 'utf8');
  await writeFile(path.join(dir, 'posts', '2026-02-30-invalid.md'), '# タイトル\n');
  const result = build(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /日付が正しくありません/);
  assert.equal(await readFile(path.join(dir, 'dist', 'index.html'), 'utf8'), before);
});

test('duplicate article URLs fail instead of overwriting an article', async (t) => {
  const dir = await sandbox(t);
  await writeFile(path.join(dir, 'posts', '2026-11-15-same.md'), '# 最初\n');
  await writeFile(path.join(dir, 'posts', '2026-11-15-same.MD'), '# 次の記事\n');
  const result = build(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /同じ記事URL/);
});
