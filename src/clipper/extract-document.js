import { Readability } from "@mozilla/readability";
import { prepareDocSnapshot } from "./dom-cleanup.js";
import { cleanExtraHTML, findExtraContent } from "./extra-content.js";
import { generateFrontmatter } from "./frontmatter.js";
import { stripHtmlText } from "./html-utils.js";
import { htmlToMarkdown } from "./turndown-config.js";
import { isCatalogOrGridSection, isValidTextSection } from "./validators.js";

const widgetSelectors = [
  '[class*="navigator"]',
  '[id*="navigator"]',
  ".travel-navigator",
  '[data-component="Navigator"]',
  '[class*="widget"]',
  '[class*="app-content"]',
  '[class*="calculator"]',
  '[class*="filter"]',
  '[role="application"]',
  '[class*="interactive"]',
];

function ensureArticleTitle(html, title) {
  if (!title.length) return html;
  const normalizedTitle = title.replace(/\s+/g, " ").trim().toLowerCase();
  const strippedHtml = stripHtmlText(html).replace(/\s+/g, " ").toLowerCase();
  const titleAlreadyPresent =
    strippedHtml.startsWith(normalizedTitle) ||
    strippedHtml.includes(normalizedTitle);
  if (titleAlreadyPresent) return html;
  const h2Regex = /<h2[^>]*>(.*?)<\/h2>/;
  const match = html.match(h2Regex);
  if (match) {
    return html.replace("<h2", "<h1").replace("</h2", "</h1");
  }
  return `<h1>${title}</h1>\n${html}`;
}

function appendExtraSections(html, docSnapshot) {
  const articleTextLength = stripHtmlText(html).length;
  const extraSections = findExtraContent(docSnapshot, html);
  let result = html;
  for (const section of extraSections) {
    let sectionHtml = section.html;
    if (section.type === "comments") {
      const commentTextLen = stripHtmlText(sectionHtml).length;
      if (commentTextLen > articleTextLength * 3) {
        const items = sectionHtml.match(/<li[\s\S]*?<\/li>/g) || [];
        sectionHtml =
          items.slice(0, 15).join("\n") ||
          sectionHtml.slice(0, articleTextLength);
      }
      if (articleTextLength < 100) continue;
    }
    result += `\n\n<hr>\n<h2>${section.title}</h2>\n${sectionHtml}`;
  }
  return result;
}

function applyCatalogFallback(html, docSnapshot) {
  if (stripHtmlText(html).length >= 400) return html;
  let result = html;
  const containers = docSnapshot.querySelectorAll(
    "main, article, #content, .content, .catalog, .products, .product-list, .product-grid, body",
  );
  for (const container of containers) {
    for (const child of Array.from(container.children)) {
      if (isCatalogOrGridSection(child) && isValidTextSection(child, true)) {
        const id = child.getAttribute("id");
        if (id && result.includes(`id="${id}"`)) continue;
        const textSample = child.textContent.trim().slice(0, 200);
        if (textSample.length >= 50 && result.includes(textSample)) continue;
        result += `\n\n${cleanExtraHTML(child)}`;
      }
    }
  }
  return result;
}

function findSpaWidget(docSnapshot) {
  for (const sel of widgetSelectors) {
    try {
      const widget = docSnapshot.querySelector(sel);
      if (widget && widget.textContent.trim().length > 200) {
        return widget;
      }
    } catch (_) {}
  }
  return null;
}

function appendWidgetBackupContent(result, widget) {
  const baseHost = location.origin;
  const backupLinks = [];
  widget.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href");
    const text = a.textContent.trim();
    if (href && text && text.length > 3) {
      const fullUrl = href.startsWith("http")
        ? href
        : baseHost + (href.startsWith("/") ? "" : "/") + href;
      backupLinks.push(`- [${text}](${fullUrl})`);
    }
  });
  if (backupLinks.length > 0) {
    result +=
      `\n\n### Доступные направления и подробные правила:\n` +
      backupLinks.join("\n");
  }

  let widgetTextContent = "";
  widget
    .querySelectorAll(
      'h2, h3, h4, button, [class*="title"], [class*="text"], .card',
    )
    .forEach((el) => {
      const text = el.textContent.trim().replace(/\s+/g, " ");
      if (text.length > 2) {
        if (
          /^(H2|H3)$/.test(el.tagName) ||
          (el.className &&
            el.className.includes &&
            el.className.includes("title"))
        ) {
          widgetTextContent += `\n\n## ${text}\n`;
        } else {
          widgetTextContent += `- ${text}\n`;
        }
      }
    });
  if (widgetTextContent.length > 100) {
    result += `\n\n### Структура интерактивного контента:\n${widgetTextContent}`;
  }
  return result;
}

function applySpaFallback(html, docSnapshot) {
  if (stripHtmlText(html).length >= 1000) return html;

  let result = html;
  const widget = findSpaWidget(docSnapshot);

  if (widget) {
    let widgetHtml = cleanExtraHTML(widget);
    if (stripHtmlText(widgetHtml).length < 300) {
      const headings = [];
      widget
        .querySelectorAll(
          'h3, h4, [class*="title"], [class*="heading"], dt, summary',
        )
        .forEach((el) => {
          const t = el.textContent.trim();
          if (t.length > 2 && t.length < 200) headings.push(`### ${t}`);
        });
      if (headings.length > 0) {
        widgetHtml = headings.join("\n\n") + "\n\n" + widgetHtml;
      }
    }
    result = widgetHtml + "\n\n" + result;
    result = appendWidgetBackupContent(result, widget);
  }

  const nextDataScript = docSnapshot.querySelector(
    '#__NEXT_DATA__, script[type="application/json"]',
  );
  if (nextDataScript) {
    try {
      const jsonData = JSON.parse(nextDataScript.textContent);
      const jsonText = JSON.stringify(jsonData)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (jsonText.length > 200) {
        result =
          `<!-- JSON State Data -->\n\`\`\`json\n${JSON.stringify(jsonData, null, 2).slice(0, 50000)}\n\`\`\`\n\n` +
          result;
      }
    } catch (_) {}
  }

  return result;
}

export function extractFromDocument() {
  const docSnapshot = prepareDocSnapshot(document);

  const article = new Readability(document, {
    keepClasses: true,
    debug: false,
    charThreshold: 100,
  }).parse();

  if (!article || !article.content) {
    return {
      title: document.title,
      markdown: "",
      error: "Не удалось извлечь контент с этой страницы",
    };
  }

  let html = article.content.replace(/(<!--.*?-->)/g, "");
  html = ensureArticleTitle(html, article.title);
  html = appendExtraSections(html, docSnapshot);
  html = applyCatalogFallback(html, docSnapshot);
  html = applySpaFallback(html, docSnapshot);

  const frontmatter = generateFrontmatter(docSnapshot, article);
  const markdown = htmlToMarkdown(html);
  return { title: article.title, markdown: frontmatter + markdown };
}
