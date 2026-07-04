const removalSelectors = [
  "#clipper-root",
  '[id*="clipper"]',
  '[class*="clipper"]',
  ".clipper-panel",
  ".clipper-overlay",
  ".clipper-ui",
  ".cookie-banner",
  ".cookie-notice",
  '[class*="cookie"]',
  '[id*="cookie"]',
  ".quick-settings",
  "#quick-settings",
  ".product-tabs",
  ".nav-tabs",
  ".newsletter-signup",
  ".newsletter-box",
  '[class*="newsletter"]',
  '[id*="newsletter"]',
  ".membership-box",
  ".join-community",
  '[class*="plus-block"]',
  ".premium-rewards",
  ".latest-news",
  ".trending-articles",
  ".more-from",
  ".latest-in",
  ".recirc-wrapper",
  '[data-component="recirculation"]',
  ".sub-box",
  "aside",
  ".sidebar",
  ".commercial-block",
  ".ad-wrapper",
  ".share-buttons",
  ".social-share",
  '[class*="share-list"]',
  ".share-container",
];

const textRemovalPhrases = [
  "файлы 'cookie'",
  "файлы cookie",
  "sign up for the latest discoveries",
  "join our community",
  "delivered straight to your inbox",
  "become a member in seconds",
  "confirm your public display name",
  "please logout and then login",
  "you must be logged in to comment",
];

export function prepareDocSnapshot(doc) {
  const docSnapshot = doc.cloneNode(true);

  for (const sel of removalSelectors) {
    docSnapshot.querySelectorAll(sel).forEach((el) => el.remove());
  }

  docSnapshot.querySelectorAll("div, section, form, p, li").forEach((el) => {
    if (!el.textContent) return;
    const lower = el.textContent.toLowerCase();
    if (textRemovalPhrases.some((phrase) => lower.includes(phrase))) {
      el.remove();
    }
  });

  docSnapshot.querySelectorAll("li, a").forEach((el) => {
    if (el.textContent && el.textContent.trim().toLowerCase() === "copy link") {
      const parentList = el.closest("ul, ol");
      if (parentList) parentList.remove();
      else el.remove();
    }
  });

  docSnapshot.querySelectorAll('a[href^="#"]').forEach((link) => {
    if (link.closest("ul, ol, nav")) {
      link.remove();
    }
  });

  return docSnapshot;
}
