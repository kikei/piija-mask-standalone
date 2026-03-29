// ../redact/src/analyzers/token-parser.ts
function parseSudachiTokens(json) {
  const raw = JSON.parse(json);
  let offset = 0;
  return raw.map((t) => {
    const token = {
      surface: t.surface,
      poses: t.poses,
      start: offset,
      end: offset + t.surface.length
    };
    offset += t.surface.length;
    return token;
  });
}

// ../redact/src/analyzers/token-classifiers.ts
function isPlaceName(token) {
  return token.poses.length >= 3 && token.poses[0] === "\u540D\u8A5E" && token.poses[1] === "\u56FA\u6709\u540D\u8A5E" && token.poses[2] === "\u5730\u540D";
}
function getAdministrativeLevelFull(token) {
  const prefectureSuffixes = ["\u770C", "\u5E9C", "\u90FD", "\u9053"];
  const citySuffixes = ["\u5E02", "\u753A", "\u6751", "\u533A"];
  const districtSuffixes = ["\u5730\u533A", "\u90E1"];
  if (prefectureSuffixes.some((suffix) => token.surface.endsWith(suffix))) {
    return { level: "prefecture", isAdministrative: true };
  }
  if (citySuffixes.some((suffix) => token.surface.endsWith(suffix))) {
    return { level: "city", isAdministrative: true };
  }
  if (districtSuffixes.some((suffix) => token.surface.endsWith(suffix))) {
    return { level: "district", isAdministrative: true };
  }
  return { level: null, isAdministrative: false };
}

// ../redact/src/analyzers/address-block-detector.ts
function isAddressBlockStopToken(token) {
  const pos0 = token.poses[0];
  if (!pos0)
    return false;
  const stopPos = ["\u52D5\u8A5E", "\u5F62\u5BB9\u8A5E", "\u52A9\u52D5\u8A5E", "\u52A9\u8A5E", "\u63A5\u7D9A\u8A5E", "\u611F\u52D5\u8A5E"];
  if (stopPos.includes(pos0))
    return true;
  if (pos0 === "\u88DC\u52A9\u8A18\u53F7") {
    const addressSafeDashes = [
      "\uFF0D",
      // U+FF0D FULLWIDTH HYPHEN-MINUS
      "\u2014",
      // U+2014 EM DASH
      "\u2010",
      // U+2010 HYPHEN
      "\u2212"
      // U+2212 MINUS SIGN
    ];
    return !addressSafeDashes.includes(token.surface);
  }
  const stopSurfaces = ["\u3002", "\uFF01", "\uFF1F", "\n", "\r", "\uFF08", "\uFF09", "\u300C", "\u300D"];
  return stopSurfaces.includes(token.surface);
}
function findAddressBlocks(tokens) {
  const blocks = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token)
      continue;
    let blockStartIndex;
    let checkFrom;
    const adminLevel = getAdministrativeLevelFull(token);
    if (adminLevel.level === "prefecture") {
      blockStartIndex = i + 1;
      checkFrom = i + 1;
    } else if (isPlaceName(token)) {
      const next = tokens[i + 1];
      if (!next || token.end !== next.start)
        continue;
      if (getAdministrativeLevelFull(next).level !== "city")
        continue;
      blockStartIndex = i;
      checkFrom = i + 2;
    } else {
      continue;
    }
    let hasNextAdmin = false;
    for (let k = checkFrom; k < checkFrom + 3 && k < tokens.length; k++) {
      const t = tokens[k];
      if (t && getAdministrativeLevelFull(t).isAdministrative) {
        hasNextAdmin = true;
        break;
      }
    }
    if (!hasNextAdmin)
      continue;
    const blockTokens = [];
    let lastBlockIndex = blockStartIndex;
    for (let j = blockStartIndex; j < tokens.length; j++) {
      const t = tokens[j];
      if (!t || isAddressBlockStopToken(t))
        break;
      blockTokens.push(t);
      lastBlockIndex = j;
    }
    if (blockTokens.length > 0) {
      const first = blockTokens[0];
      const last = blockTokens[blockTokens.length - 1];
      blocks.push({
        start: first.start,
        end: last.end,
        text: blockTokens.map((t) => t.surface).join(""),
        tokens: blockTokens
      });
      i = lastBlockIndex;
    }
  }
  return blocks;
}

// ../redact/src/analyzers/compound-place-detector.ts
function findCompoundPlaceNames(tokens) {
  const compounds = [];
  const prefectureSuffixes = ["\u770C", "\u5E9C", "\u90FD", "\u9053"];
  for (let i = 0; i < tokens.length; i++) {
    const currentToken = tokens[i];
    if (!currentToken)
      continue;
    if (!isPlaceName(currentToken))
      continue;
    const compoundTokens = [currentToken];
    let j = i + 1;
    while (j < tokens.length) {
      const nextToken = tokens[j];
      if (!nextToken)
        break;
      const prev = compoundTokens[compoundTokens.length - 1];
      if (prev.end !== nextToken.start)
        break;
      if (prefectureSuffixes.includes(nextToken.surface))
        break;
      const isGeneralNoun = nextToken.poses[0] === "\u540D\u8A5E" && nextToken.poses[1] === "\u666E\u901A\u540D\u8A5E";
      const isSuffix = nextToken.poses[0] === "\u63A5\u5C3E\u8F9E" && nextToken.poses[1] === "\u540D\u8A5E\u7684";
      if (!isGeneralNoun && !isSuffix)
        break;
      compoundTokens.push(nextToken);
      j++;
    }
    if (compoundTokens.length > 1) {
      const lastToken = compoundTokens[compoundTokens.length - 1];
      compounds.push({
        text: compoundTokens.map((t) => t.surface).join(""),
        start: currentToken.start,
        end: lastToken.end,
        tokens: compoundTokens
      });
    }
  }
  return compounds;
}
function getTokensContext(tokens, offset, contextSize = 5) {
  const currentToken = tokens.find((t) => t.start <= offset && offset < t.end);
  if (!currentToken)
    return null;
  const idx = tokens.indexOf(currentToken);
  const before = tokens.slice(Math.max(0, idx - contextSize), idx).reverse();
  const after = tokens.slice(idx + 1, idx + 1 + contextSize);
  return { before, after };
}
function isCompoundPlaceInAddressContext(compound, tokens) {
  const startCtx = getTokensContext(tokens, compound.start);
  if (!startCtx)
    return false;
  const lastToken = compound.tokens[compound.tokens.length - 1];
  const endCtx = lastToken ? getTokensContext(tokens, lastToken.start) : startCtx;
  const addressPattern = /^\d+(-\d+)*$/;
  const addressKeywords = ["\u756A\u5730", "\u53F7", "\u4E01\u76EE"];
  const afterContext = endCtx ?? startCtx;
  const hasAddressNumbers = afterContext.after.some(
    (token) => addressPattern.test(token.surface) || addressKeywords.some((kw) => token.surface.includes(kw))
  );
  if (lastToken && getAdministrativeLevelFull(lastToken).isAdministrative) {
    return hasAddressNumbers;
  }
  const hasAdminContext = startCtx.before.some(
    (t) => getAdministrativeLevelFull(t).isAdministrative
  );
  return hasAdminContext && hasAddressNumbers;
}

// ../redact/src/analyzers/context-analyzer.ts
function getTokenContext(tokens, offset, length, contextSize = 5) {
  const currentToken = findTokenAt(tokens, offset);
  if (!currentToken)
    return null;
  const currentIndex = tokens.indexOf(currentToken);
  if (currentIndex === -1)
    return null;
  const before = tokens.slice(Math.max(0, currentIndex - contextSize), currentIndex).reverse();
  const after = tokens.slice(currentIndex + 1, currentIndex + 1 + contextSize);
  return {
    current: currentToken,
    before,
    after,
    index: currentIndex,
    allTokens: tokens
  };
}
function findTokenAt(tokens, offset) {
  return tokens.find((token) => token.start <= offset && offset < token.end) || null;
}

