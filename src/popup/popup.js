const statusEl = document.getElementById("status");
const btnDownload = document.getElementById("btn-download");
const btnCopy = document.getElementById("btn-copy");
let result = null;
const RESTRICTED_URL_RE =
  /^(chrome|chrome-extension|edge|brave|about|devtools|view-source):/i;

async function ensureContentScript(tabId) {
  const inject = () =>
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  try {
    await inject();
  } catch (err) {
    const msg = String(err?.message || err);
    if (/cannot access|extensions gallery|chrome:\/\/extensions/i.test(msg)) {
      throw new Error("RESTRICTED");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    await inject();
  }
}

async function extract() {
  statusEl.textContent = "Извлечение контента...";
  statusEl.className = "status";
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      statusEl.textContent = "Нет активной вкладки";
      statusEl.className = "status error";
      return;
    }
    if (tab.url && RESTRICTED_URL_RE.test(tab.url)) {
      statusEl.textContent =
        "Clipper недоступен на служебных страницах браузера";
      statusEl.className = "status error";
      return;
    }
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "extract",
    });
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
  } catch (err) {
    if (err?.message === "RESTRICTED") {
      statusEl.textContent = "Clipper недоступен на этой странице";
      statusEl.className = "status error";
      return;
    }
    statusEl.textContent =
      "Не удалось получить доступ к странице. Попробуйте перезагрузить.";
    statusEl.className = "status error";
  }
}

function sanitizeFilename(name) {
  return (
    name
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200) || "clipper"
  );
}

btnDownload.addEventListener("click", async () => {
  if (!result) return;
  const blob = new Blob([result.markdown], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({
    url,
    filename: `${sanitizeFilename(result.title)}.md`,
    saveAs: true,
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
