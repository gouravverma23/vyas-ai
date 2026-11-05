/**
 * Formatting and Helper Utilities
 */

/**
 * Truncate a string to a max length with ellipsis.
 */
export function truncate(text, maxLength = 36) {
  if (!text) return '';
  const clean = text.replace(/\n+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 3) + '...';
}

/**
 * Format timestamp into human readable relative or date string.
 */
export function formatTimestamp(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '';
  }
}

/**
 * Format bytes into human readable file size (KB, MB).
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

