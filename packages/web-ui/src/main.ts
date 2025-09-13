import {
  redact,
  initializeNameDetector,
  type RedactResult,
} from './redact-browser.js';
import { type Position } from './position.js';
import { splitSelectionByNewlines } from './mask-applier.js';
import type { RedactPosition } from './redact-browser.js';
import {
  getCaretPositionFromPoint,
  calculateSelectionPositions,
} from './position-calculator.js';
import { renderMaskedDisplay } from './html-renderer.js';
import {
  initSudachi,
  analyzeMorphology,
  type NameDetectionResult,
} from './sudachi-integration.js';
import { UIState, type MaskState, createInitialState } from './app-state.js';
import {
  type AppElements,
  updateUIVisibility,
  setLoadingProgress,
  showDownloadComplete,
  showError,
} from './ui-visibility.js';
import {
  propagateUnmask,
  propagateRemask,
  buildMaskedText,
  addManualMask,
  removePositionByTokenId,
  findExactMask,
} from './mask-ops.js';

class RedactApp {
  private state: MaskState = createInitialState();
  private uiState: UIState = UIState.Initial;

  private elements: AppElements = {
    inputText: document.getElementById('inputText') as HTMLTextAreaElement,
    maskButton: document.getElementById('maskButton') as HTMLButtonElement,
    clearButton: document.getElementById('clearButton') as HTMLButtonElement,
    backToInputButton: document.getElementById(
      'backToInputButton'
    ) as HTMLButtonElement,
    copyButton: document.getElementById('copyButton') as HTMLButtonElement,
    copyButtonTop: document.getElementById(
      'copyButtonTop'
    ) as HTMLButtonElement,
    copyAndClearButton: document.getElementById(
      'copyAndClearButton'
    ) as HTMLButtonElement,
    originalContent: document.getElementById(
      'originalContent'
    ) as HTMLDivElement,
    maskedContent: document.getElementById('maskedContent') as HTMLDivElement,
    maskedDisplay: document.getElementById('maskedDisplay') as HTMLDivElement,
    errorMessage: document.getElementById('errorMessage') as HTMLDivElement,
    headerControls: document.getElementById('headerControls') as HTMLDivElement,
    maskControls: document.getElementById('maskControls') as HTMLDivElement,
    maskButtonSticky: document.getElementById(
      'maskButtonSticky'
    ) as HTMLButtonElement,
    helpMessage: document.getElementById('helpMessage') as HTMLDivElement,
    outputControls: document.getElementById('outputControls') as HTMLDivElement,
    loadingIndicator: document.getElementById(
      'loadingIndicator'
    ) as HTMLDivElement,
    progressBar: document.getElementById('progressBar') as HTMLDivElement,
    loadingText: document.getElementById('loadingText') as HTMLDivElement,
    loadingEllipsis: document.getElementById(
      'loadingEllipsis'
    ) as HTMLSpanElement,
  };

  private isNameDetectorReady = false;
  private isSudachiReady = false;
  private isSudachiLoading = true;
  /** マスクボタンがロード完了前に押された場合の保留フラグ */
  private pendingMask = false;

  /** Drag start position recorded on mousedown via caretPositionFromPoint */
  private dragStart: { node: Node; offset: number } | null = null;

  constructor() {
    this.initializeEventListeners();
    this.initializeNameDetector();
    this.initializeSudachi();
    this.initializeTextareaAutoResize();
    this.elements.inputText.focus();
  }

  private async initializeNameDetector(): Promise<void> {
    try {
      await initializeNameDetector();
      this.isNameDetectorReady = true;
    } catch (error) {
      console.warn('Name detector initialization failed:', error);
    }
  }

