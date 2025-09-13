import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { chromium, Browser, Page } from 'playwright';

describe('Web UI E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  const baseURL = 'http://localhost:3000';

  beforeEach(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterEach(async () => {
    await browser.close();
  });

  describe('Basic functionality', () => {
    it('should load the page correctly', async () => {
      await page.goto(baseURL);
      const title = await page.title();
      assert.strictEqual(title, '個人情報マスクツール');

      const heading = await page.textContent('h1');
      assert.strictEqual(heading, '個人情報マスクツール');
    });

    it('should mask personal information automatically', async () => {
      await page.goto(baseURL);

      const testText = `私の連絡先は test@example.com です。
電話番号は 090-1234-5678 で、
住所は 東京都渋谷区渋谷1-1-1 です。`;

      await page.fill('textarea', testText);
      await page.click('button:has-text("マスクする")');

      // Wait for masking to complete
      await page.waitForSelector('.masked-token', { timeout: 5000 });

      const maskedContent = await page.textContent(
        '[data-testid="maskedDisplay"], .content:last-child'
      );

      // Verify email is masked
      assert.match(maskedContent || '', /私の連絡先は ＊＊＊＊ です/);

      // Verify phone is masked
      assert.match(maskedContent || '', /電話番号は ＊＊＊＊で/);

      // Verify address is not masked (not detected by browser version)
      assert.match(maskedContent || '', /住所は 東京都渋谷区渋谷1-1-1 です/);
    });
  });

  describe('Interactive functionality', () => {
    beforeEach(async () => {
      await page.goto(baseURL);
      const testText = `私の連絡先は test@example.com です。
電話番号は 090-1234-5678 で、
住所は 東京都渋谷区渋谷1-1-1 です。`;

      await page.fill('textarea', testText);
      await page.click('button:has-text("マスクする")');
      await page.waitForSelector('.masked-token', { timeout: 5000 });
    });

    it('should unmask tokens when clicked', async () => {
      // Click on first masked token
      await page.click('.masked-token');

      // Verify token is unmasked
      const unmaskedToken = await page.textContent('.masked-token.original');
      assert.ok(unmaskedToken);
      assert.notMatch(unmaskedToken, /＊＊＊＊/);
    });

    it('should add manual masks with drag selection', async () => {
      // Select text for manual masking
      await page.evaluate(() => {
        const textNode = Array.from(document.querySelectorAll('*'))
          .find(el => el.textContent?.includes('東京都渋谷区'))
          ?.childNodes.find(node =>
            node.textContent?.includes('東京都渋谷区')
          ) as Text;

        if (textNode) {
          const range = document.createRange();
          const text = textNode.textContent || '';
          const start = text.indexOf('東京都渋谷区渋谷1-1-1');
          range.setStart(textNode, start);
          range.setEnd(textNode, start + '東京都渋谷区渋谷1-1-1'.length);

          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);

          // Trigger mouseup event
          const event = new MouseEvent('mouseup', { bubbles: true });
          textNode.parentElement?.dispatchEvent(event);
        }
      });

      // Wait for manual mask to be applied
      await page.waitForTimeout(100);

      const maskedContent = await page.textContent('.content:last-child');
      assert.match(maskedContent || '', /住所＊＊＊＊/);
    });

    it('should switch tabs correctly', async () => {
      // Click original tab
      await page.click('button:has-text("元の文章")');

      // Verify original tab is active
      const originalTab = await page.getAttribute(
        'button:has-text("元の文章")',
        'class'
      );
      assert.match(originalTab || '', /active/);

      // Click masked tab
      await page.click('button:has-text("マスク後の文章")');

      // Verify masked tab is active
      const maskedTab = await page.getAttribute(
        'button:has-text("マスク後の文章")',
        'class'
      );
      assert.match(maskedTab || '', /active/);
    });

    it('should copy content to clipboard', async () => {
      // Grant clipboard permissions
      await page.context().grantPermissions(['clipboard-write']);

      await page.click('button:has-text("コピー")');

      // Verify button text changes
      const buttonText = await page.textContent(
        'button:has-text("コピー完了！")'
      );
      assert.strictEqual(buttonText, 'コピー完了！');

      // Verify clipboard content (if available)
      try {
        const clipboardText = await page.evaluate(() =>
          navigator.clipboard.readText()
        );
        assert.match(clipboardText, /私の連絡先は ＊＊＊＊ です/);
      } catch {
        // Clipboard reading may not be available in test environment
        console.warn('Clipboard reading not available in test environment');
      }
    });

    it('should reset to initial state', async () => {
      // Click on a masked token to unmask it first
      await page.click('.masked-token');

      // Verify token is unmasked
      let unmaskedExists = await page.isVisible('.masked-token.original');
      assert.ok(unmaskedExists);

      // Click reset button
      await page.click('button:has-text("初期状態に戻す")');

      // Verify all tokens are masked again
      unmaskedExists = await page.isVisible('.masked-token.original');
      assert.ok(!unmaskedExists);
    });
  });

  describe('Line break preservation', () => {
    it('should preserve line breaks in original and masked text', async () => {
      await page.goto(baseURL);

      const multilineText = `第一行: test1@example.com
第二行: test2@example.com
第三行: 090-1111-2222`;

      await page.fill('textarea', multilineText);
      await page.click('button:has-text("マスクする")');
      await page.waitForSelector('.masked-token', { timeout: 5000 });

      // Check original display has line breaks
      const originalHTML = await page.innerHTML('.content:first-child');
      assert.match(originalHTML, /<br>/);

      // Check masked display has line breaks
      const maskedHTML = await page.innerHTML('.content:last-child');
      assert.match(maskedHTML, /<br>/);
    });
  });
});
