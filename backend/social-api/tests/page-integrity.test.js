import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const pagePath = fileURLToPath(new URL('creator-arena/index.html', root));
const themePath = fileURLToPath(new URL('creator-arena/social-brand-theme.css', root));
const ambientPath = fileURLToPath(new URL('ambient-motion.css', root));
const html = readFileSync(pagePath, 'utf8');
const theme = readFileSync(themePath, 'utf8');
const ambient = readFileSync(ambientPath, 'utf8');

test('every Social page DOM lookup resolves to an element in the page', () => {
  const ids = new Set([...html.matchAll(/\\bid=["']([^"']+)["']/g)].map(match => match[1]));
  const lookups = new Set([...html.matchAll(/\\$\\(["']([^"']+)["']\\)/g)].map(match => match[1]));
  const missing = [...lookups].filter(id => !ids.has(id));
  assert.deepEqual(missing, [], 'Missing DOM IDs break Social UI event handlers and login flows');
});

test('all eight supported languages contain the same authentication translation keys', () => {
  const languages = ['en', 'fa', 'ar', 'tr', 'ru', 'zh', 'es', 'pt'];
  const lines = html.split('\\n');
  const dictionaries = new Map();
  for (const language of languages) {
    const line = lines.find(value => new RegExp('^\\\\s*' + language + ':\\\\{').test(value));
    assert.ok(line, 'Missing authentication dictionary: ' + language);
    const keys = [...line.matchAll(/(?:^|[,\\{])([A-Za-z][A-Za-z0-9_]*):(?=['"])/g)].map(match => match[1]);
    dictionaries.set(language, new Set(keys));
  }
  const baseline = dictionaries.get('en');
  for (const language of languages) {
    assert.deepEqual([...dictionaries.get(language)].sort(), [...baseline].sort(), 'Translation keys differ for ' + language);
  }
  for (const key of ['changeLanguage', 'walletChanged', 'networkChanged']) {
    for (const language of languages) assert.ok(dictionaries.get(language).has(key), language + ' is missing ' + key);
  }
});

test('post cards format the server-provided creation timestamp instead of always saying now', () => {
  assert.match(html, /function formatPostTime\\(timestamp\\)/);
  assert.match(html, /formatPostTime\\(post\\.createdAt\\)/);
  assert.match(html, /new Intl\\.RelativeTimeFormat\\(lang/);
  assert.doesNotMatch(html, /date\\.textContent=t\\('timeNow'\\)/);
});

test('switching languages refreshes the authenticated dynamic view', () => {
  assert.match(html, /if\\(passwordVerified\\)\\{refreshCurrentSocialView\\(\\)\\.catch\\(showCurrentViewError\\);refreshNotificationBadge\\(\\);\\}/);
});

test('following or unfollowing from a followers/following list refreshes that open list', () => {
  assert.match(html, /const connectionsWereOpen=!\\$\\('connectionsPanel'\\)\\.hidden/);
  assert.match(html, /if\\(connectionsWereOpen&&connectionKind\\)await loadConnections\\(connectionKind\\)/);
});

test('Social logout clears the active WalletConnect session and watcher listeners', () => {
  assert.match(html, /window\\.fiWalletConnectActive&&typeof window\\.fiDisconnectWalletConnect==='function'/);
  assert.match(html, /async function clearWalletWatch\\(\\)/);
  assert.match(html, /walletChanged/);
  assert.match(html, /networkChanged/);
});

test('the Social page retains responsive dashboard assets and accessible live status regions', () => {
  assert.match(html, /name=["']viewport["']/);
  assert.match(html, /social-brand-theme\\.css/);
  assert.match(html, /ambient-motion\\.css/);
  assert.match(theme, /background-mobile\\.png/);
  assert.match(theme, /@media\\(max-width:560px\\)/);
  assert.match(theme, /@media\\(max-width:390px\\)/);
  assert.match(ambient, /fiStarDrift/);
  assert.match(html, /id=["']socialAuthStatus["'][^>]*role=["']status["'][^>]*aria-live=["']polite["']/);
});

test('Social page includes only one source of inline application JavaScript and versioned bridge compatibility file', () => {
  const inlineScripts = [...html.matchAll(/<script>/g)];
  assert.equal(inlineScripts.length, 1);
  assert.match(html, /walletconnect-bridge\\.js\\?v=/);
  assert.match(html, /social-api\\.js\\?v=/);
});
