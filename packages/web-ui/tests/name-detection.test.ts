// 人名検出のテストケース
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { initSudachi, analyzeMorphology } from '../dist/sudachi-integration.js';

describe('人名検出テスト', () => {
  before(async () => {
    const success = await initSudachi();
    if (!success) {
      throw new Error('Sudachi初期化に失敗しました');
    }
  });

  describe('個別人名の検出', () => {
    it('「田中 麻以」が完全に検出される', () => {
      const result = analyzeMorphology('田中 麻以');

      // 検出された個人情報が1件あることを確認
      assert.strictEqual(result.names.length, 1);

      // 完全な名前が検出されることを確認
      const detectedName = result.names[0];
      assert.strictEqual(detectedName.text, '田中 麻以');
      assert.strictEqual(detectedName.start, 0);
      assert.strictEqual(detectedName.end, 5);
      assert.strictEqual(detectedName.type, 'surname');
    });

    it('「藤井 貴啓」が完全に検出される', () => {
      const result = analyzeMorphology('藤井 貴啓');

      // 検出された個人情報が1件あることを確認
      assert.strictEqual(result.names.length, 1);

      // 完全な名前が検出されることを確認
      const detectedName = result.names[0];
      assert.strictEqual(detectedName.text, '藤井 貴啓');
      assert.strictEqual(detectedName.start, 0);
      assert.strictEqual(detectedName.end, 5);
      assert.strictEqual(detectedName.type, 'surname');
    });
  });

  describe('複数人名の検出', () => {
    it('「田中 麻以 藤井 貴啓」で両方の名前が個別に検出される', () => {
      const result = analyzeMorphology('田中 麻以 藤井 貴啓');

      // 検出された個人情報が2件あることを確認
      assert.strictEqual(result.names.length, 2);

      // 名前がソートされた順序で確認
      const sortedNames = result.names.sort((a, b) => a.start - b.start);

      // 1つ目の名前
      assert.strictEqual(sortedNames[0].text, '田中 麻以');
      assert.strictEqual(sortedNames[0].start, 0);
      assert.strictEqual(sortedNames[0].end, 6);
      assert.strictEqual(sortedNames[0].type, 'surname');

      // 2つ目の名前
      assert.strictEqual(sortedNames[1].text, '藤井 貴啓');
      assert.strictEqual(sortedNames[1].start, 6);
      assert.strictEqual(sortedNames[1].end, 11);
      assert.strictEqual(sortedNames[1].type, 'surname');
    });
  });

  describe('住所検出（既存機能の回帰テスト）', () => {
    it('複雑な住所パターンが検出される', () => {
      const result = analyzeMorphology('宮城県仙台市太白区長町2-11-21-XI-5');

      // 住所関連の個人情報が検出されることを確認
      assert.ok(result.names.length > 0);

      // 地名部分が検出されることを確認
      const placeNames = result.names.filter(name => name.type === 'place');
      assert.ok(placeNames.length > 0);

      // XI-5パターンが検出されることを確認
      const alphanumericPattern = result.names.find(
        name => name.text.includes('XI') && name.text.includes('5')
      );
      assert.ok(alphanumericPattern);
    });

    it('建物名+部屋番号が検出される', () => {
      const result = analyzeMorphology(
        '神奈川県川崎市高津区下作延6-26-40 ノースヴァリー102'
      );

      // 住所関連の個人情報が検出されることを確認
      assert.ok(result.names.length > 0);

      // 建物名が検出されることを確認
      const buildingName = result.names.find(name =>
        name.text.includes('ノースヴァリー')
      );
      assert.ok(buildingName);

      // 住所数字が検出されることを確認
      const addressNumbers = result.names.find(
        name =>
          name.text.includes('6') &&
          name.text.includes('26') &&
          name.text.includes('40')
      );
      assert.ok(addressNumbers);
    });
  });

  describe('エッジケース', () => {
    it('空文字列の場合', () => {
      const result = analyzeMorphology('');
      assert.strictEqual(result.names.length, 0);
    });

    it('人名以外のテキストは検出されない', () => {
      const result = analyzeMorphology('今日は良い天気です。');
      assert.strictEqual(result.names.length, 0);
    });

    it('一般的な単語と人名の区別', () => {
      const result = analyzeMorphology('田中さんは以前から知っています');

      // 「田中」は検出されるが「以前」は検出されない
      const detectedTexts = result.names.map(name => name.text);
      assert.ok(detectedTexts.includes('田中'));
      assert.ok(!detectedTexts.includes('以前'));
    });
  });

  describe('マスキング結果の検証', () => {
    it('検出された人名が適切にマスクされる', () => {
      const text = '田中 麻以';
      const result = analyzeMorphology(text);

      // マスクを適用
      let maskedText = text;
      const sortedNames = [...result.names].sort((a, b) => b.start - a.start);

      for (const name of sortedNames) {
        maskedText =
          maskedText.slice(0, name.start) +
          '＊＊＊＊' +
          maskedText.slice(name.end);
      }

      assert.strictEqual(maskedText, '＊＊＊＊');
    });

    it('複数人名のマスキング結果', () => {
      const text = '田中 麻以 藤井 貴啓';
      const result = analyzeMorphology(text);

      // マスクを適用
      let maskedText = text;
      const sortedNames = [...result.names].sort((a, b) => b.start - a.start);

      for (const name of sortedNames) {
        maskedText =
          maskedText.slice(0, name.start) +
          '＊＊＊＊' +
          maskedText.slice(name.end);
      }

      assert.strictEqual(maskedText, '＊＊＊＊＊＊＊＊');
    });
  });

  describe('識別子パターンの除外', () => {
    it('JSONのIDフィールドは検出されない', () => {
      const result = analyzeMorphology(
        '"eventId": "Emfs5nm73p2", "pmsDataId": "I_2025_0000116265", "pmsUserId": "17622E2427"'
      );

      // 識別子パターンは検出されないことを確認
      assert.strictEqual(result.names.length, 0);
    });

    it('英数字の識別子は検出されない', () => {
      const result = analyzeMorphology('セッションID: ABC123XYZ');

      // 識別子パターンは検出されないことを確認（人名でない文脈）
      const identifierDetected = result.names.some(
        name => name.text.includes('ABC123') || name.text.includes('XYZ')
      );
      assert.strictEqual(identifierDetected, false);
    });

    it('URLパラメータ内の文字列は検出されない', () => {
      const result = analyzeMorphology(
        'https://example.com/api?user=nm73&session=E2427'
      );

      // URL内の識別子は検出されないことを確認
      const urlIdentifierDetected = result.names.some(
        name => name.text.includes('nm73') || name.text.includes('E2427')
      );
      assert.strictEqual(urlIdentifierDetected, false);
    });

    it('JSONフィールド名の英数字パターンは検出されない', () => {
      const result = analyzeMorphology(
        '"TotalChildA70Count": 0, "TotalChildB50Count": 1'
      );

      // フィールド名内の英数字識別子は検出されないことを確認
      const fieldNameDetected = result.names.some(
        name => name.text.includes('A70') || name.text.includes('B50')
      );
      assert.strictEqual(fieldNameDetected, false);
    });

    it('角括弧付きテキストの人名は検出される', () => {
      const result = analyzeMorphology('[注文者]    藤井 貴啓 様');

      // 人名が検出されることを確認
      assert.ok(result.names.length > 0);

      // 藤井が含まれることを確認
      const nameDetected = result.names.some(name =>
        name.text.includes('藤井')
      );
      assert.ok(nameDetected);
    });
  });

  describe('電話番号検出', () => {
    it('携帯電話番号が検出される', () => {
      const result = analyzeMorphology('(TEL) 080-5563-6298');

      // 電話番号が検出されることを確認
      const phoneNumbers = result.names.filter(
        name => name.type === 'phone_number'
      );
      assert.strictEqual(phoneNumbers.length, 1);

      // 完全な電話番号が検出されることを確認
      const phoneNumber = phoneNumbers[0];
      assert.strictEqual(phoneNumber.text, '080-5563-6298');
      assert.strictEqual(phoneNumber.start, 6);
      assert.strictEqual(phoneNumber.end, 19);
    });

    it('固定電話番号が検出される', () => {
      const result = analyzeMorphology('連絡先: 03-1234-5678');

      // 電話番号が検出されることを確認
      const phoneNumbers = result.names.filter(
        name => name.type === 'phone_number'
      );
      assert.strictEqual(phoneNumbers.length, 1);

      // 完全な電話番号が検出されることを確認
      const phoneNumber = phoneNumbers[0];
      assert.strictEqual(phoneNumber.text, '03-1234-5678');
    });

    it('電話番号と郵便番号が区別される', () => {
      const result = analyzeMorphology('TEL: 080-1234 〒123-4567');

      // 電話番号は検出されない（不完全なパターン）
      const phoneNumbers = result.names.filter(
        name => name.type === 'phone_number'
      );
      assert.strictEqual(phoneNumbers.length, 0);

      // 郵便番号は検出される
      const postalCodes = result.names.filter(
        name => name.type === 'postal_code'
      );
      assert.strictEqual(postalCodes.length, 1);
      assert.strictEqual(postalCodes[0].text, '123-4567');
    });
  });

  describe('識別子と人名の区別', () => {
    it('通常の文章内の人名は検出される', () => {
      const result = analyzeMorphology('田中さんのIDは ABC123 です');

      // 人名は検出されるが、IDは検出されない
      const nameDetected = result.names.some(name =>
        name.text.includes('田中')
      );
      const idDetected = result.names.some(name =>
        name.text.includes('ABC123')
      );

      assert.ok(nameDetected);
      assert.ok(!idDetected);
    });
  });

  describe('英語テキストの誤検出防止', () => {
    it('英語の一般的な単語は検出されない', () => {
      const result = analyzeMorphology(
        'For details of your purchase and ticket issuance procedures, please check Ticket PIA "My Ticket" page.'
      );

      // 英語の単語は一切検出されないことを確認
      assert.strictEqual(result.names.length, 0);
    });

    it('英語の人名は検出されない', () => {
      const result = analyzeMorphology(
        'User: John Smith Email: john@example.com'
      );

      // 英語の人名は検出されないことを確認
      const englishNameDetected = result.names.some(name =>
        ['John', 'Smith', 'john'].includes(name.text)
      );
      assert.strictEqual(englishNameDetected, false);
    });

    it('日本語人名と英語単語の混在テキストで正しく区別される', () => {
      const result = analyzeMorphology('田中太郎さんの information です');

      // 日本語人名は検出され、英語単語は検出されない
      const japaneseNameDetected = result.names.some(
        name => name.text.includes('田中') || name.text.includes('太郎')
      );
      const englishWordDetected = result.names.some(name =>
        name.text.includes('information')
      );

      assert.ok(japaneseNameDetected);
      assert.ok(!englishWordDetected);
    });

    it('電話番号と英語単語の混在で適切に処理される', () => {
      const result = analyzeMorphology('Contact: 080-1234-5678 for support');

      // 電話番号は検出され、英語単語は検出されない
      const phoneDetected = result.names.some(
        name => name.type === 'phone_number'
      );
      const englishWordDetected = result.names.some(name =>
        ['Contact', 'support'].includes(name.text)
      );

      assert.ok(phoneDetected);
      assert.ok(!englishWordDetected);
    });
  });
});
