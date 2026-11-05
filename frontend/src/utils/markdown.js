/**
 * Markdown & Math Processing Utilities
 */

/**
 * Pre-process LLM text so KaTeX math and math environments render reliably.
 */
export function preprocessLaTeX(content) {
  if (!content) return '';

  return (
    content
      // 1. Convert display brackets \[ ... \] to $$ ... $$
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n\n$$\n${math.trim()}\n$$\n\n`)
      // 2. Convert inline brackets \( ... \) to $ ... $
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`)
      // 3. Ensure $$ display blocks have proper line breaks around them
      .replace(/([^\n]?)\s*\$\$([\s\S]*?)\$\$\s*([^\n]?)/g, (_, before, math, after) => {
        const b = before && before !== '\n' ? `${before}\n\n` : (before || '');
        const a = after && after !== '\n' ? `\n\n${after}` : (after || '');
        return `${b}$$\n${math.trim()}\n$$${a}`;
      })
      // 4. In math environments (cases, aligned, matrix, etc.), fix collapsed row break backslashes
      .replace(/\\begin\{(cases|aligned|matrix|pmatrix|bmatrix)\}([\s\S]*?)\\end\{\1\}/g, (match, env, inner) => {
        let fixedInner = inner
          .replace(/([^\\])\\\s*(&)/g, '$1\\\\\n$2')
          .replace(/([^\\])\\\s*(\r?\n)/g, '$1\\\\\n')
          .replace(/([^\\])\\\s*$/g, '$1');

        if (env === 'cases') {
          fixedInner = fixedInner.replace(/([^\\])\\\s+([^\\&]+&)/g, '$1\\\\\n$2');
        }

        return `\\begin{${env}}${fixedInner}\\end{${env}}`;
      })
  );
}

/**
 * Auto-detect Mermaid diagrams whether declared as ```mermaid or via diagram syntax
 */
export function isMermaidCode(lang, code) {
  const normalizedLang = (lang || '').toLowerCase().trim();
  if (normalizedLang === 'mermaid') return true;
  if (!code) return false;
  const trimmed = code.trim();
  const mermaidPattern = /^(?:%%\{init.*?%%[\r\n\s]*)?(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|quadrantChart|xychart-beta|timeline|sankey-beta|kanban|block-beta|architecture-beta|C4Context|zenuml)\b/i;
  return mermaidPattern.test(trimmed);
}

