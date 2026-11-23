import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const pagePath = fileURLToPath(new URL('creator-arena/index.html', root));
const qaPagePath = fileURLToPath(new URL('social-qa/index.html', root));
const themePath = fileURLToPath(new URL('creator-arena/social-brand-theme.css', root));
const ambientPath = fileURLToPath(new URL('ambient-motion.css', root));
const html = readFileSync(pagePath, 'utf8');
const qaHtml = readFileSync(qaPagePath, 'utf8');
const theme = readFileSync(themePath, 'utf8');
const ambient = readFileSync(ambientPath, 'utf8');

test('every Social page DOM lookup resolves to an element in the page', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const lookups = new Set([...html.matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1]));
  const missing = [...lookups].filter(id => !ids.has(id));
  assert.deepEqual(missing, [], 'Missing DOM IDs break Social UI event handlers and login flows');
});

test('all eight supported languages contain matching authentication keys', () => {
  const languages = ['en', 'fa', 'ar', 'tr', 'ru', 'zh', 'es', 'pt'];
  const lines = html.split('\n');
  const dictionaries = new Map();
  for (const language of languages) {
    const line = lines.find(value => value.trimStart().startsWith(language + ':{'));
    assert.ok(line, 'Missing authentication dictionary: ' + language);
    const body = line.slice(line.indexOf('{') + 1);
    const keys = [...body.matchAll(/(?:^|,)([A-Za-z][A-Za-z0-9_]*):/g)].map(match => match[1]);
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

test('post cards use each post creation timestamp and localized relative time', () => {
  assert.ok(html.includes('function formatPostTime(timestamp)'));
  assert.ok(html.includes('formatPostTime(post.createdAt)'));
  assert.ok(html.includes('new Intl.RelativeTimeFormat(lang'));
  assert.ok(!html.includes("date.textContent=t('timeNow')"));
});

test('switching languages refreshes the authenticated dynamic view', () => {
  assert.ok(html.includes('if(passwordVerified){refreshCurrentSocialView().catch(showCurrentViewError);refreshNotificationBadge();}'));
});

test('following or unfollowing from a followers/following list refreshes the open list', () => {
  assert.ok(html.includes("const connectionsWereOpen=!$('connectionsPanel').hidden"));
  assert.ok(html.includes('if(connectionsWereOpen&&connectionKind)await loadConnections(connectionKind)'));
});

test('own posts do not display a repost action that the API rejects', () => {
  assert.ok(html.includes('if(!post.creator?.wallet||post.creator.wallet.toLowerCase()!==wallet.toLowerCase())'));
});

test('Social logout clears WalletConnect session and account/network listeners', () => {
  assert.ok(html.includes("window.fiWalletConnectActive&&typeof window.fiDisconnectWalletConnect==='function'"));
  assert.ok(html.includes('async function clearWalletWatch()'));
  assert.ok(html.includes('walletChanged'));
  assert.ok(html.includes('networkChanged'));
});

test('the Social page retains responsive dashboard assets and accessible live status regions', () => {
  assert.ok(html.includes('name="viewport"'));
  assert.ok(html.includes('social-brand-theme.css'));
  assert.ok(html.includes('ambient-motion.css'));
  assert.ok(theme.includes('background-mobile.png'));
  assert.ok(theme.includes('@media(max-width:560px)'));
  assert.ok(theme.includes('@media(max-width:390px)'));
  assert.ok(ambient.includes('fiStarDrift'));
  assert.ok(html.includes('id="socialAuthStatus"') && html.includes('role="status"') && html.includes('aria-live="polite"'));
});

test('the isolated QA page uses synthetic mock APIs and cannot connect to live wallet or API', () => {
  assert.ok(qaHtml.includes("location.hostname==='fly-social-qa.pages.dev'"));
  assert.ok(qaHtml.includes('async function qaApi(path,options)'));
  assert.ok(qaHtml.includes('if(QA_MODE)return qaApi(path,options)'));
  assert.ok(qaHtml.includes('id="qaTestLogin"'));
  assert.ok(qaHtml.includes('MOCK DATA ONLY'));
  assert.ok(!qaHtml.includes('walletconnect-bridge.js'));
  assert.ok(!qaHtml.includes('social-api.js?v='));
});

test('both Social entry points retain one inline application script and versioned bridge compatibility on the live page', () => {
  assert.equal([...html.matchAll(/<script>/g)].length, 1);
  assert.ok(html.includes('walletconnect-bridge.js?v='));
  assert.ok(html.includes('social-api.js?v='));
  assert.equal([...qaHtml.matchAll(/<script>/g)].length, 1);
});
