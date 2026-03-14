import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

export const md: MarkdownIt = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  highlight: function (str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>';
      } catch (__) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});

export function renderMarkdown(content: string): string {
  if (!content) return '';
  try {
    return md.render(content);
  } catch {
    return content;
  }
}
