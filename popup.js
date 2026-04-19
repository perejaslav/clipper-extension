(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const statusEl = document.getElementById("status");
const btnDownload = document.getElementById("btn-download");
const btnCopy = document.getElementById("btn-copy");
let result = null;
async function extract() {
  statusEl.textContent = "Извлечение контента...";
  statusEl.className = "status";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      statusEl.textContent = "Нет активной вкладки";
      statusEl.className = "status error";
      return;
    }
    const response = await chrome.tabs.sendMessage(tab.id, { action: "extract" });
    if (response.error) {
      statusEl.textContent = response.error;
      statusEl.className = "status error";
      return;
    }
    if (!response.markdown || response.markdown.trim().length === 0) {
      statusEl.textContent = "На странице не найден контент";
      statusEl.className = "status error";
      return;
    }
    result = response;
    statusEl.textContent = `Готово: ${response.title}`;
    statusEl.className = "status success";
    btnDownload.disabled = false;
    btnCopy.disabled = false;
  } catch {
    statusEl.textContent = "Не удалось получить доступ к странице. Попробуйте перезагрузить.";
    statusEl.className = "status error";
  }
}
function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, " ").trim().slice(0, 200) || "clipper";
}
btnDownload.addEventListener("click", async () => {
  if (!result) return;
  const blob = new Blob([result.markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({
    url,
    filename: `${sanitizeFilename(result.title)}.md`,
    saveAs: true
  });
  URL.revokeObjectURL(url);
});
btnCopy.addEventListener("click", async () => {
  if (!result) return;
  try {
    await navigator.clipboard.writeText(result.markdown);
    statusEl.textContent = "Скопировано в буфер обмена";
    statusEl.className = "status success";
    btnCopy.textContent = "Скопировано!";
    setTimeout(() => {
      btnCopy.textContent = "Копировать в буфер";
    }, 2e3);
  } catch {
    statusEl.textContent = "Не удалось скопировать в буфер";
    statusEl.className = "status error";
  }
});
extract();