// ../redact/src/analyzers/name-sequence-detector.ts
function findNameSequences(tokens) {
  const sequences = [];
  const processedIndices = /* @__PURE__ */ new Set();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token || processedIndices.has(i))
      continue;
    if (isSurnameToken(token)) {
      const sequence = extractNameSequence(tokens, i);
      if (sequence && isValidNameSequence(tokens, sequence)) {
        sequences.push(sequence);
        for (let j = i; j < i + sequence.tokens.length; j++) {
          processedIndices.add(j);
        }
      }
    }
  }
  return sequences;
}
function isSurnameToken(token) {
  return token.poses.length >= 4 && token.poses[0] === "\u540D\u8A5E" && token.poses[1] === "\u56FA\u6709\u540D\u8A5E" && token.poses[2] === "\u4EBA\u540D" && token.poses[3] === "\u59D3";
}
function isGivenNameToken(token) {
  if (token.poses.length >= 4 && token.poses[0] === "\u540D\u8A5E" && token.poses[1] === "\u56FA\u6709\u540D\u8A5E" && token.poses[2] === "\u4EBA\u540D" && token.poses[3] === "\u540D") {
    return true;
  }
  return isPotentialGivenName(token);
}
function isPotentialGivenName(token) {
  const surface = token.surface.trim();
  if (!surface || /^[\s\-ー－—]+$/.test(surface)) {
    return false;
  }
  if (surface.length === 1) {
    if (/[あ-んア-ンー一-龯]/.test(surface)) {
      const nameCharacters = [
        "\u8CB4",
        "\u7F8E",
        "\u611B",
        "\u6075",
        "\u9999",
        "\u512A",
        "\u771F",
        "\u667A",
        "\u7DBE",
        "\u9EBB"
      ];
      if (nameCharacters.includes(surface)) {
        return true;
      }
      return true;
    }
  }
  if (surface.length <= 4) {
    const isJapaneseChars = /^[あ-んア-ンー一-龯]+$/.test(surface);
    if (isJapaneseChars) {
      const nonNameWords = [
        "\u4EE5\u4E0A",
        "\u4EE5\u4E0B",
        "\u4EE5\u5916",
        "\u4EE5\u5185",
        "\u4EE5\u6765",
        "\u4EE5\u524D",
        "\u4EE5\u5F8C",
        "\u65B9\u6CD5",
        "\u5834\u5408",
        "\u6642\u9593",
        "\u554F\u984C",
        "\u7D50\u679C",
        "\u72B6\u6CC1",
        "\u4ECA\u56DE",
        "\u4ECA\u65E5",
        "\u660E\u65E5",
        "\u6628\u65E5",
        "\u5148\u65E5",
        "\u90FD\u9053\u5E9C\u770C",
        "\u5E02\u753A\u6751",
        "\u756A\u5730",
        "\u4E01\u76EE"
      ];
      const commonNamePatterns = [
        /^[麻]/,
        // 麻で始まる名前（麻以、麻美など）
        /^[貴]/,
        // 貴で始まる名前（貴啓、貴子など）
        /^[美]/,
        // 美で始まる名前
        /^[愛]/,
        // 愛で始まる名前
        /[子|美|香|恵|代|江]$/,
        // 女性名によくある語尾
        /[郎|男|雄|夫|人|太|介|助]$/
        // 男性名によくある語尾
      ];
      const hasNamePattern = commonNamePatterns.some(
        (pattern) => pattern.test(surface)
      );
      const isNonNameWord = nonNameWords.includes(surface);
      return !isNonNameWord && (hasNamePattern || surface.length <= 2);
    }
  }
  return false;
}
function isHonorificSuffix(token) {
  if (token.poses[0] !== "\u63A5\u5C3E\u8F9E")
    return false;
  const honorifics = ["\u3055\u3093", "\u69D8", "\u3055\u307E", "\u304F\u3093", "\u541B", "\u3061\u3083\u3093", "\u6C0F", "\u6BBF"];
  return honorifics.includes(token.surface);
}
function isNameTerminator(token) {
  if (!token)
    return true;
  if (isHonorificSuffix(token))
    return true;
  const pos0 = token.poses[0] ?? "";
  return pos0 === "\u7A7A\u767D" || pos0 === "\u88DC\u52A9\u8A18\u53F7";
}
function isDefinitelyNotName(token) {
  const surface = token.surface.trim();
  const notNamePos0 = [
    "\u88DC\u52A9\u8A18\u53F7",
    "\u8A18\u53F7",
    "\u52A9\u8A5E",
    "\u52A9\u52D5\u8A5E",
    "\u63A5\u7D9A\u8A5E",
    "\u611F\u52D5\u8A5E",
    "\u7A7A\u767D",
    "\u63A5\u5C3E\u8F9E"
  ];
  if (notNamePos0.includes(token.poses[0] ?? "")) {
    return true;
  }
  if (/^[\d\-\s\.]+$/.test(surface)) {
    return true;
  }
  const definitelyNotNames = [
    "\u770C",
    "\u5E02",
    "\u753A",
    "\u6751",
    "\u533A",
    "\u756A\u5730",
    "\u53F7",
    "\u4E01\u76EE",
    "\u3055\u3093",
    "\u304F\u3093",
    "\u3061\u3083\u3093",
    "\u69D8",
    "\u6C0F",
    "\u3067\u3059",
    "\u307E\u3059",
    "\u3067\u3042\u308B",
    "\u3060\u3063\u305F",
    "\u3053\u3068",
    "\u3082\u306E",
    "\u3068\u304D",
    "\u3068\u3053\u308D"
  ];
  return definitelyNotNames.some((notName) => surface.includes(notName));
}
function extractNameSequence(tokens, startIndex) {
  const sequenceTokens = [];
  let currentIndex = startIndex;
  let text = "";
  const firstToken = tokens[currentIndex];
  if (!firstToken)
    return null;
  sequenceTokens.push(firstToken);
  text += firstToken.surface;
  currentIndex++;
  let consecutiveNonNameTokens = 0;
  while (currentIndex < tokens.length) {
    const token = tokens[currentIndex];
    if (!token)
      break;
    if (isSurnameToken(token)) {
      break;
    }
    if (token.surface.trim() === "") {
      if (token.surface.includes("\n") || token.surface.includes("\r")) {
        break;
      }
      sequenceTokens.push(token);
      text += token.surface;
      currentIndex++;
      consecutiveNonNameTokens = 0;
      continue;
    }
    if (isDefinitelyNotName(token)) {
      break;
    }
    if (isGivenNameToken(token) || isPotentialGivenName(token)) {
      sequenceTokens.push(token);
      text += token.surface;
      currentIndex++;
      consecutiveNonNameTokens = 0;
    } else {
      consecutiveNonNameTokens++;
      if (consecutiveNonNameTokens >= 2) {
        break;
      }
      sequenceTokens.push(token);
      text += token.surface;
      currentIndex++;
    }
  }
  const lastToken = sequenceTokens[sequenceTokens.length - 1];
  if (lastToken && (sequenceTokens.length > 1 || isNameTerminator(tokens[currentIndex]))) {
    return {
      text: text.trim(),
      start: firstToken.start,
      end: lastToken.end,
      tokens: sequenceTokens
    };
  }
  return null;
}
function isValidNameSequence(tokens, sequence) {
  if (sequence.text.replace(/\s/g, "").length > 10) {
    return false;
  }
  const surnameCount = sequence.tokens.filter(
    (token) => isSurnameToken(token)
  ).length;
  if (surnameCount === 0) {
    return false;
  }
  const context = getTokenContext(
    tokens,
    sequence.start,
    sequence.end - sequence.start
  );
  if (!context)
    return true;
  const invalidContexts = ["\u770C", "\u5E02", "\u753A", "\u6751", "\u533A", "\u756A\u5730", "\u53F7", "\u4E01\u76EE"];
  const hasInvalidContext = [...context.before, ...context.after].some(
    (token) => invalidContexts.some((invalid) => token.surface.includes(invalid))
  );
  return !hasInvalidContext;
}

