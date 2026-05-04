/**
 * Sorts dropdown option strings A-Z, keeping blank/empty entries first
 * and moving any item whose trimmed value is "Other" (case-insensitive) to the bottom.
 *
 * @param {string[]} options
 * @returns {string[]}
 */
export function sortDropdownOptions(options) {
  const blanks  = options.filter(o => o === '' || o == null);
  const rest    = options.filter(o => o !== '' && o != null);
  const others  = rest.filter(o => o.trim().toLowerCase() === 'other');
  const normal  = rest.filter(o => o.trim().toLowerCase() !== 'other');
  normal.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return [...blanks, ...normal, ...others];
}
