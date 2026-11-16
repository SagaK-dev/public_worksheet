import { readdir, readFile, writeFile, rm, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from '../vendor/marked.esm.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const config = JSON.parse(await readFile(path.join(root, 'site.json'), 'utf8'));
for (const key of ['name', 'tagline', 'description', 'aboutTitle', 'aboutText']) {
  if (typeof config[key] !== 'string' || !config[key].trim()) {
    throw new Error(`site.json の ${key} は空でない文字列にしてください。`);
  }
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const withBreaks = (value) => escapeHtml(value).replace(/\r?\n/g, '<br>');
const encodePath = (value) => value.split('/').map(encodeURIComponent).join('/');
const formats = new Map([
  ['.pdf', 'PDF'], ['.docx', 'Word'], ['.doc', 'Word'],
  ['.pptx', 'PowerPoint'], ['.ppt', 'PowerPoint'],
  ['.xlsx', 'Excel'], ['.xls', 'Excel'], ['.txt', 'テキスト'],
  ['.zip', 'ZIP'], ['.png', 'PNG'], ['.jpg', 'JPEG'], ['.jpeg', 'JPEG']
]);

async function walk(directory, relative = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), rel));
    else if (entry.isFile()) files.push(rel);
  }
  return files;
}

const collator = new Intl.Collator('ja', { numeric: true });
const materialFiles = await walk(path.join(root, 'materials'));
const materials = materialFiles.flatMap((relative) => {
  const extension = path.posix.extname(relative).toLowerCase();
  if (!formats.has(extension)) return [];
  const parts = relative.split('/');
  const filename = parts.at(-1);
  return [{
    relative,
    title: filename.slice(0, filename.length - extension.length).replaceAll('_', ' '),
    category: parts.length > 1 ? parts[0] : 'その他',
    format: formats.get(extension),
    extension
  }];
}).sort((a, b) => collator.compare(a.category, b.category) || collator.compare(a.title, b.title));

