import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import {
  renderMaskedDisplay,
  renderOriginalDisplay,
} from '../src/html-renderer.js';
import type { Position } from '../src/position.js';

describe('html-renderer', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    // @ts-expect-error - Setting global for testing
    global.document = document;
  });

  describe('renderOriginalDisplay', () => {
    it('renders text with literal newlines (white-space: pre-wrap)', () => {
      const text = 'Hello\nworld\ntest';
      const result = renderOriginalDisplay(text);
      // '\n' stays as-is; no <br> conversion
      assert.strictEqual(result, 'Hello\nworld\ntest');
    });

    it('escapes HTML characters', () => {
      const text = '<script>alert("test")</script>';
      const result = renderOriginalDisplay(text);
      assert.strictEqual(result, '&lt;script&gt;alert("test")&lt;/script&gt;');
    });

    it('handles HTML characters with newlines', () => {
      const text = '<div>\ntest\n</div>';
      const result = renderOriginalDisplay(text);
      assert.strictEqual(result, '&lt;div&gt;\ntest\n&lt;/div&gt;');
    });
  });

  describe('renderMaskedDisplay', () => {
    it('renders masked positions as spans with asterisks', () => {
      const originalText = 'Hello world test';
      const positions: Position[] = [
        { start: 0, end: 5, original: 'Hello' },
        { start: 6, end: 11, original: 'world' },
      ];
      const unmaskedPositions = new Set<string>();

      const result = renderMaskedDisplay(
        originalText,
        positions,
        unmaskedPositions
      );
      assert.strictEqual(
        result,
        '<span class="masked-token" data-token-id="0-5">＊＊＊＊</span>' +
          ' ' +
          '<span class="masked-token" data-token-id="6-11">＊＊＊＊</span>' +
          ' test'
      );
    });

    it('renders unmasked positions with original text', () => {
      const originalText = 'Hello world test';
      const positions: Position[] = [
        { start: 0, end: 5, original: 'Hello' },
        { start: 6, end: 11, original: 'world' },
      ];
      const unmaskedPositions = new Set(['0-5']);

      const result = renderMaskedDisplay(
        originalText,
        positions,
        unmaskedPositions
      );
      assert.strictEqual(
        result,
        '<span class="masked-token original" data-token-id="0-5">Hello</span>' +
          ' ' +
          '<span class="masked-token" data-token-id="6-11">＊＊＊＊</span>' +
          ' test'
      );
    });

    it('preserves literal newlines in unmasked text (no <br>)', () => {
      const originalText = 'Hello\nworld\ntest';
      const positions: Position[] = [{ start: 6, end: 11, original: 'world' }];
      const unmaskedPositions = new Set<string>();

      const result = renderMaskedDisplay(
        originalText,
        positions,
        unmaskedPositions
      );
      assert.strictEqual(
        result,
        'Hello\n' +
          '<span class="masked-token" data-token-id="6-11">＊＊＊＊</span>' +
          '\ntest'
      );
    });

    it('escapes HTML in original text', () => {
      const originalText = 'Hello world';
      const positions: Position[] = [{ start: 6, end: 11, original: 'world' }];
      const unmaskedPositions = new Set(['6-11']);

      const result = renderMaskedDisplay(
        originalText,
        positions,
        unmaskedPositions
      );
      assert.strictEqual(
        result,
        'Hello ' +
          '<span class="masked-token original" data-token-id="6-11">world</span>'
      );
    });

    it('sorts positions correctly for rendering', () => {
      const originalText = 'Hello world test';
      const positions: Position[] = [
        { start: 12, end: 16, original: 'test' },
        { start: 0, end: 5, original: 'Hello' },
        { start: 6, end: 11, original: 'world' },
      ];
      const unmaskedPositions = new Set<string>();

      const result = renderMaskedDisplay(
        originalText,
        positions,
        unmaskedPositions
      );
      assert.strictEqual(
        result,
        '<span class="masked-token" data-token-id="0-5">＊＊＊＊</span>' +
          ' ' +
          '<span class="masked-token" data-token-id="6-11">＊＊＊＊</span>' +
          ' ' +
          '<span class="masked-token" data-token-id="12-16">＊＊＊＊</span>'
      );
    });
  });
});
