#!/usr/bin/env node
// Sudachi形態素解析テストツール
import { TokenizeMode, tokenize } from 'sudachi';

const args = process.argv.slice(2);
const text = args.join(' ');

if (!text) {
  console.log('使用法: npm run morphology-test "解析したい文章"');
  console.log(
    '例: npm run morphology-test "山田太郎さんと田中花子さんが会議に参加しました"'
  );
  process.exit(1);
}

console.log('🔍 Sudachi形態素解析結果');
console.log('='.repeat(50));
console.log(`📝 入力テキスト: "${text}"`);
console.log(`📏 文字数: ${text.length}`);
console.log('');

try {
  // TokenizeMode.C: 統合的な長い単位分割
  const json = tokenize(text, TokenizeMode.C);
  const tokens = JSON.parse(json);

  const names = [];
  const allTokens = [];
  let offset = 0;

  for (const token of tokens) {
    const surface = token.surface;
    const poses = token.poses;

    // すべてのトークンを記録
    allTokens.push({
      surface,
      poses,
      start: offset,
      end: offset + surface.length,
    });

    // 人名検出
    if (isPersonName(poses)) {
      const nameType = getNameType(poses);
      names.push({
        text: surface,
        start: offset,
        end: offset + surface.length,
        type: nameType,
        poses: poses,
      });
    }

    // 地名検出（コンテキスト判定を含む）
    if (
      isPlaceName(poses) &&
      isPersonalIdentifyingAddress(text, offset, surface, allTokens)
    ) {
      const placeType = getPlaceType(poses);
      names.push({
        text: surface,
        start: offset,
        end: offset + surface.length,
        type: placeType,
        poses: poses,
      });
    }

    // 半角カタカナ人名の補完検出
    if (isHalfWidthKatakanaName(surface)) {
      names.push({
        text: surface,
        start: offset,
        end: offset + surface.length,
        type: 'surname', // デフォルトで姓として扱う
        poses: ['半角カタカナ', '人名候補', '補完検出'],
      });
    }

    offset += surface.length;
  }

  // 郵便番号検出（形態素解析後の追加検出）
  const postalCodes = detectPostalCodes(text);
  names.push(...postalCodes);

  const personalData = names.filter(
    n => n.type === 'surname' || n.type === 'given_name'
  );
  const placeData = names.filter(
    n => n.type.startsWith('place') || n.type === 'country'
  );
  const postalData = names.filter(n => n.type === 'postal_code');

  // 統計情報
  console.log('📊 統計情報:');
  console.log(`   総トークン数: ${allTokens.length}`);
  console.log(`   検出された人名: ${personalData.length}`);
  console.log(`   検出された地名: ${placeData.length}`);
  console.log(`   検出された郵便番号: ${postalData.length}`);
  console.log('');

  // 検出された人名
  if (personalData.length > 0) {
    console.log('👤 検出された人名:');
    personalData.forEach((name, i) => {
      const typeLabel = name.type === 'surname' ? '姓' : '名';
      console.log(
        `   ${i + 1}. "${name.text}" (${typeLabel}) at ${name.start}-${name.end}`
      );
      console.log(`      品詞: [${name.poses.join(', ')}]`);
    });
    console.log('');
  } else {
    console.log('👤 人名は検出されませんでした。');
    console.log('');
  }

  // 検出された地名
  if (placeData.length > 0) {
    console.log('🏠 検出された地名:');
    placeData.forEach((place, i) => {
      const typeLabel = place.type === 'country' ? '国名' : '地名';
      console.log(
        `   ${i + 1}. "${place.text}" (${typeLabel}) at ${place.start}-${place.end}`
      );
      console.log(`      品詞: [${place.poses.join(', ')}]`);
    });
    console.log('');
  } else {
    console.log('🏠 地名は検出されませんでした。');
    console.log('');
  }

  // 検出された郵便番号
  if (postalData.length > 0) {
    console.log('📮 検出された郵便番号:');
    postalData.forEach((postal, i) => {
      console.log(
        `   ${i + 1}. "${postal.text}" (郵便番号) at ${postal.start}-${postal.end}`
      );
      console.log(`      検出方式: [正規表現パターンマッチング]`);
    });
    console.log('');
  } else {
    console.log('📮 郵便番号は検出されませんでした。');
    console.log('');
  }

  // 全トークン（人名・地名をハイライト）
  console.log('🔤 全トークン:');
  allTokens.forEach((token, i) => {
    const isName = isPersonName(token.poses);
    const isPlace = isPlaceName(token.poses);
    let indicator = '  ';
    if (isName) indicator = '👤';
    else if (isPlace) indicator = '🏠';

    const posInfo = ` [${token.poses.join(', ')}]`;

    console.log(`   ${i + 1}. ${indicator} "${token.surface}"${posInfo}`);
  });
} catch (error) {
  console.error('❌ エラー:', error.message);
  process.exit(1);
}

