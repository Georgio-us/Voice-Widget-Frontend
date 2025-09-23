// ========================================
// 📁 modules/markdown.js
// Единый Markdown-рендерер: markdown-it + emoji + DOMPurify
// ========================================

import MarkdownIt from 'https://esm.sh/markdown-it@14.1.0';
import markdownItEmoji from 'https://esm.sh/markdown-it-emoji@2.0.2';
import DOMPurify from 'https://esm.sh/dompurify@3.0.6';

// Конфигурация markdown-it
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false
});

// Плагины
md.use(markdownItEmoji);

// Все ссылки — в новой вкладке + безопасные rel
const defaultRenderLinkOpen = md.renderer.rules.link_open || function(tokens, idx, options, env, self){
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
  const aIndex = tokens[idx].attrIndex('target');
  if (aIndex < 0) tokens[idx].attrPush(['target', '_blank']); else tokens[idx].attrs[aIndex][1] = '_blank';
  const rIndex = tokens[idx].attrIndex('rel');
  const relValue = 'noopener noreferrer';
  if (rIndex < 0) tokens[idx].attrPush(['rel', relValue]); else tokens[idx].attrs[rIndex][1] = relValue;
  return defaultRenderLinkOpen(tokens, idx, options, env, self);
};

// Детектор «короткой» реплики (inline)
export function isInlineMessage(text) {
  if (!text) return true;
  const src = String(text).trim();
  if (!src) return true;
  // Простая эвристика: нет пустых строк, нет лидирующих блок-маркеров
  if (src.includes('\n\n')) return false;
  const blockMarkers = [/^#{1,6}\s/m, /^>\s/m, /^\s*[-*+]\s/m, /^\s*\d+\.\s/m, /```/m];
  return !blockMarkers.some(re => re.test(src));
}

// Рендер inline (без <p>)
export function renderMarkdownInline(text) {
  const raw = String(text ?? '').trim();
  const html = md.renderInline(raw);
  return DOMPurify.sanitize(html);
}

// Рендер блочный
export function renderMarkdownBlock(text) {
  const raw = String(text ?? '').trim();
  const html = md.render(raw);
  return DOMPurify.sanitize(html);
}

// Универсальный рендер (автовыбор)
export function renderMarkdown(text) {
  return isInlineMessage(text) ? renderMarkdownInline(text) : renderMarkdownBlock(text);
}

export default {
  renderMarkdown,
  renderMarkdownInline,
  renderMarkdownBlock,
  isInlineMessage
};


