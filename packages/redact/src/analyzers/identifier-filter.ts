// 識別子パターンフィルター（英数字IDの誤検出を防ぐ）

interface IdentifierContext {
  text: string;
  start: number;
  end: number;
  originalText: string;
}

/**
 * 識別子パターンかどうかを判定して除外すべきトークンをフィルタリング
 */
export function filterOutIdentifierPatterns(
  detectedItems: Array<{
    text: string;
    start: number;
    end: number;
    type: 'surname' | 'given_name' | 'place';
  }>,
  originalText: string
): Array<{
  text: string;
  start: number;
  end: number;
  type: 'surname' | 'given_name' | 'place';
}> {
  return detectedItems.filter(item => {
    if (
      !isIdentifierPattern({
        text: item.text,
        start: item.start,
        end: item.end,
        originalText,
      })
    ) {
      return true;
    }

    console.log(
      `🚫 識別子として除外: "${item.text}" at ${item.start}-${item.end}`
    );
    return false;
  });
}

/**
 * 識別子パターンかどうかを判定
 */
function isIdentifierPattern(ctx: IdentifierContext): boolean {
  const { text, start, end, originalText } = ctx;
  const contextStart = Math.max(0, start - 10);
  const contextEnd = Math.min(originalText.length, end + 10);
  const context = originalText.slice(contextStart, contextEnd);

  return (
    isInJsonXmlContext(context, text) ||
    isInUrlContext(context) ||
    isInCodeContext(context) ||
    isAlphanumericIdentifier(text) ||
    isInEnglishDocumentContext(text, context)
  );
}

/**
 * JSON/XML形式のコンテキストかチェック
 */
function isInJsonXmlContext(context: string, text: string): boolean {
  const jsonFieldPattern = new RegExp(
    `["'][^"']*["']\\s*:\\s*["'][^"']*${escapeRegex(text)}[^"']*["']`
  );
  if (jsonFieldPattern.test(context)) return true;

  const jsonFieldNamePattern = new RegExp(`["']${escapeRegex(text)}["']\\s*:`);
  if (jsonFieldNamePattern.test(context)) return true;

  const jsonValueInFieldPattern = new RegExp(
    `["'][^"']*${escapeRegex(text)}[^"']*["']\\s*:`
  );
  if (jsonValueInFieldPattern.test(context)) return true;

  const xmlAttrPattern = new RegExp(
    `\\w+\\s*=\\s*["'][^"']*${escapeRegex(text)}[^"']*["']`
  );
  return xmlAttrPattern.test(context);
}

/**
 * URLコンテキストかチェック
 */
function isInUrlContext(context: string): boolean {
  const urlPatterns = [
    /https?:\/\/[^\s]+/,
    /[?&]\w+=[^&\s]+/,
    /\/\w+\/[^\/\s]+/,
  ];
  return urlPatterns.some(pattern => pattern.test(context));
}

/**
 * プログラムコードコンテキストかチェック
 */
function isInCodeContext(context: string): boolean {
  const codePatterns = [/\w+\s*=\s*[^=]+/, /\w+\([^)]*\)/, /[{};]/, /\$\w+/];
  const strictBracketPatterns = [
    /\[\s*\d+\s*\]/,
    /\[["'][^"']*["']\]/,
    /\w+\[[^\]]+\]/,
  ];

  return (
    codePatterns.some(p => p.test(context)) ||
    strictBracketPatterns.some(p => p.test(context))
  );
}

/**
 * 英数字の識別子パターンかチェック
 */
function isAlphanumericIdentifier(text: string): boolean {
  if (!/^[A-Za-z0-9]+$/.test(text)) return false;

  const identifierPatterns = [
    /^[A-Z][0-9]{2,}$/,
    /^[a-z]{2,}[0-9]{2,}$/,
    /^[A-Z]{2,}[0-9]{2,}$/,
    /^[0-9]{6,}$/,
    /^[A-Fa-f0-9]{8,}$/,
    /^[A-Za-z]+[0-9]+[A-Za-z]*$/,
  ];

  return identifierPatterns.some(p => p.test(text));
}

/**
 * 英語文書内での非人名パターンをチェック
 */
function isInEnglishDocumentContext(text: string, context: string): boolean {
  if (!/^[A-Za-z]+$/.test(text)) return false;
  if (!/[A-Za-z]{2,}/.test(context)) return false;

  if (text.toLowerCase() === 'page') {
    const beforeText = context.slice(0, context.lastIndexOf(text));
    const afterText = context.slice(context.lastIndexOf(text) + text.length);

    console.log(
      `Debug: Page判定: before="${beforeText}", after="${afterText}"`
    );

    const personNameContext = [
      /\b(mr|mrs|ms|miss|dr|prof)\s+\w+\s*$/i,
      /\bcontact\s*:\s*\w+\s*$/i,
      /\b(from|by|signed)\s*:\s*\w+\s*$/i,
      /\b\w+\s*$/,
    ];

    const isLikelyPersonName = personNameContext.some(pattern => {
      const match = pattern.test(beforeText);
      console.log(`  パターン ${pattern} → ${match}`);
      return match;
    });

    return !isLikelyPersonName;
  }

  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
