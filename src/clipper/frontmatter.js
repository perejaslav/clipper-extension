export function generateFrontmatter(doc, article) {
  const url = window.location.href;
  const title = (article && article.title) || doc.title || "";
  const metaDesc = doc.querySelector(
    'meta[name="description"], meta[property="og:description"]'
  );
  const description = metaDesc ? metaDesc.getAttribute("content").trim() : "";
  const today = new Date().toISOString().split("T")[0];
  let yaml = "---\n";
  yaml += `title: |\n  ${title.replace(/\n/g, "\n  ")}\n`;
  yaml += `source: "${url}"\n`;
  yaml += `created: ${today}\n`;
  if (description) {
    yaml += `description: |\n  ${description.replace(/\n/g, "\n  ")}\n`;
  }
  yaml += `tags:\n  - "clippings"\n`;
  yaml += "---\n\n";
  return yaml;
}