function isPersonName(poses) {
  if (poses.length >= 3) {
    return (
      poses[0] === '名詞' && poses[1] === '固有名詞' && poses[2] === '人名'
    );
  }
  return false;
}

function getNameType(poses) {
  if (poses.length >= 4) {
    if (poses[3] === '姓') return 'surname';
    if (poses[3] === '名') return 'given_name';
  }
  return 'surname'; // デフォルト
}

function isPlaceName(poses) {
  if (poses.length >= 3) {
    return (
      poses[0] === '名詞' && poses[1] === '固有名詞' && poses[2] === '地名'
    );
  }
  return false;
}

function getPlaceType(poses) {
  if (poses.length >= 4) {
    if (poses[3] === '一般') return 'place_general';
    if (poses[3] === '国') return 'country';
  }
  return 'place'; // デフォルト
}

function isHalfWidthKatakanaName(surface) {
  // 半角カタカナのみで構成され、かつ2文字以上の場合は人名候補とする
  const halfKatakanaRegex = /^[ｦ-ﾟ]+$/;
  return halfKatakanaRegex.test(surface) && surface.length >= 2;
}

function detectPostalCodes(text) {
  const postalCodes = [];

  // 日本の郵便番号パターン: 3桁-4桁 または 7桁
  const postalCodeRegex = /\b\d{3}-?\d{4}\b/g;
  let match;

  while ((match = postalCodeRegex.exec(text)) !== null) {
    postalCodes.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      type: 'postal_code',
      poses: ['正規表現', '郵便番号', 'パターンマッチング'],
    });
  }

  return postalCodes;
}

function isPersonalIdentifyingAddress(text, offset, surface, allTokens) {
  // 施設名の一部かチェック
  if (isPartOfFacilityName(text, offset, surface)) {
    return false;
  }

  // 行政区分レベルの判定
  const adminLevels = {
    prefecture: ['県', '府', '都', '道'],
    city: ['市', '町', '村', '区'],
    publicArea: ['地区', '郡'],
  };

  // この地名が都道府県や市町村レベルかチェック
  const isPrefectureLevel = adminLevels.prefecture.some(suffix =>
    surface.endsWith(suffix)
  );
  const isCityLevel = adminLevels.city.some(suffix => surface.endsWith(suffix));
  const isPublicAreaLevel = adminLevels.publicArea.some(suffix =>
    surface.endsWith(suffix)
  );

  if (isPrefectureLevel || isCityLevel || isPublicAreaLevel) {
    return false; // 行政区分レベルは個人特定情報ではない
  }

  // 周辺のコンテキストを分析
  const contextTokens = getContextTokens(allTokens, offset, surface.length);

  // 市町村レベルの後に続く詳細な地名かチェック
  const followsAdministrativeArea = contextTokens.before.some(token => {
    const isAdminArea =
      adminLevels.city.some(suffix => token.surface.endsWith(suffix)) ||
      adminLevels.prefecture.some(suffix => token.surface.endsWith(suffix));
    return isAdminArea;
  });

  // 番地や建物名に近接しているかチェック
  const hasNearbyAddressNumbers = contextTokens.after.some(token => {
    return (
      /^\d+(-\d+)*$/.test(token.surface) || // 番地パターン
      ['番地', '号', '丁目', 'マンション', 'アパート', 'ビル'].some(keyword =>
        token.surface.includes(keyword)
      )
    );
  });

  // 市町村の後に続く詳細地名で、かつ番地等に近接している場合は個人特定情報
  return followsAdministrativeArea && hasNearbyAddressNumbers;
}

function getContextTokens(allTokens, offset, length) {
  const currentEnd = offset + length;

  // 前後5トークンずつを取得
  const before = [];
  const after = [];

  for (const token of allTokens) {
    if (token.end <= offset && before.length < 5) {
      before.unshift(token); // 前のトークンは逆順で追加
    } else if (token.start >= currentEnd && after.length < 5) {
      after.push(token);
    }
  }

  return { before: before.slice(-5), after: after.slice(0, 5) };
}

function isPartOfFacilityName(text, offset, surface) {
  // 施設名のキーワードパターン
  const facilityKeywords = [
    'ホテル',
    'リゾート',
    '温泉',
    '旅館',
    'ロッジ',
    'ペンション',
    '病院',
    '学校',
    '大学',
    '高校',
    '中学',
    '小学校',
    '図書館',
    '美術館',
    '博物館',
    'センター',
    '会館',
    'ビル',
    'タワー',
    'マンション',
    'アパート',
    '公園',
    '神社',
    '寺',
    '教会',
    'スタジアム',
    'ドーム',
  ];

  // 地名の前後に施設キーワードがあるかチェック
  const beforeText = text.substring(Math.max(0, offset - 10), offset);
  const afterText = text.substring(
    offset + surface.length,
    offset + surface.length + 10
  );
  const surroundingText = beforeText + afterText;

  return facilityKeywords.some(keyword => surroundingText.includes(keyword));
}
