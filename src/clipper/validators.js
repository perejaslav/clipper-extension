export function isValidTextSection(el, isFallbackMode = false) {
  if (!el) return false;
  const text = el.textContent.trim();
  if (text.length < 100) return false;

  const tag = el.tagName.toLowerCase();
  if (["nav", "footer", "header", "aside", "form", "dialog"].includes(tag))
    return false;
  if (el.closest("nav, footer, header, aside, form")) return false;

  const role = (el.getAttribute("role") || "").toLowerCase();
  if (
    ["navigation", "banner", "contentinfo", "complementary", "search", "menu"].includes(
      role
    )
  )
    return false;

  const htmlLen = el.innerHTML.length;
  if (htmlLen === 0 || htmlLen > 800000) return false;

  const density = text.length / htmlLen;
  const densityThreshold = isFallbackMode ? 0.05 : 0.12;
  if (density < densityThreshold) return false;

  const links = el.querySelectorAll("a").length;
  const totalNodes = el.querySelectorAll("*").length + 1;
  const linksThreshold = isFallbackMode ? 0.7 : 0.35;
  if (links / totalNodes > linksThreshold) return false;

  return true;
}

export function isCatalogOrGridSection(el) {
  if (!el) return false;
  const classes = (el.className || "").toString().toLowerCase();
  const id = (el.id || "").toLowerCase();
  const keywords = [
    "catalog",
    "products",
    "grid",
    "items",
    "shop",
    "category",
    "goods",
    "product-list",
    "product-grid",
  ];
  const matchByKeyword = keywords.some(
    (k) => classes.includes(k) || id.includes(k)
  );
  if (matchByKeyword) return true;

  const children = Array.from(el.children);
  if (children.length < 3) return false;
  const tagCounts = {};
  for (const child of children) {
    const key =
      child.tagName + "|" + (child.className || "").toString().trim().slice(0, 40);
    tagCounts[key] = (tagCounts[key] || 0) + 1;
  }
  const hasRepeatingCards = Object.values(tagCounts).some((c) => c >= 3);
  if (!hasRepeatingCards) return false;

  const hasLinksAndImages = children.some(
    (c) => c.querySelector("a") && c.querySelector("img")
  );
  return hasLinksAndImages;
}