// ../redact/src/analyzers/position-anchor.ts
function reanchorPosition(detectedText, approxStart, originalText) {
  const idx = originalText.indexOf(detectedText, approxStart);
  if (idx !== -1)
    return { start: idx, end: idx + detectedText.length };
  const fallback = originalText.indexOf(detectedText);
  if (fallback !== -1) {
    return { start: fallback, end: fallback + detectedText.length };
  }
  return { start: approxStart, end: approxStart + detectedText.length };
}

// ../redact/src/analyzers/detection-pipeline.ts
function hasAddressContextBefore(allTokens, currentIndex) {
  const extendedContextSize = 10;
  const startCheck = Math.max(0, currentIndex - extendedContextSize);
  const endCheck = Math.min(
    allTokens.length,
    currentIndex + extendedContextSize
  );
  const contextText = allTokens.slice(startCheck, endCheck).map((t) => t.surface).join("");
  const jsonApiPatterns = [
    /["'][^"']*["']\s*[:：]\s*/,
    /["'][^"']*Id["']/,
    /["'][^"']*[Kk]ey["']/,
    /["'][^"']*[Tt]oken["']/,
    /["'][^"']*[Hh]ash["']/,
    /["'][^"']*[Cc]ode["']/,
    /["'][^"']*[Uu]uid["']/,
    /["'][^"']*[Cc]ount["']/,
    /["'][^"']*[Dd]ata["']/
  ];
  if (jsonApiPatterns.some((p) => p.test(contextText))) {
    console.log(
      `\u{1F6AB} JSON/API\u30B3\u30F3\u30C6\u30AD\u30B9\u30C8\u306E\u305F\u3081\u4F4F\u6240\u691C\u51FA\u3092\u30B9\u30AD\u30C3\u30D7: "${contextText}"`
    );
    return false;
  }
  const contextSize = 5;
  const startIndex = Math.max(0, currentIndex - contextSize);
  for (let i = startIndex; i < currentIndex; i++) {
    const token = allTokens[i];
    if (!token)
      continue;
    const isPlaceToken = token.poses.length >= 3 && token.poses[0] === "\u540D\u8A5E" && token.poses[1] === "\u56FA\u6709\u540D\u8A5E" && token.poses[2] === "\u5730\u540D";
    const isNumber = /^\d+$/.test(token.surface);
    const adminSuffixes = ["\u770C", "\u5E9C", "\u90FD", "\u9053", "\u5E02", "\u753A", "\u6751", "\u533A"];
    const isAdminSuffix = adminSuffixes.includes(token.surface);
    if (isPlaceToken || isNumber || isAdminSuffix)
      return true;
  }
  return false;
}
function reconstructSplitPlaceNames(allTokens) {
  const reconstructed = [];
  for (let i = 0; i < allTokens.length - 1; i++) {
    const currentToken = allTokens[i];
    const nextToken = allTokens[i + 1];
    if (!currentToken || !nextToken)
      continue;
    if (currentToken.surface.endsWith("\u533A\u9577") && nextToken.surface === "\u753A") {
      const placePart = currentToken.surface.slice(-1);
      if (placePart !== "\u9577")
        continue;
      if (hasAddressContextBefore(allTokens, i)) {
        const placeStart = currentToken.end - 1;
        reconstructed.push({
          text: placePart + nextToken.surface,
          start: placeStart,
          end: nextToken.end,
          type: "place"
        });
      }
    }
  }
  return reconstructed;
}
function runDetectionPipeline(params) {
  const { text, allTokens } = params;
  const names = [];
  const processedTokens = /* @__PURE__ */ new Set();
  const coveredRanges = [];
  const overlapsWithCovered = (s, e) => coveredRanges.some((r) => s < r.end && e > r.start);
  for (const block of findAddressBlocks(allTokens)) {
    const pos = reanchorPosition(block.text, block.start, text);
    names.push({ text: block.text, ...pos, type: "place" });
    block.tokens.forEach((t) => processedTokens.add(t));
    coveredRanges.push(pos);
  }
  for (const compound of findCompoundPlaceNames(allTokens)) {
    if (compound.tokens.some((t) => processedTokens.has(t)))
      continue;
    if (isCompoundPlaceInAddressContext(compound, allTokens)) {
      const pos = reanchorPosition(compound.text, compound.start, text);
      names.push({ text: compound.text, ...pos, type: "place" });
      compound.tokens.forEach((t) => processedTokens.add(t));
    }
  }
  for (const nameSeq of findNameSequences(allTokens)) {
    if (nameSeq.tokens.some((t) => processedTokens.has(t)))
      continue;
    const pos = reanchorPosition(nameSeq.text, nameSeq.start, text);
    names.push({ text: nameSeq.text, ...pos, type: "surname" });
    nameSeq.tokens.forEach((t) => processedTokens.add(t));
  }
  for (const place of reconstructSplitPlaceNames(allTokens)) {
    const pos = reanchorPosition(place.text, place.start, text);
    if (!overlapsWithCovered(pos.start, pos.end)) {
      names.push({ ...place, ...pos });
    }
  }
  return names;
}

// ../redact/src/analyzers/identifier-filter.ts
function filterOutIdentifierPatterns(detectedItems, originalText) {
  return detectedItems.filter((item) => {
    if (!isIdentifierPattern({
      text: item.text,
      start: item.start,
      end: item.end,
      originalText
    })) {
      return true;
    }
    console.log(
      `\u{1F6AB} \u8B58\u5225\u5B50\u3068\u3057\u3066\u9664\u5916: "${item.text}" at ${item.start}-${item.end}`
    );
    return false;
  });
}
function isIdentifierPattern(ctx) {
  const { text, start, end, originalText } = ctx;
  const contextStart = Math.max(0, start - 10);
  const contextEnd = Math.min(originalText.length, end + 10);
  const context = originalText.slice(contextStart, contextEnd);
  return isInJsonXmlContext(context, text) || isInUrlContext(context) || isInCodeContext(context) || isAlphanumericIdentifier(text) || isInEnglishDocumentContext(text, context);
}
function isInJsonXmlContext(context, text) {
  const jsonFieldPattern = new RegExp(
    `["'][^"']*["']\\s*:\\s*["'][^"']*${escapeRegex(text)}[^"']*["']`
  );
  if (jsonFieldPattern.test(context))
    return true;
  const jsonFieldNamePattern = new RegExp(`["']${escapeRegex(text)}["']\\s*:`);
  if (jsonFieldNamePattern.test(context))
    return true;
  const jsonValueInFieldPattern = new RegExp(
    `["'][^"']*${escapeRegex(text)}[^"']*["']\\s*:`
  );
  if (jsonValueInFieldPattern.test(context))
    return true;
  const xmlAttrPattern = new RegExp(
    `\\w+\\s*=\\s*["'][^"']*${escapeRegex(text)}[^"']*["']`
  );
  return xmlAttrPattern.test(context);
}
function isInUrlContext(context) {
  const urlPatterns = [
    /https?:\/\/[^\s]+/,
    /[?&]\w+=[^&\s]+/,
    /\/\w+\/[^\/\s]+/
  ];
  return urlPatterns.some((pattern) => pattern.test(context));
}
function isInCodeContext(context) {
  const codePatterns = [/\w+\s*=\s*[^=]+/, /\w+\([^)]*\)/, /[{};]/, /\$\w+/];
  const strictBracketPatterns = [
    /\[\s*\d+\s*\]/,
    /\[["'][^"']*["']\]/,
    /\w+\[[^\]]+\]/
  ];
  return codePatterns.some((p) => p.test(context)) || strictBracketPatterns.some((p) => p.test(context));
}
function isAlphanumericIdentifier(text) {
  if (!/^[A-Za-z0-9]+$/.test(text))
    return false;
  const identifierPatterns = [
    /^[A-Z][0-9]{2,}$/,
    /^[a-z]{2,}[0-9]{2,}$/,
    /^[A-Z]{2,}[0-9]{2,}$/,
    /^[0-9]{6,}$/,
    /^[A-Fa-f0-9]{8,}$/,
    /^[A-Za-z]+[0-9]+[A-Za-z]*$/
  ];
  return identifierPatterns.some((p) => p.test(text));
}
function isInEnglishDocumentContext(text, context) {
  if (!/^[A-Za-z]+$/.test(text))
    return false;
  if (!/[A-Za-z]{2,}/.test(context))
    return false;
  if (text.toLowerCase() === "page") {
    const beforeText = context.slice(0, context.lastIndexOf(text));
    const afterText = context.slice(context.lastIndexOf(text) + text.length);
    console.log(
      `Debug: Page\u5224\u5B9A: before="${beforeText}", after="${afterText}"`
    );
    const personNameContext = [
      /\b(mr|mrs|ms|miss|dr|prof)\s+\w+\s*$/i,
      /\bcontact\s*:\s*\w+\s*$/i,
      /\b(from|by|signed)\s*:\s*\w+\s*$/i,
      /\b\w+\s*$/
    ];
    const isLikelyPersonName = personNameContext.some((pattern) => {
      const match = pattern.test(beforeText);
      console.log(`  \u30D1\u30BF\u30FC\u30F3 ${pattern} \u2192 ${match}`);
      return match;
    });
    return !isLikelyPersonName;
  }
  return false;
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ../redact/src/detectors.ts
var MASK_TOKEN = "\uFF0A\uFF0A\uFF0A\uFF0A";
function findAllMatches(text, regex, processor) {
  const positions = [];
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    if (processor) {
      const processed = processor(match, text);
      if (processed) {
        positions.push(...processed);
      }
    } else {
      positions.push({
        start: match.index,
        end: match.index + match[0].length,
        original: match[0]
      });
    }
  }
  return positions;
}
function applyMask(text, positions) {
  let masked = text;
  for (let i = positions.length - 1; i >= 0; i--) {
    const pos = positions[i];
    masked = masked.slice(0, pos.start) + MASK_TOKEN + masked.slice(pos.end);
  }
  return masked;
}
function createMaskResult(text, positions) {
  const masked = applyMask(text, positions);
  return { masked, positions };
}
function createPostalRegex() {
  return /(〒\s*)(\d{3}-?\d{4})|(?<!\d-)\b(\d{3}-\d{4})(?!-\d)/g;
}
function processPostalMatch(match) {
  if (match[1] !== void 0) {
    const numberPart2 = match[2];
    const numberStart = match.index + match[1].length;
    return [
      {
        start: numberStart,
        end: numberStart + numberPart2.length,
        original: numberPart2
      }
    ];
  }
  const numberPart = match[3];
  return [
    {
      start: match.index,
      end: match.index + numberPart.length,
      original: numberPart
    }
  ];
}
function maskPostalCode(text) {
  const postalRegex = createPostalRegex();
  const processor = (match) => processPostalMatch(match);
  const positions = findAllMatches(text, postalRegex, processor);
  return createMaskResult(text, positions);
}

