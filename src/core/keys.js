// Keyboard labels that match the computer: ⌘ on a Mac, Ctrl elsewhere.
// Shortcut handlers accept both ctrlKey and metaKey; this is only for showing them.
export const isMac = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);

// shortcut('N') -> '⌘N' on a Mac, 'Ctrl+N' elsewhere.
export const shortcut = (key) => (isMac ? `⌘${key}` : `Ctrl+${key}`);
