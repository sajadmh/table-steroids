/**
 * Copies text and optional HTML to the clipboard, using the modern API first and a fallback second.
 */
export declare function copyTextToClipboard(text: string, html?: string): Promise<boolean>;
