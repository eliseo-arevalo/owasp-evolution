import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { umamiScript } from '../scripts/analytics.js';

const configured = {
  UMAMI_SCRIPT_URL: 'https://analytics.example.com/script.js',
  UMAMI_WEBSITE_ID: '00000000-0000-0000-0000-000000000000',
};

async function htmlFiles(dir, prefix = '') {
  const files = new Map();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const [name, html] of await htmlFiles(path, `${prefix}${entry.name}/`)) files.set(name, html);
    } else if (entry.name.endsWith('.html')) files.set(prefix + entry.name, await readFile(path, 'utf8'));
  }
  return files;
}

test('build injects Umami exactly once in every head only when configured', async t => {
  const root = await mkdtemp(join(tmpdir(), 'owasp-analytics-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = { ...process.env };
  for (const key of ['UMAMI_SCRIPT_URL', 'UMAMI_WEBSITE_ID', 'UMAMI_DOMAINS']) delete env[key];
  async function build(name, settings) {
    const output = join(root, name);
    execFileSync(process.execPath, ['scripts/build.js'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...env, ...settings, BUILD_OUTPUT_DIR: output },
      stdio: 'pipe',
    });
    return htmlFiles(output);
  }
  const baseline = await build('unset', {});
  for (const name of ['index.html', 'es/index.html', 'en/index.html', '404.html']) assert.ok(baseline.has(name));
  assert.ok(baseline.size > 100, 'includes prerendered category pages');
  for (const html of baseline.values()) assert.doesNotMatch(html, /umami|data-website-id/i);

  for (const [name, settings] of [
    ['configured', configured],
    ['domains', { ...configured, UMAMI_DOMAINS: ' example.com, es.example.com, ' }],
    ['url-only', { UMAMI_SCRIPT_URL: configured.UMAMI_SCRIPT_URL }],
    ['id-only', { UMAMI_WEBSITE_ID: configured.UMAMI_WEBSITE_ID }],
    ['blank', { ...configured, UMAMI_WEBSITE_ID: '   ' }],
  ]) {
    const files = await build(name, settings);
    assert.deepEqual([...files.keys()], [...baseline.keys()]);
    const script = name === 'configured' || name === 'domains'
      ? `<script defer src="${configured.UMAMI_SCRIPT_URL}" data-website-id="${configured.UMAMI_WEBSITE_ID}"${name === 'domains' ? ' data-domains="example.com,es.example.com"' : ''}></script>`
      : '';
    for (const [path, html] of files) {
      if (script) {
        assert.equal(html.split(script).length - 1, 1, path);
        assert.ok(html.indexOf(script) > html.indexOf('<head>'), path);
        assert.ok(html.indexOf(script) < html.indexOf('</head>'), path);
      }
      let withoutAnalytics = script ? html.replace(script, '') : html;
      if (script && !baseline.get(path).includes('<head>')) {
        withoutAnalytics = withoutAnalytics.replace('<head>', '').replace('</head>', '');
      }
      assert.equal(withoutAnalytics, baseline.get(path), path);
    }
  }
  await assert.rejects(build('invalid', { ...configured, UMAMI_SCRIPT_URL: 'http://analytics.example.com/script.js' }), /must be a valid HTTPS URL/);
});

test('analytics escapes every attribute and rejects invalid or non-HTTPS URLs', () => {
  assert.equal(umamiScript({
    UMAMI_SCRIPT_URL: 'https://analytics.example.com/script.js?a=1&b="<>\'',
    UMAMI_WEBSITE_ID: '"<>&\'',
    UMAMI_DOMAINS: '"<>&\'',
  }), '<script defer src="https://analytics.example.com/script.js?a=1&amp;b=&quot;&lt;&gt;&#39;" data-website-id="&quot;&lt;&gt;&amp;&#39;" data-domains="&quot;&lt;&gt;&amp;&#39;"></script>');
  for (const url of ['invalid', '//analytics.example.com/script.js', 'javascript:alert(1)', 'http://analytics.example.com/script.js']) {
    assert.throws(() => umamiScript({ ...configured, UMAMI_SCRIPT_URL: url }), /must be a valid HTTPS URL/);
  }
  assert.doesNotMatch(umamiScript({ ...configured, UMAMI_DOMAINS: ' , ' }), /data-domains/);
});
