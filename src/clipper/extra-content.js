import { isValidTextSection } from "./validators.js";

const commentSelectors = [
  "#comments",
  ".comments",
  "#comment-list",
  ".comment-list",
  ".comments-list",
  "#disqus_thread",
  ".live-comments",
  'section[class*="comment"]',
  'div[class*="comment"]',
  "#comments-component",
  ".article-comments",
  ".post-comments",
  "[data-comments-container]",
  'amp-live-list[id*="comments"]',
];

const relatedSelectors = [
  ".related-posts",
  ".read-more",
  ".recommended-posts",
  "#related",
  ".related-articles",
  ".see-also",
  ".suggested-articles",
  'section[class*="related"]',
  'div[class*="related"]',
  'div[class*="recommended"]',
  ".another-posts",
  ".post-links",
  '[data-analytics-label="related-articles"]',
];

export function cleanExtraHTML(el) {
  if (!el) return "";
  const clone = el.cloneNode(true);
  clone
    .querySelectorAll("script, style, iframe, noscript")
    .forEach((n) => n.remove());
  clone.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      if (attr.name.startsWith("on") || attr.name === "style")
        node.removeAttribute(attr.name);
    });
  });
  clone.querySelectorAll("table, tr, td, th").forEach((tableEl) => {
    Array.from(tableEl.attributes).forEach((attr) =>
      tableEl.removeAttribute(attr.name)
    );
  });
  clone.querySelectorAll("td p, th p").forEach((p) => {
    const cleanedText = p.textContent.replace(/\s+/g, " ").trim();
    p.replaceWith(document.createTextNode(cleanedText));
  });
  clone.querySelectorAll("td, th").forEach((cell) => {
    cell.textContent = cell.textContent.replace(/\s+/g, " ").trim();
  });
  return clone.outerHTML;
}

export function findExtraContent(doc, articleHtml) {
  const sections = [];

  function alreadyInArticle(el) {
    const id = el.getAttribute("id");
    if (
      id &&
      (articleHtml.includes(`id="${id}"`) || articleHtml.includes(`id='${id}'`))
    )
      return true;
    const textSample = el.textContent.trim().slice(0, 200);
    if (textSample.length < 50) return false;
    return articleHtml.includes(textSample);
  }

  for (const sel of commentSelectors) {
    try {
      const elements = doc.querySelectorAll(sel);
      for (const el of elements) {
        if (isValidTextSection(el) && !alreadyInArticle(el)) {
          const lowerText = el.textContent.toLowerCase();
          const authTriggers = [
            "confirm your public display name",
            "please logout and then login",
            "you must be logged in to comment",
            "войдите, чтобы оставить комментарий",
            "sign in to comment",
          ];
          const isAuthNotice = authTriggers.some((phrase) =>
            lowerText.includes(phrase)
          );
          if (isAuthNotice && el.querySelectorAll("p, span").length < 3) continue;

          const heading = el.querySelector(
            'h2, h3, h4, [class*="title"], [class*="heading"], [aria-label*="comment"]'
          );
          const title = heading ? heading.textContent.trim() : "Комментарии";
          el.querySelectorAll("blockquote").forEach((bq) => {
            bq.outerHTML = ` (Цитата: ${bq.textContent.trim()}) `;
          });
          sections.push({ type: "comments", title, html: cleanExtraHTML(el) });
        }
      }
    } catch (_) {}
  }

  for (const sel of relatedSelectors) {
    try {
      const elements = doc.querySelectorAll(sel);
      for (const el of elements) {
        if (isValidTextSection(el) && !alreadyInArticle(el)) {
          const heading = el.querySelector(
            'h2, h3, h4, [class*="title"], [class*="heading"]'
          );
          const title = heading ? heading.textContent.trim() : "Похожие материалы";
          sections.push({ type: "related", title, html: cleanExtraHTML(el) });
        }
      }
    } catch (_) {}
  }

  return sections;
}
