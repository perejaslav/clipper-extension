import { extractFromDocument } from "./extract-document.js";
import { extractTweets } from "./extract-twitter.js";

async function extract() {
  const twitterResult = await extractTweets();
  if (twitterResult) return twitterResult;
  return extractFromDocument();
}

if (!window.__clipperLoaded) {
  window.__clipperLoaded = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "extract") {
      extract().then(sendResponse);
    }
    return true;
  });
}
