import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stripHtml, sanitizeString, sanitizeEmail } from '../utils/sanitize.js';
import { roleFromProjectRow, canWriteProject, ROLES } from '../utils/rbac.js';
import { getAllowedOrigins } from '../utils/cors.js';

describe('sanitize', () => {
  it('strips HTML tags', () => {
    assert.equal(stripHtml('<b>hello</b>'), 'hello');
  });

  it('truncates long strings', () => {
    assert.equal(sanitizeString('a'.repeat(3000), 100).length, 100);
  });

  it('validates email', () => {
    assert.equal(sanitizeEmail('user@example.com'), 'user@example.com');
    assert.equal(sanitizeEmail('not-an-email'), null);
  });
});

describe('rbac', () => {
  const project = { id: 'p1', user_id: 'owner-1', manager_id: 'mgr-1' };

  it('owner role for project user_id', () => {
    assert.equal(roleFromProjectRow(project, 'owner-1', []), ROLES.OWNER);
  });

  it('manager role', () => {
    assert.equal(roleFromProjectRow(project, 'mgr-1', []), ROLES.MANAGER);
  });

  it('linked profile treated as owner', () => {
    assert.equal(roleFromProjectRow(project, 'auth-uid', ['owner-1']), ROLES.OWNER);
  });

  it('canWriteProject for owner and manager', () => {
    assert.equal(canWriteProject(ROLES.OWNER), true);
    assert.equal(canWriteProject(ROLES.MANAGER), true);
    assert.equal(canWriteProject(ROLES.NONE), false);
  });
});

describe('cors', () => {
  it('includes default origins', () => {
    const origins = getAllowedOrigins();
    assert.ok(origins.includes('http://localhost:5173'));
  });
});