// ../redact/src/analyzers/phone-number-detector.ts
var PHONE_PATTERNS = [
  // 国際番号: +1-800-1234-5678, +81-90-1234-5678 等
  String.raw`\+\d{1,3}-\d{1,4}-\d{4}-\d{4}`,
  // 携帯(ハイフン): 090-1234-5678
  String.raw`0[789]0-\d{4}-\d{4}`,
  // 固定 市外2桁+4+4: 03-1234-5678
  String.raw`0[1-9]-\d{4}-\d{4}`,
  // 固定 市外3桁+3+4: 045-123-4567
  String.raw`0\d{2}-\d{3}-\d{4}`,
  // 固定 市外4桁+2+4: 0123-45-6789
  String.raw`0\d{3}-\d{2}-\d{4}`,
  // 固定 市外5桁+1+4: 01234-5-6789
  String.raw`0\d{4}-\d-\d{4}`,
  // 括弧形式: 03(1234)5678, 045(123)4567
  String.raw`0\d{1,4}\(\d{2,4}\)\d{4}`,
  // 携帯 区切りなし 11桁: 09012345678
  String.raw`0[789]0\d{8}`,
  // 固定 区切りなし 10桁: 0312345678
  String.raw`0[1-9]\d{9}`
];
var PHONE_REGEX = new RegExp(
  `(?<![\\d_+\\-])(?:${PHONE_PATTERNS.join("|")})(?![\\d_+\\-])`,
  "g"
);

// src/redact-browser.ts
function maskEmails(text) {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const positions = [];
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    positions.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "email",
      original: match[0]
    });
  }
  return positions;
}
function maskPhones(text) {
  const regex = new RegExp(PHONE_REGEX.source, "g");
  const positions = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    positions.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "phone",
      original: match[0]
    });
  }
  return positions;
}
function luhnCheck(cardNumber) {
  const digits = cardNumber.replace(/\D/g, "").split("").map(Number);
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}
function maskCreditCards(text) {
  const ccRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
  const positions = [];
  let match;
  while ((match = ccRegex.exec(text)) !== null) {
    const cardNumber = match[0].replace(/[\s\-]/g, "");
    if (cardNumber.length === 16 && luhnCheck(cardNumber)) {
      positions.push({
        start: match.index,
        end: match.index + match[0].length,
        type: "creditCard",
        original: match[0]
      });
    }
  }
  return positions;
}
function myNumberCheck(myNumber) {
  const digits = myNumber.split("").map(Number);
  if (digits.length !== 12)
    return false;
  const weights = [6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }
  const remainder = sum % 11;
  const checkDigit = remainder <= 1 ? 0 : 11 - remainder;
  return checkDigit === digits[11];
}
function maskMyNumbers(text) {
  const myNumberRegex = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
  const positions = [];
  let match;
  while ((match = myNumberRegex.exec(text)) !== null) {
    const myNumber = match[0].replace(/[\s\-]/g, "");
    if (myNumber.length === 12 && myNumberCheck(myNumber)) {
      positions.push({
        start: match.index,
        end: match.index + match[0].length,
        type: "myNumber",
        original: match[0]
      });
    }
  }
  return positions;
}
async function redact(text, options = {}) {
  const {
    maskEmails: shouldMaskEmails = true,
    maskPhones: shouldMaskPhones = true,
    maskPostalCodes: shouldMaskPostalCodes = true,
    maskCreditCards: shouldMaskCreditCards = true,
    maskMyNumbers: shouldMaskMyNumbers = true
  } = options;
  const positions = [];
  if (shouldMaskEmails) {
    positions.push(...maskEmails(text));
  }
  if (shouldMaskPhones) {
    positions.push(...maskPhones(text));
  }
  if (shouldMaskPostalCodes) {
    maskPostalCode(text).positions.forEach(
      (p) => positions.push({ ...p, type: "postalCode" })
    );
  }
  if (shouldMaskCreditCards) {
    positions.push(...maskCreditCards(text));
  }
  if (shouldMaskMyNumbers) {
    positions.push(...maskMyNumbers(text));
  }
  positions.sort((a, b) => b.start - a.start);
  let maskedText = text;
  for (const pos of positions) {
    maskedText = maskedText.slice(0, pos.start) + "\uFF0A\uFF0A\uFF0A\uFF0A" + maskedText.slice(pos.end);
  }
  positions.sort((a, b) => a.start - b.start);
  return {
    original: text,
    masked: maskedText,
    positions
  };
}
async function initializeNameDetector() {
}

// src/position.ts
function hasOverlap(pos1, pos2) {
  return pos1.start >= pos2.start && pos1.start < pos2.end || pos1.end > pos2.start && pos1.end <= pos2.end || pos1.start <= pos2.start && pos1.end >= pos2.end;
}
function checkOverlapWithAny(newPos, existingPositions) {
  return existingPositions.some((pos) => hasOverlap(newPos, pos));
}
function sortPositionsForDisplay(positions) {
  return [...positions].sort((a, b) => a.start - b.start);
}
function sortPositionsForReplacement(positions) {
  return [...positions].sort((a, b) => b.start - a.start);
}

