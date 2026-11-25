import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOwnerProfileBearerToken } from '../src/owner-profile.js';

test('Owner Profile session parser accepts standard Bearer authorization headers', () => {
  assert.equal(extractOwnerProfileBearerToken('Bearer profile-session-token'), 'profile-session-token');
  assert.equal(extractOwnerProfileBearerToken('bearer profile-session-token'), 'profile-session-token');
  assert.equal(extractOwnerProfileBearerToken('Bearer    profile-session-token  '), 'profile-session-token');
});

test('Owner Profile session parser rejects missing or malformed authorization headers', () => {
  assert.equal(extractOwnerProfileBearerToken(null), '');
  assert.equal(extractOwnerProfileBearerToken(''), '');
  assert.equal(extractOwnerProfileBearerToken('profile-session-token'), '');
  assert.equal(extractOwnerProfileBearerToken('Basic profile-session-token'), '');
  assert.equal(extractOwnerProfileBearerToken('Bearer'), '');
});
