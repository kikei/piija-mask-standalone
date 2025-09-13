import { UIState } from './app-state.js';

export interface AppElements {
  inputText: HTMLTextAreaElement;
  maskButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  backToInputButton: HTMLButtonElement;
  copyButton: HTMLButtonElement;
  copyButtonTop: HTMLButtonElement;
  copyAndClearButton: HTMLButtonElement;
  originalContent: HTMLDivElement;
  maskedContent: HTMLDivElement;
  maskedDisplay: HTMLDivElement;
  errorMessage: HTMLDivElement;
  headerControls: HTMLDivElement;
  maskControls: HTMLDivElement;
  maskButtonSticky: HTMLButtonElement;
  helpMessage: HTMLDivElement;
  outputControls: HTMLDivElement;
  loadingIndicator: HTMLDivElement;
  progressBar: HTMLDivElement;
  loadingText: HTMLDivElement;
  loadingEllipsis: HTMLSpanElement;
}

export function updateUIVisibility(params: {
  elements: AppElements;
  uiState: UIState;
  isSudachiLoading: boolean;
}): void {
  const { elements, uiState, isSudachiLoading } = params;

  elements.loadingIndicator.style.display = isSudachiLoading ? 'block' : 'none';

  switch (uiState) {
    case UIState.Initial:
      elements.maskControls.style.display = 'flex';
      elements.maskButtonSticky.disabled = true;
      elements.maskButton.style.display = '';
      elements.maskButton.disabled = true;
      elements.maskButton.textContent = 'マスク';
      elements.backToInputButton.style.display = 'none';
      elements.copyButtonTop.disabled = false;
      elements.copyButtonTop.className = 'copy-button-subtle';
      elements.originalContent.style.display = 'block';
      elements.maskedContent.style.display = 'none';
      elements.helpMessage.style.display = 'none';
      elements.outputControls.style.display = 'none';
      break;

    case UIState.InputReady:
      elements.maskControls.style.display = 'flex';
      elements.maskButtonSticky.disabled = false;
      elements.maskButton.style.display = '';
      elements.maskButton.disabled = false;
      elements.maskButton.textContent = 'マスク';
      elements.backToInputButton.style.display = 'none';
      elements.copyButtonTop.disabled = false;
      elements.copyButtonTop.className = 'copy-button-subtle';
      elements.originalContent.style.display = 'block';
      elements.maskedContent.style.display = 'none';
      elements.helpMessage.style.display = 'none';
      elements.outputControls.style.display = 'none';
      break;

    case UIState.Masked:
      elements.maskControls.style.display = 'none';
      elements.maskButton.style.display = 'none';
      elements.backToInputButton.style.display = '';
      elements.copyButtonTop.disabled = false;
      elements.copyButtonTop.className = 'copy-button';
      elements.originalContent.style.display = 'none';
      elements.maskedContent.style.display = 'block';
      elements.helpMessage.style.display = 'block';
      elements.outputControls.style.display = 'flex';
      break;
  }
}

export function setLoadingProgress(
  elements: Pick<AppElements, 'progressBar'>,
  ratio: number
): void {
  const pct = Math.min(100, Math.round(ratio * 100));
  elements.progressBar.style.width = `${pct}%`;
}

export function showDownloadComplete(
  elements: Pick<AppElements, 'loadingEllipsis' | 'loadingText' | 'progressBar'>
): void {
  elements.loadingEllipsis.style.display = 'none';
  elements.loadingText.textContent = 'ダウンロード完了';
  elements.progressBar.style.width = '100%';
}

export function showError(
  elements: Pick<AppElements, 'errorMessage'>,
  message: string
): void {
  elements.errorMessage.textContent = message;
  elements.errorMessage.style.display = 'block';
  setTimeout(() => {
    elements.errorMessage.style.display = 'none';
  }, 3000);
}
