

// Форматирование текста Markdown в HTML
export function renderMarkdownResponse(markdownText, containerId = 'responseContainer') {
  const html = marked.parse(markdownText);
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = html;
  }
}
