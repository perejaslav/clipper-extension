export function stripHtmlText(html) {
  return html.replace(/<[^>]+>/g, "").trim();
}
