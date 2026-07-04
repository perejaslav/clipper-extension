// Scaffold entry — full migration in Phase 2 step 2+
if (window.__clipperLoaded) {
} else {
  window.__clipperLoaded = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "extract") {
      sendResponse({
        error: "dist/content.js scaffold — migration not complete",
      });
    }
    return true;
  });
}