// src/mask-applier.ts
function applyMasksToText(originalText, positions, unmaskedPositions) {
  const sortedPositions = sortPositionsForReplacement(positions);
  let text = originalText;
  for (const pos of sortedPositions) {
    const tokenId = `${pos.start}-${pos.end}`;
    if (!unmaskedPositions.has(tokenId)) {
      text = text.slice(0, pos.start) + "\uFF0A\uFF0A\uFF0A\uFF0A" + text.slice(pos.end);
    }
  }
  return text;
}
function splitSelectionByNewlines(originalText, start, end) {
  const selected = originalText.slice(start, end);
  const result = [];
  let cursor = start;
  for (const line of selected.split("\n")) {
    const segStart = cursor;
    const segEnd = cursor + line.length;
    cursor = segEnd + 1;
    if (line.trim().length === 0)
      continue;
    result.push({ start: segStart, end: segEnd, original: line });
  }
  return result;
}
function findAllOccurrences(text, needle) {
  if (needle.length === 0)
    return [];
  const result = [];
  let idx = 0;
  while (idx <= text.length - needle.length) {
    const found = text.indexOf(needle, idx);
    if (found === -1)
      break;
    result.push(found);
    idx = found + needle.length;
  }
  return result;
}

// src/position-calculator.ts
function getCaretPositionFromPoint(x, y) {
  if (typeof document.caretPositionFromPoint === "function") {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos)
      return null;
    return { node: pos.offsetNode, offset: pos.offset };
  }
  const doc = document;
  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y);
    if (!range)
      return null;
    return {
      node: range.startContainer,
      offset: range.startOffset
    };
  }
  return null;
}
function parseTokenId(tokenId) {
  const dash = tokenId.lastIndexOf("-");
  if (dash < 0)
    return [0, 0];
  const start = parseInt(tokenId.slice(0, dash), 10);
  const end = parseInt(tokenId.slice(dash + 1), 10);
  return [isNaN(start) ? 0 : start, isNaN(end) ? 0 : end];
}
function findOriginalOffset(targetNode, targetOffset, maskedDisplay) {
  let origCursor = 0;
  let result = null;
  function visit(node) {
    if (result !== null)
      return;
    if (node.nodeType === Node.TEXT_NODE) {
      const parentEl = node.parentElement;
      const maskedEl = parentEl?.classList.contains("masked-token") ? parentEl : null;
      if (node === targetNode) {
        if (maskedEl) {
          const [start] = parseTokenId(maskedEl.dataset.tokenId ?? "");
          const isUnmasked = maskedEl.classList.contains("original");
          result = isUnmasked ? start + targetOffset : start;
        } else {
          result = origCursor + targetOffset;
        }
        return;
      }
      if (maskedEl) {
        const [, end] = parseTokenId(maskedEl.dataset.tokenId ?? "");
        origCursor = end;
      } else {
        origCursor += node.textContent?.length ?? 0;
      }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node === targetNode) {
        const children = Array.from(node.childNodes);
        for (let i = 0; i < children.length; i++) {
          if (i === targetOffset) {
            result = origCursor;
            return;
          }
          visit(children[i]);
          if (result !== null)
            return;
        }
        result = origCursor;
        return;
      }
      for (const child of Array.from(node.childNodes)) {
        visit(child);
        if (result !== null)
          return;
      }
    }
  }
  for (const child of Array.from(maskedDisplay.childNodes)) {
    visit(child);
    if (result !== null)
      break;
  }
  return result ?? origCursor;
}
function calculateSelectionPositions(range, maskedDisplay) {
  const start = findOriginalOffset(
    range.startContainer,
    range.startOffset,
    maskedDisplay
  );
  const end = findOriginalOffset(
    range.endContainer,
    range.endOffset,
    maskedDisplay
  );
  if (start > end)
    return null;
  return { start, end };
}

// src/html-renderer.ts
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function renderMaskedDisplay(originalText, positions, unmaskedPositions) {
  let html = "";
  let lastIndex = 0;
  const sortedPositions = sortPositionsForDisplay(positions);
  for (const pos of sortedPositions) {
    if (pos.start < lastIndex)
      continue;
    html += escapeHtml(originalText.slice(lastIndex, pos.start));
    const tokenId = `${pos.start}-${pos.end}`;
    const isUnmasked = unmaskedPositions.has(tokenId);
    const className = isUnmasked ? "masked-token original" : "masked-token";
    const content = isUnmasked ? pos.original : "\uFF0A\uFF0A\uFF0A\uFF0A";
    html += `<span class="${className}" data-token-id="${tokenId}">${escapeHtml(content)}</span>`;
    lastIndex = pos.end;
  }
  html += escapeHtml(originalText.slice(lastIndex));
  return html;
}