  private async initializeSudachi(): Promise<void> {
    this.updateUIVisibility();
    try {
      this.isSudachiReady = await initSudachi(r =>
        setLoadingProgress(this.elements, r)
      );
      if (this.isSudachiReady) {
        console.log(
          'Success: Sudachi morphological analyzer is now available in Web UI'
        );
        showDownloadComplete(this.elements);
      }
    } catch (error) {
      console.warn('Warning: Sudachi initialization failed:', error);
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
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  private initializeEventListeners(): void {
    this.elements.maskButton.addEventListener('click', () => this.handleMask());
    this.elements.maskButtonSticky.addEventListener('click', () =>
      this.handleMask()
    );
    this.elements.clearButton.addEventListener('click', () =>
      this.handleClear()
    );
    this.elements.backToInputButton.addEventListener('click', () =>
      this.handleBackToInput()
    );
    this.elements.copyButton.addEventListener('click', () => this.handleCopy());
    this.elements.copyButtonTop.addEventListener('click', () =>
      this.handleCopy()
    );
    this.elements.copyAndClearButton.addEventListener('click', () =>
      this.handleCopyAndClear()
    );

    this.elements.maskedDisplay.addEventListener('mousedown', e => {
      this.dragStart = getCaretPositionFromPoint(e.clientX, e.clientY);
    });
    this.elements.maskedDisplay.addEventListener('mouseup', e =>
      this.handleSelection(e)
    );
    this.elements.maskedDisplay.addEventListener('click', e =>
      this.handleMaskClick(e)
    );

    this.elements.inputText.addEventListener('input', () => {
      this.handleInputChange();
    });
  }

  private initializeTextareaAutoResize(): void {
    this.resizeTextarea();
    this.elements.inputText.addEventListener('input', () => {
      this.resizeTextarea();
    });
  }

  private resizeTextarea(): void {
    const textarea = this.elements.inputText;
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
  }

  private updateUIVisibility(): void {
    updateUIVisibility({
      elements: this.elements,
      uiState: this.uiState,
      isSudachiLoading: this.isSudachiLoading,
    });
  }

  private setUIState(newState: UIState): void {
    console.log('Setting UI state:', newState);
    this.uiState = newState;
    this.updateUIVisibility();
  }

  private async handleMask(): Promise<void> {
    const text = this.elements.inputText.value.trim();

    if (!text) {
      showError(this.elements, 'マスクしたい文章を貼り付けてください。');
      return;
    }

    if (this.isSudachiLoading) {
      this.pendingMask = true;
      this.elements.maskButton.disabled = true;
      this.elements.maskButton.textContent = '準備完了後、自動的にマスクします';
      this.elements.maskButtonSticky.disabled = true;
      this.elements.maskButtonSticky.textContent =
        '準備完了後、自動的にマスクします';
      return;
    }

    this.elements.maskButton.disabled = true;
    this.elements.maskButton.textContent = 'マスク中...';
    this.elements.maskButtonSticky.disabled = true;
    this.elements.maskButtonSticky.textContent = 'マスク中...';

    try {
      const result = await redact(text);
      const positions = this.isSudachiReady
        ? await this.mergeWithSudachi(text, result)
        : result.positions;

      this.state = {
        originalText: text,
        positions,
        manualMasks: [],
        unmaskedPositions: new Set(),
      };
      this.updateDisplay();
      this.setUIState(UIState.Masked);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Masking failed:', error);
      showError(this.elements, 'マスク処理中にエラーが発生しました。');
    } finally {
      this.elements.maskButton.disabled = false;
      this.elements.maskButton.textContent = 'マスク';
      this.elements.maskButtonSticky.disabled = false;
      this.elements.maskButtonSticky.textContent = 'マスクする';
    }
  }

  private async mergeWithSudachi(
    text: string,
    result: RedactResult
  ): Promise<RedactResult['positions']> {
    const morphAnalysis: NameDetectionResult = await analyzeMorphology(text);

    if (morphAnalysis.names.length > 0 || morphAnalysis.allTokens.length > 10) {
      console.group('Debug: Sudachi morphological analysis results');
      console.log('Info: Detected person names:', morphAnalysis.names);
      console.log('Info: Total token count:', morphAnalysis.allTokens.length);
      morphAnalysis.allTokens.forEach(token => {
        const isName =
          token.poses.length >= 3 &&
          token.poses[0] === '名詞' &&
          token.poses[1] === '固有名詞' &&
          token.poses[2] === '人名';
        if (isName) {
          console.log(`👤 ${token.surface} [${token.poses.join(', ')}]`);
        }
      });
      console.groupEnd();
    }

    const sudachiNames: RedactPosition[] = morphAnalysis.names.flatMap(name => {
      const type = name.type === 'place' ? 'place' : 'name';
      return splitSelectionByNewlines(text, name.start, name.end).map(seg => ({
        start: seg.start,
        end: seg.end,
        original: seg.original,
        type,
      }));
    });

    const combined = [...result.positions];
    for (const name of sudachiNames) {
      const isDuplicate = result.positions.some(
        p => p.start === name.start && p.end === name.end
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

  private handleInputChange(): void {
    const hasText = this.elements.inputText.value.trim().length > 0;
    console.log('Input changed:', hasText, 'Current state:', this.uiState);
    if (hasText && this.uiState === UIState.Initial) {
      this.setUIState(UIState.InputReady);
    } else if (!hasText && this.uiState === UIState.InputReady) {
      this.setUIState(UIState.Initial);
    }
  }

  private handleBackToInput(): void {
    this.state = {
      ...createInitialState(),
      originalText: this.state.originalText,
    };
    this.elements.maskedDisplay.innerHTML = '';
    this.setUIState(UIState.InputReady);
  }

  private handleClear(): void {
    this.elements.inputText.value = '';
    this.state = createInitialState();
    this.elements.maskedDisplay.innerHTML = '';
    this.resizeTextarea();
    this.setUIState(UIState.Initial);
    this.elements.inputText.focus();
  }

  private async handleCopy(): Promise<void> {
    const textToCopy =
      this.uiState === UIState.Masked
        ? buildMaskedText(this.state)
        : this.elements.inputText.value;

    try {
      await navigator.clipboard.writeText(textToCopy);

      const originalBottomText = this.elements.copyButton.textContent;
      const originalTopText = this.elements.copyButtonTop.textContent;
      this.elements.copyButton.textContent = 'コピー完了！';
      this.elements.copyButtonTop.textContent = 'コピー完了！';
      setTimeout(() => {
        this.elements.copyButton.textContent = originalBottomText;
        this.elements.copyButtonTop.textContent = originalTopText;
      }, 1000);
    } catch {
      showError(
        this.elements,
        '自動コピーが無効です。表示中の結果を選択して、手動でコピーしてください。'
      );
    }
  }

  private async handleCopyAndClear(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildMaskedText(this.state));
    } catch {
      showError(
        this.elements,
        '自動コピーが無効です。表示中の結果を選択して、手動でコピーしてください。'
      );
      return;
    }
    this.handleClear();
  }

  private handleSelection(e: MouseEvent): void {
    const endPos = getCaretPositionFromPoint(e.clientX, e.clientY);
    let positions: { start: number; end: number } | null = null;

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
        // Range construction failed — fall back to window.getSelection()
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
      state: this.state,
    });
    if (changed) this.updateDisplay();
    window.getSelection()?.removeAllRanges();
  }

  private handleMaskClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('masked-token')) return;

    const tokenId = target.dataset.tokenId;
    if (!tokenId) return;

    const all = [...this.state.positions, ...this.state.manualMasks];
    const pos = all.find(p => `${p.start}-${p.end}` === tokenId);

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

  private updateDisplay(): void {
    const allPositions = [...this.state.positions, ...this.state.manualMasks];
    const html = renderMaskedDisplay(
      this.state.originalText,
      allPositions,
      this.state.unmaskedPositions
    );
    this.elements.maskedDisplay.innerHTML = html;
  }
}

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new RedactApp());
} else {
  new RedactApp();
}
