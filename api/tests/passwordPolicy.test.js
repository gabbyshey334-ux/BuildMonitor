import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validatePassword,
  isPasswordValid,
  getPasswordChecks,
  PASSWORD_MIN_LENGTH,
} from "../../shared/passwordPolicy.js";

describe("passwordPolicy", () => {
  it("requires minimum length", () => {
    const result = validatePassword("Ab1!xyz");
    assert.equal(result.valid, false);
    assert.match(result.message, /8 characters/);
  });

  it("requires lowercase, uppercase, digit, and symbol", () => {
    assert.equal(isPasswordValid("Password1!"), true);
    assert.equal(isPasswordValid("password1!"), false);
    assert.equal(isPasswordValid("PASSWORD1!"), false);
    assert.equal(isPasswordValid("Password!"), false);
    assert.equal(isPasswordValid("Password1"), false);
  });

  it("reports missing requirements in message", () => {
    const result = validatePassword("short");
    assert.equal(result.valid, false);
    assert.ok(result.message);
  });

  it("getPasswordChecks tracks each rule", () => {
    const checks = getPasswordChecks("Aa1!bbbb");
    assert.equal(checks.length, true);
    assert.equal(checks.lowercase, true);
    assert.equal(checks.uppercase, true);
    assert.equal(checks.digit, true);
    assert.equal(checks.symbol, true);
    assert.equal(PASSWORD_MIN_LENGTH, 8);
  });
});
