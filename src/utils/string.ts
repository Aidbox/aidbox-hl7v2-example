/**
 * Shared string utility functions
 */

/**
 * Simple hash function (DJB2 variant)
 * Returns a base36 string representation of the hash
 */
export function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

/**
 * Convert string to kebab-case
 * "Essential Hypertension" → "essential-hypertension"
 * "LAB_SYSTEM" → "lab-system"
 */
export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "-") // Replace non-alphanumeric chars (including underscores) with hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens
}
