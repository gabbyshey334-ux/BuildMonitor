import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import twilio from 'twilio';
import {
  getWebhookPublicUrl,
  parseTwilioParams,
  validateTwilioWebhook,
} from '../utils/twilioSignature.js';

describe('twilioSignature', () => {
  it('parseTwilioParams from object', () => {
    const params = parseTwilioParams({ From: 'whatsapp:+1', Body: 'hi', NumMedia: 0 });
    assert.equal(params.From, 'whatsapp:+1');
    assert.equal(params.Body, 'hi');
  });

  it('getWebhookPublicUrl strips trailing slash', () => {
    const prev = process.env.WEBHOOK_PUBLIC_URL;
    process.env.WEBHOOK_PUBLIC_URL = 'https://example.com/webhook/';
    assert.equal(getWebhookPublicUrl(), 'https://example.com/webhook');
    if (prev === undefined) delete process.env.WEBHOOK_PUBLIC_URL;
    else process.env.WEBHOOK_PUBLIC_URL = prev;
  });

  it('rejects missing signature when fully configured', () => {
    const prev = {
      token: process.env.TWILIO_AUTH_TOKEN,
      url: process.env.WEBHOOK_PUBLIC_URL,
      skip: process.env.SKIP_TWILIO_SIGNATURE,
      nodeEnv: process.env.NODE_ENV,
    };
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
    process.env.WEBHOOK_PUBLIC_URL = 'https://example.com/api/whatsapp-webhook';
    delete process.env.SKIP_TWILIO_SIGNATURE;
    process.env.NODE_ENV = 'test';

    const result = validateTwilioWebhook({ headers: {}, body: { Body: 'test' } }, { Body: 'test' });
    assert.equal(result.ok, false);
    assert.match(result.reason, /Missing X-Twilio-Signature/);

    Object.assign(process.env, {
      TWILIO_AUTH_TOKEN: prev.token,
      WEBHOOK_PUBLIC_URL: prev.url,
      NODE_ENV: prev.nodeEnv,
    });
    if (prev.skip === undefined) delete process.env.SKIP_TWILIO_SIGNATURE;
    else process.env.SKIP_TWILIO_SIGNATURE = prev.skip;
  });

  it('accepts valid signature', () => {
    const authToken = 'test-auth-token-signing';
    const url = 'https://example.com/api/whatsapp-webhook';
    const params = { From: 'whatsapp:+15551234567', Body: 'hello' };
    const signature = twilio.getExpectedTwilioSignature(authToken, url, params);

    const prev = {
      token: process.env.TWILIO_AUTH_TOKEN,
      webhookUrl: process.env.WEBHOOK_PUBLIC_URL,
      skip: process.env.SKIP_TWILIO_SIGNATURE,
      nodeEnv: process.env.NODE_ENV,
    };
    process.env.TWILIO_AUTH_TOKEN = authToken;
    process.env.WEBHOOK_PUBLIC_URL = url;
    delete process.env.SKIP_TWILIO_SIGNATURE;
    process.env.NODE_ENV = 'test';

    const result = validateTwilioWebhook(
      { headers: { 'x-twilio-signature': signature } },
      params
    );
    assert.equal(result.ok, true);

    Object.assign(process.env, {
      TWILIO_AUTH_TOKEN: prev.token,
      WEBHOOK_PUBLIC_URL: prev.webhookUrl,
      NODE_ENV: prev.nodeEnv,
    });
    if (prev.skip === undefined) delete process.env.SKIP_TWILIO_SIGNATURE;
    else process.env.SKIP_TWILIO_SIGNATURE = prev.skip;
  });
});
