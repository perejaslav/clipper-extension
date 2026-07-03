# Content Extraction Improvement Plan (v2 — Enhanced)

> **Для agentic workers:** Использовать subagent-driven-development или executing-plans. Шаги с чекбоксами (`- [ ]`).

**Цель:** Расширить извлечение контента Clipper на комментарии, связанные статьи и дополнительный материал, который пропускает Mozilla Readability.

**Архитектура:** Гибридная. Readability извлекает основную статью. Новая функция `findExtraContent()` сканирует оригинальный DOM по селекторам + валидации плотности текста и добавляет найденные секции перед конвертацией Turndown.

**Коренная причина:** Readability ориентирован на один основной блок статьи. Комментарии и виджеты "related" живут вне него и отбрасываются.

**Техстек:** Vanilla JS (Chrome Extension MV3).

---

### Task 1: Git safety — baseline commit

**Файлы:**
- Создать: `.gitignore`

- [ ] **Step 1: Создать .gitignore**

Записать в `D:\progs\clipper\.gitignore`:
```
node_modules/
.DS_Store
Thumbs.db
*.log
*.bak
```

- [ ] **Step 2: Инициализация и baseline-коммит**

```bash
cd D:\progs\clipper && git init && git add . && git commit -m "baseline: перед улучшением извлечения контента"
```

---

### Task 2: Добавить helper-функцию `isValidTextSection(el)`

**Файлы:**
- Изменить: `content.js`

- [ ] **Step 1: Добавить функцию**

Вставить после строки ~2766 (после `extract_from_document` блока), перед `async function extract()`:

```javascript
function isValidTextSection(el) {
  if (!el) return false;
  const text = el.textContent.trim();
  if (text.length < 100) return false;

  const tag = el.tagName.toLowerCase();
  if (['nav', 'footer', 'header', 'aside', 'form', 'dialog'].includes(tag)) return false;
  if (el.closest('nav, footer, header, aside, form')) return false;

  const role = (el.getAttribute('role') || '').toLowerCase();
  if (['navigation', 'banner', 'contentinfo', 'complementary', 'search', 'menu'].includes(role)) return false;

  const htmlLen = el.innerHTML.length;
  if (htmlLen === 0 || htmlLen > 800000) return false; // защита от гигантских блоков

  const density = text.length / htmlLen;
  if (density < 0.12) return false;

  // Защита от меню/ссылочных блоков
  const links = el.querySelectorAll('a').length;
  const totalNodes = el.querySelectorAll('*').length + 1;
  if (links / totalNodes > 0.35) return false;

  return true;
}
```

- [ ] **Step 2: Проверить синтаксис**

```bash
node --check content.js
```

---

### Task 3: Добавить функцию `findExtraContent(doc, articleHtml)`

**Файлы:**
- Изменить: `content.js`

- [ ] **Step 1: Добавить функцию** (сразу после `isValidTextSection`)

```javascript
function cleanExtraHTML(el) {
  if (!el) return '';
  const clone = el.cloneNode(true);
  clone.querySelectorAll('script, style, iframe, noscript').forEach(n => n.remove());
  clone.querySelectorAll('*').forEach(node => {
    Array.from(node.attributes).forEach(attr => {
      if (attr.name.startsWith('on') || attr.name === 'style') node.removeAttribute(attr.name);
    });
  });
  return clone.outerHTML;
}

function findExtraContent(doc, articleHtml) {
  const sections = [];

  const commentSelectors = [ /* тот же расширенный список из оригинального плана */ ];
  const relatedSelectors = [ /* тот же расширенный список */ ];

  function alreadyInArticle(el) {
    const id = el.getAttribute('id');
    if (id && (articleHtml.includes(`id="${id}"`) || articleHtml.includes(`id='${id}'`))) return true;
    
    const textSample = el.textContent.trim().slice(0, 200);
    if (textSample.length < 50) return false;
    return articleHtml.includes(textSample);
  }

  // Комментарии — собираем все подходящие
  for (const sel of commentSelectors) {
    try {
      const elements = doc.querySelectorAll(sel);
      for (const el of elements) {
        if (isValidTextSection(el) && !alreadyInArticle(el)) {
          const heading = el.querySelector('h2, h3, h4, [class*="title"], [class*="heading"], [aria-label*="comment"]');
          const title = heading ? heading.textContent.trim() : 'Комментарии';
          sections.push({ type: 'comments', title, html: cleanExtraHTML(el) });
        }
      }
    } catch (_) {}
  }

  // Похожие материалы
  for (const sel of relatedSelectors) {
    try {
      const elements = doc.querySelectorAll(sel);
      for (const el of elements) {
        if (isValidTextSection(el) && !alreadyInArticle(el)) {
          const heading = el.querySelector('h2, h3, h4, [class*="title"], [class*="heading"]');
          const title = heading ? heading.textContent.trim() : 'Похожие материалы';
          sections.push({ type: 'related', title, html: cleanExtraHTML(el) });
        }
      }
    } catch (_) {}
  }

  return sections;
}
```

(Полные массивы селекторов я могу выдать отдельно или вставить сразу — они идентичны оригиналу + небольшие дополнения.)

- [ ] **Step 2: Проверить синтаксис**

```bash
node --check content.js
```

---

### Task 4: Модифицировать `extract_from_document()`

**Файлы:**
- Изменить: `content.js`

- [ ] **Step 1: Полная замена функции** (рекомендую заменить целиком для чистоты):

```javascript
function extract_from_document() {
  const docSnapshot = document.cloneNode(true);
  const article = new readabilityExports.Readability(document, {
    keepClasses: true,
    debug: false,
    charThreshold: 100
  }).parse();

  if (!article || !article.content) {
    return {
      title: document.title,
      markdown: "",
      error: "Не удалось извлечь контент с этой страницы"
    };
  }

  let html = article.content;
  html = html.replace(/(<!--.*?-->)/g, "");

  if (article.title.length > 0) {
    const h2Regex = /<h2[^>]*>(.*?)<\/h2>/;
    const match = html.match(h2Regex);
    if (match && match[0].includes(article.title)) {
      html = html.replace("<h2", "<h1").replace("</h2", "</h1");
    } else {
      html = `<h1>${article.title}</h1>\n${html}`;
    }
  }

  // Добавляем дополнительные секции
  const extraSections = findExtraContent(docSnapshot, html);
  for (const section of extraSections) {
    html += `\n\n<hr>\n<h2>${section.title}</h2>\n${section.html}`;
  }

  let markdown = turndownService.turndown(html);
  markdown = markdown.replace(/\[\]\(#[^)]*\)/g, "");
  
  return { title: article.title, markdown };
}
```

- [ ] **Step 2: Визуальная проверка diff**

---

### Task 5: Manual testing (расширенный)

- [ ] Habr.com (комментарии + related)
- [ ] Dev.to / VC.ru / Medium
- [ ] Wikipedia / простые страницы (без ложных секций)
- [ ] X.com (tweet path должен остаться нетронутым)
- [ ] Страница с большим количеством комментариев (проверить память и скорость)

---

### Task 6: Final commit

```bash
git add -A && git commit -m "feat: улучшенное извлечение комментариев и related-секций (v2)"
```

---

**Дополнительные рекомендации (опционально добавить как Task 7):**
- Добавить настройку в `chrome.storage` для отключения комментариев/related.
- Ограничить глубину поиска (`docSnapshot.querySelector('main, article, #content, body')`).

---