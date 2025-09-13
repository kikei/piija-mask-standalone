#!/usr/bin/env tsx
// 形態素解析＋マスク検出デバッグスクリプト
// 使用法: npm run analyze "解析したい文章"
import { TokenizeMode, tokenize as sudachiTokenize } from 'sudachi';
import {
  TokenSequenceAnalyzer,
  findNameSequences,
  filterOutIdentifierPatterns,
  reanchorPosition,
  type SudachiToken,
} from '@redactjp/redact';

const text = process.argv.slice(2).join(' ');

if (!text) {
  console.error('使用法: npm run analyze "解析したい文章"');
  process.exit(1);
}

// ── 1. 形態素解析 ────────────────────────────────────────
const json = sudachiTokenize(text, TokenizeMode.C);
const rawTokens: Array<{ surface: string; poses: string[] }> = JSON.parse(json);

let offset = 0;
const allTokens: SudachiToken[] = rawTokens.map(t => {
  const token: SudachiToken = {
    surface: t.surface,
    poses: t.poses,
    start: offset,
    end: offset + t.surface.length,
  };
  offset += t.surface.length;
  return token;
});

console.log(`\n📝 "${text}"\n`);

// ── 2. 全トークン表示 ────────────────────────────────────
console.log('🔤 全トークン:');
for (const t of allTokens) {
  const isPerson = t.poses[2] === '人名';
  const isPlace = t.poses[2] === '地名';
  const mark = isPerson ? '👤' : isPlace ? '🏠' : '  ';
  console.log(
    `  ${mark} "${t.surface}" [${t.poses.join(', ')}] @${t.start}-${t.end}`
  );
}
console.log('');

// ── 3. 検出パイプライン ──────────────────────────────────
const analyzer = new TokenSequenceAnalyzer(allTokens);
const processedTokens = new Set<SudachiToken>();
const names: Array<{
  text: string;
  start: number;
  end: number;
  type: 'surname' | 'given_name' | 'place';
}> = [];

const reanchor = (d: string, a: number) => reanchorPosition(d, a, text);

// 住所ブロック検出
for (const block of analyzer.findAddressBlocks()) {
  const pos = reanchor(block.text, block.start);
  names.push({ text: block.text, ...pos, type: 'place' });
  block.tokens.forEach(t => processedTokens.add(t));
}

// 複合地名検出
for (const compound of analyzer.findCompoundPlaceNames()) {
  if (compound.tokens.some(t => processedTokens.has(t))) continue;
  if (analyzer.isCompoundPlaceInAddressContext(compound)) {
    const pos = reanchor(compound.text, compound.start);
    names.push({ text: compound.text, ...pos, type: 'place' });
    compound.tokens.forEach(t => processedTokens.add(t));
  }
}

// 人名シーケンス検出
for (const seq of findNameSequences(allTokens)) {
  if (seq.tokens.some(t => processedTokens.has(t))) continue;
  const pos = reanchor(seq.text, seq.start);
  names.push({ text: seq.text, ...pos, type: 'surname' });
  seq.tokens.forEach(t => processedTokens.add(t));
}

// 識別子パターン除外
const filtered = filterOutIdentifierPatterns(names, text);

// ── 4. 検出結果表示 ──────────────────────────────────────
console.log('🎯 検出結果:');
if (filtered.length === 0) {
  console.log('  (なし)');
} else {
  for (const n of filtered) {
    console.log(`  "${n.text}" (${n.type}) @${n.start}-${n.end}`);
  }
}
console.log('');

// ── 5. マスク結果表示 ────────────────────────────────────
const sorted = [...filtered].sort((a, b) => b.start - a.start);
let masked = text;
for (const n of sorted) {
  masked =
    masked.slice(0, n.start) +
    '＊'.repeat(n.end - n.start) +
    masked.slice(n.end);
}
console.log(`🔒 マスク結果: "${masked}"\n`);
