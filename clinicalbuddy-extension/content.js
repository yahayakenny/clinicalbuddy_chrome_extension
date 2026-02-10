/**
 * ClinicalBuddy content script – runs on all URLs.
 * Extracts page title, URL, and heading-based text chunks for the side panel / API.
 */

function getMainContent() {
  const selectors = ['article', 'main', '[role="main"]', '.content', '#content', '#main'];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim().length > 50) return el;
  }
  return document.body;
}

function getHeadingLevel(tagName) {
  const m = tagName.match(/^[Hh]([1-6])$/);
  return m ? parseInt(m[1], 10) : 0;
}

function extractChunks(root) {
  const chunks = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const level = getHeadingLevel(node.tagName);
      if (level >= 1 && level <= 3) return NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_SKIP;
    }
  });

  let node;
  const headings = [];
  while ((node = walker.nextNode())) headings.push(node);

  if (headings.length === 0) {
    const text = root.innerText || root.textContent || '';
    if (text.trim()) chunks.push({ heading: '', text: text.trim().slice(0, 50000) });
    return chunks;
  }

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const level = getHeadingLevel(h.tagName);
    const headingText = (h.textContent || '').trim();
    const parts = [];
    let sibling = h.nextElementSibling;
    while (sibling) {
      const sLevel = getHeadingLevel(sibling.tagName);
      if (sLevel >= 1 && sLevel <= 3 && sLevel <= level) break;
      parts.push(sibling.textContent || '');
      sibling = sibling.nextElementSibling;
    }
    const text = headingText + (parts.length ? '\n' + parts.join('\n') : '');
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (trimmed) chunks.push({ heading: headingText, text: trimmed.slice(0, 15000) });
  }

  return chunks;
}

function extractPageContent() {
  const root = getMainContent();
  const chunks = extractChunks(root);
  return {
    title: document.title || '',
    url: window.location.href,
    chunks
  };
}

function clearEnhancements() {
  const root = getMainContent();
  if (!root) return;
  root.querySelectorAll('.cb-heading-summary').forEach(function (el) { el.remove(); });
  root.querySelectorAll('.cb-highlight-red, .cb-highlight-amber, .cb-highlight-blue, .cb-dim').forEach(function (el) {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
}

function applyHeadingSummaries(headingSummaries) {
  if (!headingSummaries || !headingSummaries.length) return;
  const root = getMainContent();
  const headings = root.querySelectorAll('h1, h2, h3');
  headingSummaries.forEach(function (item, i) {
    const el = headings[i];
    if (!el) return;
    var div = document.createElement('div');
    div.className = 'cb-heading-summary';
    var relClass = 'cb-relevance-low';
    if (item.relevance === 'High') relClass = 'cb-relevance-high';
    else if (item.relevance === 'Medium') relClass = 'cb-relevance-medium';
    div.innerHTML = '<span class="cb-relevance ' + relClass + '">' + (item.relevance || '') + '</span>' + (item.oneLineSummary || '');
    el.parentNode.insertBefore(div, el.nextSibling);
  });
}

// Match bullet text to page: we search for the first text node containing this text (or a
// leading substring) so the same id on the sidebar bullet and on this span links click → scroll.
function wrapFirstMatch(root, text, className, id) {
  if (!text || !className) return;
  var norm = text.replace(/\s+/g, ' ').trim();
  if (!norm || norm.length < 10) return;
  // Try full text first, then leading substrings so we still match when text is split across nodes
  var toTry = [norm];
  if (norm.length > 80) toTry.push(norm.slice(0, 80));
  if (norm.length > 50) toTry.push(norm.slice(0, 50));
  if (norm.length > 30) toTry.push(norm.slice(0, 30));
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  var node;
  while ((node = walker.nextNode())) {
    var nodeNorm = node.textContent.replace(/\s+/g, ' ');
    var search = null;
    for (var i = 0; i < toTry.length; i++) {
      if (toTry[i].length < 10) continue;
      if (nodeNorm.indexOf(toTry[i]) !== -1) { search = toTry[i]; break; }
    }
    if (!search) continue;
    var raw = node.textContent;
    var startInNode = raw.indexOf(search);
    var endInNode = startInNode + search.length;
    if (startInNode === -1) {
      var re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
      var m = raw.match(re);
      if (!m) continue;
      startInNode = m.index;
      endInNode = m.index + m[0].length;
    }
    var span = document.createElement('span');
    span.className = className;
    if (id) span.setAttribute('data-cb-id', id);
    try {
      var range = document.createRange();
      range.setStart(node, startInNode);
      range.setEnd(node, endInNode);
      range.surroundContents(span);
    } catch (e) {}
    return span;
  }
}

function applyHighlights(highlights) {
  if (!highlights || !highlights.length) return [];
  var root = getMainContent();
  var map = { red_flags: 'cb-highlight-red', thresholds: 'cb-highlight-amber', management: 'cb-highlight-blue', low_value: 'cb-dim' };
  var appliedIds = [];
  highlights.forEach(function (h) {
    var cls = map[h.type] || 'cb-highlight-amber';
    var span = wrapFirstMatch(root, h.text, cls, h.id);
    if (span && h.id) appliedIds.push(h.id);
  });
  return appliedIds;
}

function scrollToHighlight(id) {
  if (!id) return { ok: true, found: false };
  var el = document.querySelector('[data-cb-id="' + id.replace(/"/g, '\\"') + '"]');
  if (!el) return { ok: true, found: false };
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('cb-pulse');
  setTimeout(function () { el.classList.remove('cb-pulse'); }, 600);
  return { ok: true, found: true };
}

chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (msg.type === 'getPageContent') {
    try {
      sendResponse({ ok: true, data: extractPageContent() });
    } catch (e) {
      sendResponse({ ok: false, error: String(e.message) });
    }
    return true;
  }
  if (msg.type === 'applyPageEnhancements') {
    try {
      clearEnhancements();
      var payload = msg.payload || {};
      applyHeadingSummaries(payload.headingSummaries);
      var appliedIds = applyHighlights(payload.highlights);
      sendResponse({ ok: true, appliedIds: appliedIds || [] });
    } catch (e) {
      sendResponse({ ok: false, error: String(e.message), appliedIds: [] });
    }
    return true;
  }
  if (msg.type === 'scrollToHighlight') {
    try {
      var result = scrollToHighlight(msg.id);
      sendResponse(result || { ok: true, found: false });
    } catch (e) {
      sendResponse({ ok: false, found: false, error: String(e.message) });
    }
    return true;
  }
});