function safeUrl(url) {
  const compact = String(url).replace(/[\u0000-\u0020\u007f]+/g, '');
  // Reject HTML character references before a path/query. A browser decodes
  // these in href attributes and could turn an obfuscated value into a scheme.
  if (/&(?:#(?:x[0-9a-f]+|[0-9]+);?|[a-z][a-z0-9]+;)/i.test(compact.split(/[/?]/, 1)[0])) return false;
  if (/^(?:javascript|vbscript|data):/i.test(compact)) return false;
  const match = compact.match(/^([a-z][a-z0-9+.-]*):/i);
  return !match || /^(https?|mailto|tel)$/i.test(match[1]);
}
const renderer = new marked.Renderer();
const urlAttribute = (value) => escapeHtml(String(value).replace(/&amp;/gi, '&'));
renderer.html = ({ text }) => escapeHtml(text);
renderer.link = function (token) {
  const label = this.parser.parseInline(token.tokens);
  if (!safeUrl(token.href)) return label;
  const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
  return `<a href="${urlAttribute(token.href)}"${title}>${label}</a>`;
};
renderer.image = function (token) {
  const alt = escapeHtml(token.text ?? '');
  if (!safeUrl(token.href)) return alt;
  const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
  return `<img src="${urlAttribute(token.href)}" alt="${alt}"${title}>`;
};

const postDir = path.join(root, 'posts');
const postFiles = (await readdir(postDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'));
const posts = [];
for (const entry of postFiles) {
  const match = entry.name.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/i);
  if (!match) throw new Error(`記事のファイル名を YYYY-MM-DD-名前.md の形式にしてください: ${entry.name}`);
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error(`記事のファイル名の日付が正しくありません: ${entry.name}`);
  }
  const source = (await readFile(path.join(postDir, entry.name), 'utf8')).replace(/^\uFEFF/, '');
  const heading = source.match(/^\s*#\s+(.+?)\s*(?:\r?\n|$)/);
  const title = heading ? heading[1].replace(/\s+#+\s*$/, '') : match[4].replaceAll('-', ' ');
  const body = heading ? source.slice(heading[0].length) : source;
  const firstParagraph = marked.lexer(body).find((token) => token.type === 'paragraph');
  const summary = firstParagraph ? firstParagraph.text
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 110) : '';
  const slug = entry.name.slice(0, -3);
  if (posts.some((post) => post.slug === slug)) {
    throw new Error(`同じ記事URLになるファイルがあります: ${entry.name}`);
  }
  posts.push({ title, date, slug, summary, content: marked.parse(body, { renderer }) });
}
posts.sort((a, b) => b.date.localeCompare(a.date) || collator.compare(a.slug, b.slug));

function layout({ prefix, title, description, body }) {
  const pageTitle = title ? `${title} | ${config.name}` : config.name;
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description || config.description)}">
  <meta name="theme-color" content="#ffffff">
  <title>${escapeHtml(pageTitle)}</title>
  <link rel="stylesheet" href="${prefix}assets/style.css">
  <script src="${prefix}assets/app.js" defer></script>
</head>
<body>
<a class="skip-link" href="#main">本文へ移動</a>
<header class="site-header"><div class="header-inner wrap">
  <a class="brand" href="${prefix}index.html" aria-label="${escapeHtml(config.name)} トップページ">${escapeHtml(config.name)}</a>
  <nav class="main-nav" aria-label="メインナビゲーション">
    <a href="${prefix}index.html#about">このサイトについて</a>
    <a href="${prefix}index.html#materials">プリント</a>
    <a href="${prefix}blog/index.html">ブログ</a>
  </nav>
  <a class="header-cta" href="${prefix}index.html#materials">プリントを見る</a>
</div></header>
${body}
<footer class="site-footer"><div class="wrap footer-inner">
  <div><a class="footer-brand" href="${prefix}index.html">${escapeHtml(config.name)}</a><p>${escapeHtml(config.description)}</p></div>
  <nav class="footer-links" aria-label="フッターナビゲーション"><a href="${prefix}index.html#materials">プリント</a><a href="${prefix}blog/index.html">ブログ</a><a href="${prefix}index.html#top">ページの先頭へ</a></nav>
</div><div class="wrap footer-bottom">© ${new Date().getUTCFullYear()} ${escapeHtml(config.name)}</div></footer>
</body></html>`;
}

function postCard(post, prefix = '') {
  const url = `${prefix}blog/${encodePath(post.slug)}/index.html`;
  return `<article class="journal-card"><a class="journal-link" href="${url}">
  <div class="journal-meta"><time datetime="${post.date}">${post.date.replaceAll('-', '.')}</time><span>記事</span></div>
  <h3>${escapeHtml(post.title)}</h3>${post.summary ? `<p>${escapeHtml(post.summary)}${post.summary.length >= 110 ? '…' : ''}</p>` : ''}
  <span class="journal-read">記事を読む</span></a></article>`;
}

const categories = [...new Set(materials.map((item) => item.category))].sort(collator.compare);
const categoryButtons = categories.map((category) => `<button class="filter-chip" type="button" data-filter-category="${escapeHtml(category)}" aria-pressed="false">${escapeHtml(category)}</button>`).join('\n');
const materialCards = materials.map((item) => {
  const href = `materials/${encodePath(item.relative)}`;
  return `<article class="material-card" data-material data-category="${escapeHtml(item.category)}" data-search="${escapeHtml(`${item.title} ${item.category} ${item.format}`)}">
  <div class="material-content"><div class="material-labels"><span>${escapeHtml(item.category)}</span><span>${escapeHtml(item.format)}</span></div>
    <h3>${escapeHtml(item.title)}</h3></div>
  <a class="material-open" href="${href}" ${item.extension === '.pdf' ? 'target="_blank" rel="noopener"' : 'download'} aria-label="${escapeHtml(item.title)}を${item.extension === '.pdf' ? '新しいタブで開く' : 'ダウンロード'}">${item.extension === '.pdf' ? '開く' : '保存'}</a>
</article>`;
}).join('\n');
const materialEmpty = materials.length === 0
  ? '<div class="empty-state"><h3>プリントを準備中です</h3><p>公開まで、もうしばらくお待ちください。</p></div>'
  : `<div class="material-list" id="material-list">${materialCards}</div><p class="no-results" hidden>条件に合うプリントはありませんでした。検索語やカテゴリを変えてお試しください。</p>`;
const recentPosts = posts.length ? posts.slice(0, 3).map((post) => postCard(post)).join('') : '<div class="empty-state"><h3>記事を準備中です</h3><p>公開まで、もうしばらくお待ちください。</p></div>';
const body = `<main id="main">
<section class="hero wrap" id="top">
  <p class="eyebrow">学習プリントとブログ</p>
  <h1>${withBreaks(config.tagline)}</h1><p class="hero-description">${withBreaks(config.description)}</p>
  <a class="primary-button" href="#materials">プリントを見る</a>
</section>
<section class="about-section wrap" id="about"><div class="section-intro"><span class="section-number">01</span><h2>${escapeHtml(config.aboutTitle)}</h2></div><div class="about-copy"><p>${withBreaks(config.aboutText)}</p></div></section>
<section class="materials-section" id="materials"><div class="wrap">
  <div class="section-heading"><div><span class="section-number">02</span><h2>プリントを探す</h2><p>必要な資料をカテゴリやキーワードから探せます。</p></div><span class="section-count">${materials.length}件</span></div>
  <div class="filter-area" data-filter-controls hidden><div class="filter-row"><span class="filter-label">カテゴリ</span><div class="filter-chips"><button class="filter-chip is-active" type="button" data-filter-all aria-pressed="true">すべて</button>${categoryButtons}</div></div>
  <label class="search-field" for="material-search"><span>キーワード</span><input id="material-search" type="search" placeholder="資料名を入力" autocomplete="off"></label></div>
  ${materialEmpty}<p class="result-count" aria-live="polite">${materials.length}件の資料</p>
</div></section>
<section class="journal-section wrap" id="journal"><div class="section-heading"><div><span class="section-number">03</span><h2>ブログ</h2><p>プリントや学習についての記事です。</p></div><a class="text-link" href="blog/index.html">記事をすべて見る</a></div>
  <div class="journal-grid">${recentPosts}</div></section>
</main>`;

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
// Copy only supported materials; README and other non-public working files stay out of the site.
for (const item of materials) {
  const destination = path.join(output, 'materials', ...item.relative.split('/'));
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, 'materials', ...item.relative.split('/')), destination);
}
await writeFile(path.join(output, 'index.html'), layout({ prefix: '', body }), 'utf8');
const blogListing = posts.length ? posts.map((post) => postCard(post, '../')).join('') : '<div class="empty-state compact"><h3>記事を準備中です</h3><p>公開まで、もうしばらくお待ちください。</p></div>';
await mkdir(path.join(output, 'blog'), { recursive: true });
await writeFile(path.join(output, 'blog', 'index.html'), layout({ prefix: '../', title: 'ブログ', body: `<main id="main" class="page-main wrap"><p class="breadcrumb"><a href="../index.html">ホーム</a> / ブログ</p><div class="page-heading"><span class="section-number">ブログ</span><h1>記事一覧</h1><p>プリントや学習についての記事です。</p></div><div class="journal-grid archive-grid">${blogListing}</div></main>` }), 'utf8');
for (const post of posts) {
  const directory = path.join(output, 'blog', post.slug);
  await mkdir(directory, { recursive: true });
  const article = `<main id="main" class="article-main wrap"><p class="breadcrumb"><a href="../../index.html">ホーム</a> / <a href="../index.html">ブログ</a> / 記事</p><article class="article"><header class="article-header"><span class="section-number">ブログ</span><time datetime="${post.date}">${post.date.replaceAll('-', '.')}</time><h1>${escapeHtml(post.title)}</h1></header><div class="article-body">${post.content}</div><div class="article-back"><a class="text-link" href="../index.html">記事一覧に戻る</a></div></article></main>`;
  await writeFile(path.join(directory, 'index.html'), layout({ prefix: '../../', title: post.title, description: post.summary, body: article }), 'utf8');
}
console.log(`サイトを作成しました: 教材 ${materials.length} 件、ブログ ${posts.length} 件 (dist/)`);