// src/loaders/download-utils.ts
async function streamDownload(options) {
  const {
    url,
    controller,
    onProgress,
    minSpeedMBps = 0.5,
    speedCheckInterval = 1e4
  } = options;
  console.log(`Network: Fetching: ${url}`);
  const startTime = Date.now();
  const response = await fetch(url, { signal: controller.signal });
  console.log(
    `Network: Response status: ${response.status}, ok: ${response.ok}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const contentLength = response.headers.get("content-length");
  const totalLength = contentLength ? parseInt(contentLength, 10) : void 0;
  console.log("Download: Starting streaming download...");
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body reader not available");
  }
  const chunks = [];
  let receivedLength = 0;
  let speedCheckTimeout;
  const updateSpeedCheck = () => {
    clearTimeout(speedCheckTimeout);
    speedCheckTimeout = setTimeout(() => {
      const elapsed = (Date.now() - startTime) / 1e3;
      const speedMBps = receivedLength / 1024 / 1024 / elapsed;
      if (speedMBps < minSpeedMBps) {
        controller.abort();
        console.log(
          `Warning: Download speed too slow (${speedMBps.toFixed(
            2
          )}MB/s) - falling back`
        );
      }
    }, speedCheckInterval);
  };
  updateSpeedCheck();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done)
        break;
      chunks.push(value);
      receivedLength += value.length;
      if (onProgress) {
        const elapsed = (Date.now() - startTime) / 1e3;
        const speedMBps = receivedLength / 1024 / 1024 / elapsed;
        onProgress(
          totalLength !== void 0 ? { receivedLength, totalLength, speedMBps } : { receivedLength, speedMBps }
        );
      }
      if (receivedLength % (1024 * 1024) === 0 || chunks.length % 100 === 0) {
        console.log(
          `Download: Download progress: ${Math.round(receivedLength / 1024 / 1024)}MB`
        );
      }
    }
  } finally {
    clearTimeout(speedCheckTimeout);
  }
  console.log("\u{1F517} Combining chunks...");
  const result = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }
  console.log(
    `\u{1F4E6} File download complete: ${Math.round(result.byteLength / 1024 / 1024)}MB`
  );
  return result;
}

// src/loaders/sudachi-utils.ts
var sudachiWorker = null;
var directModeReady = false;
function initSudachiWorker(compressedData, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./sudachi-worker.js", { type: "module" });
    worker.onmessage = (e) => {
      if (e.data.type === "decompressed") {
        onProgress?.(0.9);
      } else if (e.data.type === "ready") {
        sudachiWorker = worker;
        onProgress?.(1);
        resolve();
      } else if (e.data.type === "error") {
        worker.terminate();
        reject(new Error(e.data.message));
      }
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message));
    };
    worker.postMessage({ type: "init", data: compressedData }, [
      compressedData.buffer
    ]);
  });
}
function tokenize(text) {
  if (sudachiWorker) {
    return tokenizeViaWorker(text);
  }
  if (directModeReady) {
    return tokenizeDirectly(text);
  }
  return Promise.reject(new Error("Sudachi not initialized"));
}
function tokenizeViaWorker(text) {
  const worker = sudachiWorker;
  return new Promise((resolve, reject) => {
    const handler = (e) => {
      if (e.data.type === "tokenized") {
        worker.removeEventListener("message", handler);
        resolve(e.data.json);
      } else if (e.data.type === "error") {
        worker.removeEventListener("message", handler);
        reject(new Error(e.data.message));
      }
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ type: "tokenize", text });
  });
}
function tokenizeDirectly(text) {
  try {
    const bridge = getSudachiModule();
    const json = bridge.tokenize(text, bridge.TokenizeMode.C);
    return Promise.resolve(json);
  } catch (error) {
    return Promise.reject(error);
  }
}
function getSudachiModule() {
  const bridge = globalThis.SudachiBridge;
  if (!bridge)
    throw new Error("Sudachi module is not loaded");
  return bridge;
}
function isSudachiLoaded() {
  return sudachiWorker !== null || directModeReady;
}

// src/loaders/brotli-loader.ts
var isLoading = false;
var isLoaded = false;
async function loadBrotliSudachi(onProgress) {
  if (isLoaded && isSudachiLoaded()) {
    return true;
  }
  if (isLoading) {
    await waitForLoad();
    return isLoaded;
  }
  try {
    isLoading = true;
    console.log("Loading: Downloading Brotli-compressed Sudachi dictionary...");
    const compressedData = await downloadBrotliBundle(
      (p) => onProgress?.(p * 0.7)
    );
    await initSudachiWorker(compressedData, onProgress);
    console.log(
      "Success: Brotli-compressed Sudachi dictionary loading complete"
    );
    isLoaded = true;
    return true;
  } catch (error) {
    console.error(
      "Error: Failed to load Brotli-compressed Sudachi dictionary:",
      error
    );
    return false;
  } finally {
    isLoading = false;
  }
}
async function downloadBrotliBundle(onProgress) {
  const controller = new AbortController();
  return await streamDownload({
    url: "./sudachi-bundle.js.br",
    controller,
    onProgress: (p) => {
      if (p.totalLength) {
        onProgress?.(p.receivedLength / p.totalLength);
      }
    },
    minSpeedMBps: 0.5,
    speedCheckInterval: 1e4
  });
}
async function waitForLoad() {
  while (isLoading) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// src/sudachi-integration.ts
var sudachiReady = false;
async function initSudachi(onProgress) {
  try {
    console.log("Loading: Initializing Sudachi morphological analyzer...");
    console.log("Info: Calling loadBrotliSudachi()...");
    const loadSuccess = await loadBrotliSudachi(onProgress);
    console.log(`Info: loadBrotliSudachi() result: ${loadSuccess}`);
    if (!loadSuccess) {
      console.error("Error: loadBrotliSudachi() failed");
      throw new Error("Sudachi module loading failed");
    }
    console.log("\u{1F9EA} Starting Sudachi operation test...");
    const testJson = await tokenize("\u30C6\u30B9\u30C8");
    console.log(`\u{1F9EA} tokenize result JSON: ${testJson.substring(0, 200)}...`);
    const testTokens = JSON.parse(testJson);
    console.log(`\u{1F9EA} Parsed token count: ${testTokens ? testTokens.length : 0}`);
    if (testTokens && testTokens.length > 0) {
      console.log(`\u{1F9EA} First token: ${JSON.stringify(testTokens[0])}`);
      sudachiReady = true;
      console.log(
        "Success: Sudachi morphological analyzer initialization complete"
      );
      return true;
    } else {
      throw new Error("Sudachi test failed: no tokens returned");
    }
  } catch (error) {
    console.error("Error: Sudachi initialization error:", error);
    console.error(
      "Error: Error stack:",
      error instanceof Error ? error.stack : "No stack info"
    );
    sudachiReady = false;
    return false;
  }
}
async function analyzeMorphology(text) {
  if (!sudachiReady) {
    console.warn("Warning: Sudachi not initialized");
    return { original: text, names: [], allTokens: [] };
  }
  try {
    const json = await tokenize(text);
    const allTokens = parseSudachiTokens(json);
    const detectedItems = runDetectionPipeline({ text, allTokens });
    console.log("Debug: Detection process details:");
    if (detectedItems.length > 0) {
      console.log(`Stats: Initial detection: ${detectedItems.length} items`);
      detectedItems.forEach((item, i) => {
        console.log(
          `  ${i + 1}. "${item.text}" (${item.type}) at ${item.start}-${item.end}`
        );
      });
    } else {
      console.log("Stats: Initial detection: 0 items");
    }
    const filteredNames = filterOutIdentifierPatterns(detectedItems, text);
    const excludedCount = detectedItems.length - filteredNames.length;
    if (excludedCount > 0) {
      console.log(`\u{1F6AB} Filtered out: ${excludedCount} items`);
    }
    console.log(`Success: Final result: ${filteredNames.length} items`);
    return { original: text, names: filteredNames, allTokens };
  } catch (error) {
    console.error("Error: Sudachi analysis error:", error);
    return { original: text, names: [], allTokens: [] };
  }
}

// src/app-state.ts
function createInitialState() {
  return {
    originalText: "",
    positions: [],
    manualMasks: [],
    unmaskedPositions: /* @__PURE__ */ new Set()
  };
}

// src/ui-visibility.ts
function updateUIVisibility(params) {
  const { elements, uiState, isSudachiLoading } = params;
  elements.loadingIndicator.style.display = isSudachiLoading ? "block" : "none";
  switch (uiState) {
    case "initial" /* Initial */:
      elements.maskControls.style.display = "flex";
      elements.maskButtonSticky.disabled = true;
      elements.maskButton.style.display = "";
      elements.maskButton.disabled = true;
      elements.maskButton.textContent = "\u30DE\u30B9\u30AF";
      elements.backToInputButton.style.display = "none";
      elements.copyButtonTop.disabled = false;
      elements.copyButtonTop.className = "copy-button-subtle";
      elements.originalContent.style.display = "block";
      elements.maskedContent.style.display = "none";
      elements.helpMessage.style.display = "none";
      elements.outputControls.style.display = "none";
      break;
    case "input-ready" /* InputReady */:
      elements.maskControls.style.display = "flex";
      elements.maskButtonSticky.disabled = false;
      elements.maskButton.style.display = "";
      elements.maskButton.disabled = false;
      elements.maskButton.textContent = "\u30DE\u30B9\u30AF";
      elements.backToInputButton.style.display = "none";
      elements.copyButtonTop.disabled = false;
      elements.copyButtonTop.className = "copy-button-subtle";
      elements.originalContent.style.display = "block";
      elements.maskedContent.style.display = "none";
      elements.helpMessage.style.display = "none";
      elements.outputControls.style.display = "none";
      break;
    case "masked" /* Masked */:
      elements.maskControls.style.display = "none";
      elements.maskButton.style.display = "none";
      elements.backToInputButton.style.display = "";
      elements.copyButtonTop.disabled = false;
      elements.copyButtonTop.className = "copy-button";
      elements.originalContent.style.display = "none";
      elements.maskedContent.style.display = "block";
      elements.helpMessage.style.display = "block";
      elements.outputControls.style.display = "flex";
      break;
  }
}
function setLoadingProgress(elements, ratio) {
  const pct = Math.min(100, Math.round(ratio * 100));
  elements.progressBar.style.width = `${pct}%`;
}
function showDownloadComplete(elements) {
  elements.loadingEllipsis.style.display = "none";
  elements.loadingText.textContent = "\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u5B8C\u4E86";
  elements.progressBar.style.width = "100%";
}
function showError(elements, message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.style.display = "block";
  setTimeout(() => {
    elements.errorMessage.style.display = "none";
  }, 3e3);
}

// src/mask-ops.ts
function removePositionByTokenId(tokenId, state) {
  state.unmaskedPositions.delete(tokenId);
  state.positions = state.positions.filter(
    (p) => `${p.start}-${p.end}` !== tokenId
  );
  state.manualMasks = state.manualMasks.filter(
    (p) => `${p.start}-${p.end}` !== tokenId
  );
}
function findExactMask(start, end, state) {
  return [...state.positions, ...state.manualMasks].find(
    (p) => p.start === start && p.end === end
  );
}
function findOverlappingMasks(start, end, state) {
  const range = { start, end, original: "" };
  return [...state.positions, ...state.manualMasks].filter(
    (p) => hasOverlap(range, p)
  );
}
function findUnmaskedOverlapping(start, end, state) {
  const drag = { start, end, original: "" };
  return [...state.positions, ...state.manualMasks].filter((pos) => {
    const tokenId = `${pos.start}-${pos.end}`;
    return state.unmaskedPositions.has(tokenId) && hasOverlap(drag, pos);
  });
}
function splitMaskAround(params) {
  const { pos, holeStart, holeEnd, state } = params;
  removePositionByTokenId(`${pos.start}-${pos.end}`, state);
  if (pos.start < holeStart) {
    state.manualMasks.push({
      start: pos.start,
      end: holeStart,
      original: state.originalText.slice(pos.start, holeStart)
    });
  }
  if (holeEnd < pos.end) {
    state.manualMasks.push({
      start: holeEnd,
      end: pos.end,
      original: state.originalText.slice(holeEnd, pos.end)
    });
  }
}
function propagateMask(params) {
  const { text, skipStart, state } = params;
  const occurrences = findAllOccurrences(state.originalText, text);
  let changed = false;
  for (const occStart of occurrences) {
    const occEnd = occStart + text.length;
    if (occStart === skipStart)
      continue;
    const exactMask = findExactMask(occStart, occEnd, state);
    if (exactMask) {
      const tokenId = `${occStart}-${occEnd}`;
      if (state.unmaskedPositions.has(tokenId)) {
        state.unmaskedPositions.delete(tokenId);
        changed = true;
      }
      continue;
    }
    const overlapping = findOverlappingMasks(occStart, occEnd, state);
    for (const overlap of overlapping) {
      splitMaskAround({
        pos: overlap,
        holeStart: occStart,
        holeEnd: occEnd,
        state
      });
    }
    state.manualMasks.push({ start: occStart, end: occEnd, original: text });
    changed = true;
  }
  return changed;
}
function propagateUnmask(text, state) {
  for (const occStart of findAllOccurrences(state.originalText, text)) {
    const occEnd = occStart + text.length;
    if (findExactMask(occStart, occEnd, state)) {
      state.unmaskedPositions.add(`${occStart}-${occEnd}`);
    }
  }
}
function propagateRemask(text, state) {
  for (const occStart of findAllOccurrences(state.originalText, text)) {
    state.unmaskedPositions.delete(`${occStart}-${occStart + text.length}`);
  }
}
function buildMaskedText(state) {
  return applyMasksToText(
    state.originalText,
    [...state.positions, ...state.manualMasks],
    state.unmaskedPositions
  );
}
function addManualMask(params) {
  const { start, end, state } = params;
  const unmaskedOverlap = findUnmaskedOverlapping(start, end, state);
  for (const pos of unmaskedOverlap) {
    removePositionByTokenId(`${pos.start}-${pos.end}`, state);
  }
  const segments = splitSelectionByNewlines(state.originalText, start, end);
  let changed = unmaskedOverlap.length > 0;
  for (const segment of segments) {
    const allExistingMasks = [...state.positions, ...state.manualMasks];
    if (checkOverlapWithAny(segment, allExistingMasks))
      continue;
    state.manualMasks.push(segment);
    changed = true;
    propagateMask({ text: segment.original, skipStart: segment.start, state });
  }
  return changed;
}

// src/main.ts
var RedactApp = class {
  state = createInitialState();
  uiState = "initial" /* Initial */;
  elements = {
    inputText: document.getElementById("inputText"),
    maskButton: document.getElementById("maskButton"),
    clearButton: document.getElementById("clearButton"),
    backToInputButton: document.getElementById(
      "backToInputButton"
    ),
    copyButton: document.getElementById("copyButton"),
    copyButtonTop: document.getElementById(
      "copyButtonTop"
    ),
    copyAndClearButton: document.getElementById(
      "copyAndClearButton"
    ),
    originalContent: document.getElementById(
      "originalContent"
    ),
    maskedContent: document.getElementById("maskedContent"),
    maskedDisplay: document.getElementById("maskedDisplay"),
    errorMessage: document.getElementById("errorMessage"),
    headerControls: document.getElementById("headerControls"),
    maskControls: document.getElementById("maskControls"),
    maskButtonSticky: document.getElementById(
      "maskButtonSticky"
    ),
    helpMessage: document.getElementById("helpMessage"),
    outputControls: document.getElementById("outputControls"),
    loadingIndicator: document.getElementById(
      "loadingIndicator"
    ),
    progressBar: document.getElementById("progressBar"),
    loadingText: document.getElementById("loadingText"),
    loadingEllipsis: document.getElementById(
      "loadingEllipsis"
    )
  };
  isNameDetectorReady = false;
  isSudachiReady = false;
  isSudachiLoading = true;
  /** マスクボタンがロード完了前に押された場合の保留フラグ */
  pendingMask = false;
  /** Drag start position recorded on mousedown via caretPositionFromPoint */
  dragStart = null;
  constructor() {
    this.initializeEventListeners();
    this.initializeNameDetector();
    this.initializeSudachi();
    this.initializeTextareaAutoResize();
    this.elements.inputText.focus();
  }
  async initializeNameDetector() {
    try {
      await initializeNameDetector();
      this.isNameDetectorReady = true;
    } catch (error) {
      console.warn("Name detector initialization failed:", error);
    }
  }
  async initializeSudachi() {
    this.updateUIVisibility();
    try {
      this.isSudachiReady = await initSudachi(
        (r) => setLoadingProgress(this.elements, r)
      );
      if (this.isSudachiReady) {
        console.log(
          "Success: Sudachi morphological analyzer is now available in Web UI"
        );
        showDownloadComplete(this.elements);
      }
    } catch (error) {
      console.warn("Warning: Sudachi initialization failed:", error);
      this.isSudachiReady = false;
    } finally {
      this.isSudachiLoading = false;
      this.updateUIVisibility();
      if (this.pendingMask) {
        this.pendingMask = false;
        await this.handleMask();
      }
    }
    if (this.isSudachiReady) {
      await new Promise((resolve) => setTimeout(resolve, 3e3));
    }
  }
  initializeEventListeners() {
    this.elements.maskButton.addEventListener("click", () => this.handleMask());
    this.elements.maskButtonSticky.addEventListener(
      "click",
      () => this.handleMask()
    );
    this.elements.clearButton.addEventListener(
      "click",
      () => this.handleClear()
    );
    this.elements.backToInputButton.addEventListener(
      "click",
      () => this.handleBackToInput()
    );
    this.elements.copyButton.addEventListener("click", () => this.handleCopy());
    this.elements.copyButtonTop.addEventListener(
      "click",
      () => this.handleCopy()
    );
    this.elements.copyAndClearButton.addEventListener(
      "click",
      () => this.handleCopyAndClear()
    );
    this.elements.maskedDisplay.addEventListener("mousedown", (e) => {
      this.dragStart = getCaretPositionFromPoint(e.clientX, e.clientY);
    });
    this.elements.maskedDisplay.addEventListener(
      "mouseup",
      (e) => this.handleSelection(e)
    );
    this.elements.maskedDisplay.addEventListener(
      "click",
      (e) => this.handleMaskClick(e)
    );
    this.elements.inputText.addEventListener("input", () => {
      this.handleInputChange();
    });
  }
  initializeTextareaAutoResize() {
    this.resizeTextarea();
    this.elements.inputText.addEventListener("input", () => {
      this.resizeTextarea();
    });
  }
  resizeTextarea() {
    const textarea = this.elements.inputText;
    textarea.style.height = "auto";
    textarea.style.height = Math.max(200, textarea.scrollHeight) + "px";
  }
  updateUIVisibility() {
    updateUIVisibility({
      elements: this.elements,
      uiState: this.uiState,
      isSudachiLoading: this.isSudachiLoading
    });
  }
  setUIState(newState) {
    console.log("Setting UI state:", newState);
    this.uiState = newState;
    this.updateUIVisibility();
  }
  async handleMask() {
    const text = this.elements.inputText.value.trim();
    if (!text) {
      showError(this.elements, "\u30DE\u30B9\u30AF\u3057\u305F\u3044\u6587\u7AE0\u3092\u8CBC\u308A\u4ED8\u3051\u3066\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    if (this.isSudachiLoading) {
      this.pendingMask = true;
      this.elements.maskButton.disabled = true;
      this.elements.maskButton.textContent = "\u6E96\u5099\u5B8C\u4E86\u5F8C\u3001\u81EA\u52D5\u7684\u306B\u30DE\u30B9\u30AF\u3057\u307E\u3059";
      this.elements.maskButtonSticky.disabled = true;
      this.elements.maskButtonSticky.textContent = "\u6E96\u5099\u5B8C\u4E86\u5F8C\u3001\u81EA\u52D5\u7684\u306B\u30DE\u30B9\u30AF\u3057\u307E\u3059";
      return;
    }
    this.elements.maskButton.disabled = true;
    this.elements.maskButton.textContent = "\u30DE\u30B9\u30AF\u4E2D...";
    this.elements.maskButtonSticky.disabled = true;
    this.elements.maskButtonSticky.textContent = "\u30DE\u30B9\u30AF\u4E2D...";
    try {
      const result = await redact(text);
      const positions = this.isSudachiReady ? await this.mergeWithSudachi(text, result) : result.positions;
      this.state = {
        originalText: text,
        positions,
        manualMasks: [],
        unmaskedPositions: /* @__PURE__ */ new Set()
      };
      this.updateDisplay();
      this.setUIState("masked" /* Masked */);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Masking failed:", error);
      showError(this.elements, "\u30DE\u30B9\u30AF\u51E6\u7406\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002");
    } finally {
      this.elements.maskButton.disabled = false;
      this.elements.maskButton.textContent = "\u30DE\u30B9\u30AF";
      this.elements.maskButtonSticky.disabled = false;
      this.elements.maskButtonSticky.textContent = "\u30DE\u30B9\u30AF\u3059\u308B";
    }
  }
  async mergeWithSudachi(text, result) {
    const morphAnalysis = await analyzeMorphology(text);
    if (morphAnalysis.names.length > 0 || morphAnalysis.allTokens.length > 10) {
      console.group("Debug: Sudachi morphological analysis results");
      console.log("Info: Detected person names:", morphAnalysis.names);
      console.log("Info: Total token count:", morphAnalysis.allTokens.length);
      morphAnalysis.allTokens.forEach((token) => {
        const isName = token.poses.length >= 3 && token.poses[0] === "\u540D\u8A5E" && token.poses[1] === "\u56FA\u6709\u540D\u8A5E" && token.poses[2] === "\u4EBA\u540D";
        if (isName) {
          console.log(`\u{1F464} ${token.surface} [${token.poses.join(", ")}]`);
        }
      });
      console.groupEnd();
    }
    const sudachiNames = morphAnalysis.names.flatMap((name) => {
      const type = name.type === "place" ? "place" : "name";
      return splitSelectionByNewlines(text, name.start, name.end).map((seg) => ({
        start: seg.start,
        end: seg.end,
        original: seg.original,
        type
      }));
    });
    const combined = [...result.positions];
    for (const name of sudachiNames) {
      const isDuplicate = result.positions.some(
        (p) => p.start === name.start && p.end === name.end
      );
      if (!isDuplicate) {
        combined.push(name);
        console.log(
          `Info: Sudachi additional detection: "${name.original}" at ${name.start}-${name.end}`
        );
      }
    }
    return combined;
  }
  handleInputChange() {
    const hasText = this.elements.inputText.value.trim().length > 0;
    console.log("Input changed:", hasText, "Current state:", this.uiState);
    if (hasText && this.uiState === "initial" /* Initial */) {
      this.setUIState("input-ready" /* InputReady */);
    } else if (!hasText && this.uiState === "input-ready" /* InputReady */) {
      this.setUIState("initial" /* Initial */);
    }
  }
  handleBackToInput() {
    this.state = {
      ...createInitialState(),
      originalText: this.state.originalText
    };
    this.elements.maskedDisplay.innerHTML = "";
    this.setUIState("input-ready" /* InputReady */);
  }
  handleClear() {
    this.elements.inputText.value = "";
    this.state = createInitialState();
    this.elements.maskedDisplay.innerHTML = "";
    this.resizeTextarea();
    this.setUIState("initial" /* Initial */);
    this.elements.inputText.focus();
  }
  async handleCopy() {
    const textToCopy = this.uiState === "masked" /* Masked */ ? buildMaskedText(this.state) : this.elements.inputText.value;
    try {
      await navigator.clipboard.writeText(textToCopy);
      const originalBottomText = this.elements.copyButton.textContent;
      const originalTopText = this.elements.copyButtonTop.textContent;
      this.elements.copyButton.textContent = "\u30B3\u30D4\u30FC\u5B8C\u4E86\uFF01";
      this.elements.copyButtonTop.textContent = "\u30B3\u30D4\u30FC\u5B8C\u4E86\uFF01";
      setTimeout(() => {
        this.elements.copyButton.textContent = originalBottomText;
        this.elements.copyButtonTop.textContent = originalTopText;
      }, 1e3);
    } catch {
      showError(
        this.elements,
        "\u81EA\u52D5\u30B3\u30D4\u30FC\u304C\u7121\u52B9\u3067\u3059\u3002\u8868\u793A\u4E2D\u306E\u7D50\u679C\u3092\u9078\u629E\u3057\u3066\u3001\u624B\u52D5\u3067\u30B3\u30D4\u30FC\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
      );
    }
  }
  async handleCopyAndClear() {
    try {
      await navigator.clipboard.writeText(buildMaskedText(this.state));
    } catch {
      showError(
        this.elements,
        "\u81EA\u52D5\u30B3\u30D4\u30FC\u304C\u7121\u52B9\u3067\u3059\u3002\u8868\u793A\u4E2D\u306E\u7D50\u679C\u3092\u9078\u629E\u3057\u3066\u3001\u624B\u52D5\u3067\u30B3\u30D4\u30FC\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
      );
      return;
    }
    this.handleClear();
  }
  handleSelection(e) {
    const endPos = getCaretPositionFromPoint(e.clientX, e.clientY);
    let positions = null;
    if (this.dragStart && endPos) {
      try {
        const range = document.createRange();
        range.setStart(this.dragStart.node, this.dragStart.offset);
        range.setEnd(endPos.node, endPos.offset);
        if (range.collapsed) {
          range.setStart(endPos.node, endPos.offset);
          range.setEnd(this.dragStart.node, this.dragStart.offset);
        }
        positions = calculateSelectionPositions(
          range,
          this.elements.maskedDisplay
        );
      } catch {
      }
    }
    if (!positions) {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        this.dragStart = null;
        return;
      }
      const range = selection.getRangeAt(0);
      positions = calculateSelectionPositions(
        range,
        this.elements.maskedDisplay
      );
    }
    this.dragStart = null;
    if (!positions || positions.start === positions.end) {
      window.getSelection()?.removeAllRanges();
      return;
    }
    const changed = addManualMask({
      start: positions.start,
      end: positions.end,
      state: this.state
    });
    if (changed)
      this.updateDisplay();
    window.getSelection()?.removeAllRanges();
  }
  handleMaskClick(e) {
    const target = e.target;
    if (!target.classList.contains("masked-token"))
      return;
    const tokenId = target.dataset.tokenId;
    if (!tokenId)
      return;
    const all = [...this.state.positions, ...this.state.manualMasks];
    const pos = all.find((p) => `${p.start}-${p.end}` === tokenId);
    if (this.state.unmaskedPositions.has(tokenId)) {
      if (pos) {
        const text = this.state.originalText.slice(pos.start, pos.end);
        propagateRemask(text, this.state);
      } else {
        this.state.unmaskedPositions.delete(tokenId);
      }
    } else {
      this.state.unmaskedPositions.add(tokenId);
      if (pos) {
        const text = this.state.originalText.slice(pos.start, pos.end);
        propagateUnmask(text, this.state);
      }
    }
    this.updateDisplay();
  }
  updateDisplay() {
    const allPositions = [...this.state.positions, ...this.state.manualMasks];
    const html = renderMaskedDisplay(
      this.state.originalText,
      allPositions,
      this.state.unmaskedPositions
    );
    this.elements.maskedDisplay.innerHTML = html;
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new RedactApp());
} else {
  new RedactApp();
}
//# sourceMappingURL=main.js.map
