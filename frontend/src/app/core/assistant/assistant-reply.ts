// Turns a Gemini reply into the plain text the assistant panel shows.
// The model sometimes answers with Markdown or with every numbered step on one line.

/**
 * Removes Markdown and technical routes, and puts each numbered step (1., 2., ...) in its own
 * paragraph, separated by one blank line.
 */
export function formatReply(reply: string): string {
  const plain = reply
    .replace(/ | /g, ' ')
    .replace(/\s*\(`[^`]*`\)/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
  return splitSteps(plain).replace(/\n{3,}/g, '\n\n');
}

/** Breaks only before the next expected step number, so "versión 1." inside a step stays intact. */
function splitSteps(text: string): string {
  let result = '';
  let rest = text;
  let next = 1;
  for (;;) {
    const match = new RegExp(`(^|\\s)${next}\\. `).exec(rest);
    if (!match) return result + rest;
    const before = rest.slice(0, match.index).trim();
    result += before + (before || result ? '\n\n' : '');
    rest = rest.slice(match.index + match[1].length);
    next++;
  }
}
