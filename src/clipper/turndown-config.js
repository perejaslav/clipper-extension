import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

function getExt(node) {
  const match = node.outerHTML.match(/(highlight-source-|language-)[a-z]+/);
  if (match) return match[0].split("-").pop() || "";
  const parentMatch =
    node.parentNode && "innerHTML" in node.parentNode
      ? node.parentNode.innerHTML
          .split(">")
          .shift()
          .match(/(highlight-source-|language-)[a-z]+/)
      : null;
  if (parentMatch) return parentMatch[0].split("-").pop() || "";
  const innerMatch = node.innerHTML
    .split(">")
    .shift()
    .match(/(highlight-source-|language-)[a-z]+/);
  if (innerMatch) return innerMatch[0].split("-").pop() || "";
  return "";
}

const turndownService = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

turndownService.use(gfm);

turndownService.addRule("keepCustomElements", {
  filter(node) {
    return (
      (node.tagName && node.tagName.includes("-")) ||
      (node.hasAttribute && node.hasAttribute("data-component"))
    );
  },
  replacement(content) {
    return "\n" + content.trim() + "\n";
  },
});

turndownService.addRule("fenceAllPreformattedText", {
  filter: ["pre"],
  replacement(_content, node) {
    const ext = getExt(node);
    const code = [...node.childNodes].map((c) => c.textContent).join("");
    return `\n\`\`\`${ext}\n${code}\n\`\`\`\n\n`;
  },
});

export function htmlToMarkdown(html) {
  let markdown = turndownService.turndown(html);
  return markdown.replace(/\[\]\(#[^)]*\)/g, "");
}
