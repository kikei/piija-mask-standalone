// Loader for dynamically loading Sudachi (script tag based)
let isLoading = false;
let isLoaded = false;

/**
 * Dynamically load Sudachi bundle with script tag
 */
export async function loadSudachi(): Promise<boolean> {
  if (isLoaded && (globalThis as any).SudachiBridge) {
    return true;
  }

  if (isLoading) {
    // If already loading, wait for completion
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return isLoaded;
  }

  try {
    isLoading = true;
    console.log('Loading: Dynamically loading Sudachi dictionary...');

    // Load Sudachi bundle with dynamic import
    await import('./sudachi-bundle.js');

    // Wait until SudachiBridge becomes globally available
    let attempts = 0;
    while (!(globalThis as any).SudachiBridge && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if ((globalThis as any).SudachiBridge) {
      isLoaded = true;
      console.log('Success: Sudachi dictionary loading complete');
      return true;
    } else {
      throw new Error('SudachiBridge initialization timeout');
    }
  } catch (error) {
    console.error('Error: Failed to load Sudachi dictionary:', error);
    return false;
  } finally {
    isLoading = false;
  }
}

/**
 * Get the loaded Sudachi module
 */
export function getSudachiModule() {
  if (!isLoaded || !(globalThis as any).SudachiBridge) {
    throw new Error('Sudachi module is not loaded');
  }
  return (globalThis as any).SudachiBridge;
}

/**
 * Check if Sudachi is loaded
 */
export function isSudachiLoaded(): boolean {
  return isLoaded && (globalThis as any).SudachiBridge !== null;
}
