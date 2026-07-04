import { htmlToMarkdown } from "./turndown-config.js";

function isTwitterPage() {
  const host = window.location.hostname;
  return host === "x.com" || host === "twitter.com";
}

function getTwitterPageType() {
  const path = window.location.pathname;
  if (path.match(/\/\w+\/status\/\d+/)) return "single-tweet";
  if (path === "/home" || path === "/") return "timeline";
  if (path.match(/^\/\w+$/)) return "profile";
  return "other";
}

function waitForTweets(timeout = 3e3) {
  return new Promise((resolve) => {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    if (tweets.length > 0) {
      resolve(tweets);
      return;
    }
    const observer = new MutationObserver((_mutations, obs) => {
      const found = document.querySelectorAll('article[data-testid="tweet"]');
      if (found.length > 0) {
        obs.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelectorAll('article[data-testid="tweet"]'));
    }, timeout);
  });
}

function formatTweetHtml(tweet) {
  const textEl = tweet.querySelector('[data-testid="tweetText"]');
  if (!textEl) return null;
  const authorEl = tweet.querySelector('[data-testid="User-Name"]');
  const author = authorEl?.textContent?.trim() || "";
  const timeEl = tweet.querySelector("time");
  const datetime = timeEl?.getAttribute("datetime") || "";
  const lines = [];
  if (author) {
    const dateStr = datetime ? ` — ${datetime.slice(0, 10)}` : "";
    lines.push(`<p><strong>${author}</strong>${dateStr}</p>`);
  }
  lines.push(textEl.innerHTML);
  const quoteTweet = tweet.querySelector(
    ':scope > div > div article[data-testid="tweet"]'
  );
  if (quoteTweet) {
    const quoteText = quoteTweet.querySelector('[data-testid="tweetText"]');
    const quoteAuthor = quoteTweet.querySelector('[data-testid="User-Name"]');
    if (quoteText) {
      lines.push("<blockquote><p>");
      if (quoteAuthor)
        lines.push(`<strong>${quoteAuthor.textContent?.trim()}</strong><br>`);
      lines.push(`${quoteText.innerHTML}</p></blockquote>`);
    }
  }
  const images = tweet.querySelectorAll('[data-testid="tweetPhoto"] img');
  for (const img of images) {
    const alt = img.getAttribute("alt") || "";
    const src = img.getAttribute("src") || "";
    lines.push(`<p>![${alt}](${src})</p>`);
  }
  return lines.join("\n");
}

export async function extractTweets() {
  if (!isTwitterPage()) return null;
  const pageType = getTwitterPageType();
  if (pageType === "other") return null;
  const tweets = await waitForTweets();
  if (tweets.length === 0) return null;
  const pageAuthorMatch = window.location.pathname.match(/^\/(\w+)/);
  const pageAuthor = pageAuthorMatch?.[1] || "";
  const parts = [];
  let count = 0;
  for (const tweet of tweets) {
    const tweetHtml = formatTweetHtml(tweet);
    if (!tweetHtml) continue;
    if (pageType === "single-tweet" && count > 0) {
      const tweetAuthorEl = tweet.querySelector('[data-testid="User-Name"]');
      const tweetAuthor = tweetAuthorEl?.textContent?.trim() || "";
      if (!tweetAuthor.includes(pageAuthor) && count > 1) break;
    }
    parts.push(tweetHtml);
    parts.push("<hr>");
    count++;
  }
  if (count === 0) return null;
  parts.pop();
  let title = document.title
    .replace(/ \| X$/, "")
    .replace(/ \/ X$/, "")
    .replace(/ \(@\w+\)$/, "")
    .trim();
  if (!title) title = `Tweets from ${pageAuthor}`;
  const html = `<h1>${title}</h1>\n${parts.join("\n")}`;
  return { title, markdown: htmlToMarkdown(html) };
}
