import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE_URL = 'https://demircraftco.github.io';

// URLs that shipped apps open. Changing one of these breaks a published build.
const APP_URLS = [
  `${SITE_URL}/ironbuild/privacy`,
  `${SITE_URL}/ironbuild/support`,
];

const BILINGUAL_PAGES = ['ironbuild/privacy/index.html', 'ironbuild/support/index.html'];

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.') || name === 'node_modules') return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

const pages = htmlFiles(ROOT).map((path) => ({
  name: relative(ROOT, path),
  html: readFileSync(path, 'utf8'),
}));

test('the landing page and every page an app links to exist', () => {
  assert.ok(existsSync(join(ROOT, 'index.html')));
  for (const url of APP_URLS) {
    assert.ok(url.startsWith(`${SITE_URL}/`), url);
    const file = join(ROOT, url.slice(SITE_URL.length + 1), 'index.html');
    assert.ok(existsSync(file), `${url} has no ${relative(ROOT, file)}`);
  }
});

const SUPPORT_EMAIL = 'demircraftco@gmail.com';

test('every support page offers the support e-mail as a mailto link', () => {
  const support = pages.filter((p) => p.name.includes('support'));
  assert.ok(support.length > 0);
  for (const { name, html } of support) assert.match(html, /href="mailto:demircraftco@gmail\.com"/, name);
});

for (const { name, html } of pages) {
  test(`${name} is a well-formed, self-contained public page`, () => {
    assert.match(html, /<html lang="[a-z]{2}"/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.doesNotMatch(html, /http:\/\//, 'insecure link');
    const emails = [...html.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((m) => m[0]);
    assert.deepStrictEqual(emails.filter((e) => e !== SUPPORT_EMAIL), [], 'only the public support address may appear');
    assert.doesNotMatch(html, /\/Users\//, 'machine path');
    assert.doesNotMatch(html, /<script/i, 'scripts are not allowed');
    for (const [, href] of html.matchAll(/<link[^>]+href="([^"]+)"/g)) {
      assert.ok(href.startsWith('/'), `external resource: ${href}`);
    }
  });
}

for (const name of BILINGUAL_PAGES) {
  test(`${name} carries both English and Turkish`, () => {
    const html = readFileSync(join(ROOT, name), 'utf8');
    assert.match(html, /<section lang="en"/);
    assert.match(html, /<section lang="tr"/);
  });
}
