// Sudachi dedicated bundle (exposed globally in IIFE format)
import { TokenizeMode, tokenize } from 'sudachi';

// Expose Sudachi bridge to global object
(globalThis as any).SudachiBridge = {
  TokenizeMode,
  tokenize,
  isReady: true,
};

console.log('Success: Sudachi bundle has been loaded');
