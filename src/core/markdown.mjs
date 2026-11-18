/**
 * Lightweight, fence-aware Markdown structure parser.
 *
 * Validators use this instead of whole-document regexes so headings, IDs or
 * checkboxes inside fenced code blocks are never mistaken for real content.
 */

const FENCE_RE = /^( {0,3})(`{3,}|~{3,})(.*?)\r?$/;
const HEADING_RE = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;

/**
 * Replace fenced code block contents with whitespace while preserving offsets.
 * @param {string} content
 * @returns {string}
 */
export function stripFencedCode(content) {
  const lines = content.split('\n');
  let openFence = null;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(FENCE_RE);
    if (openFence) {
      if (match && match[2][0] === openFence.char && match[2].length >= openFence.length) {
        openFence = null;
      }
      lines[i] = ' '.repeat(lines[i].length);
      continue;
    }
    if (match) {
      openFence = { char: match[2][0], length: match[2].length };
      lines[i] = ' '.repeat(lines[i].length);
    }
  }
  return lines.join('\n');
}

/**
 * @param {string} content
 * @returns {Array<{level: number, text: string, line: number, start: number, end: number}>}
 */
export function parseHeadings(content) {
  const stripped = stripFencedCode(content);
  const offsets = [];
  let offset = 0;
  for (const line of stripped.split('\n')) {
    offsets.push(offset);
    offset += line.length + 1;
  }

  const headings = [];
  stripped.split('\n').forEach((line, index) => {
    const match = line.match(HEADING_RE);
    if (!match) return;
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
      line: index + 1,
      start: offsets[index],
      end: offsets[index] + line.length,
    });
  });
  return headings;
}

/**
 * Does a heading matching `pattern` exist?
 * @param {string} content
 * @param {RegExp} pattern
 * @param {number} [level]
 */
export function hasHeading(content, pattern, level) {
  return parseHeadings(content).some((h) => (level ? h.level === level : true) && pattern.test(h.text));
}

/**
 * Return the body text of the first matching heading, up to the next heading.
 * @param {string} content
 * @param {RegExp} pattern
 * @returns {string|null}
 */
export function sectionBody(content, pattern) {
  const headings = parseHeadings(content);
  const index = headings.findIndex((h) => pattern.test(h.text));
  if (index === -1) return null;
  const heading = headings[index];
  const next = headings.slice(index + 1).find((h) => h.level <= heading.level);
  return content.slice(heading.end, next ? next.start : content.length);
}

/**
 * Count fenced blocks with a given info string (e.g. `mermaid`) that contain
 * at least one non-whitespace line. Empty fences do not count.
 * @param {string} content
 * @param {string} language
 */
export function countFencedBlocks(content, language) {
  const languageRe = new RegExp(`^${language}\\b`, 'i');
  let open = null;
  let count = 0;
  let hasContent = false;

  for (const line of content.split('\n')) {
    const match = line.match(FENCE_RE);
    if (!open) {
      if (match) {
        open = {
          char: match[2][0],
          length: match[2].length,
          target: languageRe.test(match[3].trim()),
        };
        hasContent = false;
      }
      continue;
    }

    if (match && match[2][0] === open.char && match[2].length >= open.length) {
      if (open.target && hasContent) count++;
      open = null;
      continue;
    }

    if (open.target && line.trim().length > 0) hasContent = true;
  }

  if (open && open.target && hasContent) count++;
  return count;
}

/**
 * @param {string} content
 * @param {RegExp} pattern must be global or will be cloned
 * @returns {string[]} unique matches
 */
export function findIds(content, pattern) {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  return [...new Set(content.match(re) || [])];
}

/**
 * Does the body contain Given/When/Then BDD statements?
 * @param {string} body
 */
export function hasBddStatements(body) {
  return /\bGiven\b/i.test(body) && /\bWhen\b/i.test(body) && /\bThen\b/i.test(body);
}
