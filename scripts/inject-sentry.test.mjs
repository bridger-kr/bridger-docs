import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { injectSentryIntoHtml } from './inject-sentry.mjs';

describe('injectSentryIntoHtml', () => {
  it('returns the original HTML when Sentry is disabled', () => {
    const html = '<html><head><title>DATA BRIDGE</title></head><body></body></html>';

    assert.equal(injectSentryIntoHtml(html, { enabled: false }), html);
  });

  it('injects the Sentry browser loader before the closing head tag', () => {
    const html = '<html><head><title>DATA BRIDGE</title></head><body></body></html>';
    const output = injectSentryIntoHtml(html, {
      enabled: true,
      dsn: 'https://public@example.com/12',
      environment: 'production',
      release: 'abc123',
      service: 'datari-docs',
      sdkUrl: 'https://browser.sentry-cdn.com/10.56.0/bundle.tracing.min.js',
      tracesSampleRate: 0.02,
    });

    assert.match(output, /browser\.sentry-cdn\.com\/10\.56\.0\/bundle\.tracing\.min\.js/);
    assert.match(output, /Sentry\.init/);
    assert.match(output, /datari-docs/);
    assert.ok(output.indexOf('Sentry.init') < output.indexOf('</head>'));
  });
});
