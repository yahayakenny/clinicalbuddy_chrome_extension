// Use production API when installed from Chrome Web Store (update_url set); localhost when unpacked (dev)
function getApiBase() {
  try {
    var manifest = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest && chrome.runtime.getManifest();
    if (manifest && manifest.update_url) return 'https://api.clinicalbuddy.co.uk';
  } catch (e) {}
  return 'http://localhost:8000';
}
const API_BASE = getApiBase();

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function renderSnapshot(snapshot, mode) {
  if (!snapshot || typeof snapshot !== 'object') return '';
  mode = mode || 'red_flags';
  var bullets = function (arr, idPrefix) {
    var list = Array.isArray(arr) ? arr : [];
    return list.map(function (b, i) {
      var text = b && (typeof b === 'string' ? b : b.text);
      var id = idPrefix ? idPrefix + '-' + i : '';
      var attrs = id ? ' data-cb-id="' + escapeHtml(id) + '" class="cb-scroll-to mt-1 text-gray-700 cursor-pointer hover:bg-gray-100 rounded px-1"' : ' class="mt-1 text-gray-700"';
      return '<li' + attrs + '>' + escapeHtml(text != null ? String(text) : '') + '</li>';
    }).join('');
  };
  var block = function (label, content, options) {
    var raw = content != null ? String(content).trim() : '';
    if (raw === '') return '';
    var labelClass = options && options.danger ? 'font-semibold text-red-700' : 'font-semibold text-gray-900';
    var safeContent = options && options.raw ? raw : escapeHtml(raw);
    return '<div class="snapshot-block py-2 border-b border-gray-200 last:border-b-0">' +
      '<p class="' + labelClass + ' mb-1 pb-0.5 text-xs uppercase tracking-wide">' + escapeHtml(label) + '</p>' +
      '<div class="text-gray-700 text-sm leading-relaxed">' + safeContent + '</div>' +
      '</div>';
  };
  var section = function (label, arr, idPrefix, danger) {
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return '<div class="snapshot-block py-2 border-b border-gray-200 last:border-b-0">' +
      '<p class="font-semibold ' + (danger ? 'text-red-700' : 'text-gray-900') + ' mb-1 pb-0.5 text-xs uppercase tracking-wide">' + escapeHtml(label) + '</p>' +
      '<ul class="list-disc pl-4 space-y-0.5">' + bullets(arr, idPrefix) + '</ul></div>';
  };
  var sections = [block('What this page is about', snapshot.about)];
  if (mode === 'red_flags') {
    sections.push(section('Red flags', snapshot.redFlags || [], 'red', true));
    sections.push(section('History and exam', snapshot.historyAndExam || [], 'hist', false));
  } else if (mode === 'management') {
    sections.push(section('Investigations', snapshot.investigations || [], 'inv', false));
    sections.push(section('Medical management', snapshot.medicalManagement || [], 'mgt', false));
    sections.push(section('Psychosocial / non-medical', snapshot.psychosocial || [], 'psy', false));
  } else {
    sections.push(section('Rx', snapshot.treatment || [], 'tx', false));
  }
  return '<div class="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden px-2 py-1.5">' + sections.filter(Boolean).join('') + '</div>';
}

function detectSiteType(url) {
  if (!url) return 'generic';
  if (/cks\.nice\.org\.uk/i.test(url)) return 'nice_cks';
  if (/pubmed|ncbi\.nlm\.nih\.gov/i.test(url)) return 'pubmed';
  return 'generic';
}

// Highlights use backend "match" text. Ids by mode: red_flags → red-*, hist-*; management → inv-*, mgt-*, psy-*; prescribing → tx-*.
function buildHighlightsFromSnapshot(snapshot, mode) {
  if (!snapshot || typeof snapshot !== 'object') return [];
  mode = mode || 'red_flags';
  var out = [];
  var add = function (arr, idPrefix, type) {
    if (!Array.isArray(arr)) return;
    arr.forEach(function (item, i) {
      var match = item && (typeof item === 'string' ? item : item.match || item.text);
      if (match && String(match).trim()) out.push({ type: type, text: String(match).trim(), id: idPrefix + '-' + i });
    });
  };
  if (mode === 'red_flags') {
    add(snapshot.redFlags, 'red', 'red_flags');
    add(snapshot.historyAndExam, 'hist', 'management');
  } else if (mode === 'management') {
    add(snapshot.investigations, 'inv', 'management');
    add(snapshot.medicalManagement, 'mgt', 'management');
    add(snapshot.psychosocial, 'psy', 'management');
  } else {
    add(snapshot.treatment, 'tx', 'management');
  }
  return out;
}

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const snapshotEl = document.getElementById('snapshot');
  const modeBar = document.getElementById('mode-bar');
  const modeBtns = document.querySelectorAll('.mode-btn');

  let pageData = null;
  let currentMode = 'red_flags';
  // Session cache per page: key = url + '|' + mode. Data is cached until URL changes (new tab/page)
  // or panel is closed. No persistence – refetch when user returns to the same URL uses cache.
  let snapshotCache = {};

  function cacheKey(url, mode) {
    return (url || '') + '|' + (mode || '');
  }

  function getCachedSnapshot(url, mode) {
    return snapshotCache[cacheKey(url, mode)];
  }

  function setCachedSnapshot(url, mode, snapshot) {
    snapshotCache[cacheKey(url, mode)] = { snapshot: snapshot };
  }

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.className = 'm-0 ' + (isError ? 'text-red-600' : 'text-gray-500');
    statusEl.classList.remove('hidden');
    snapshotEl.classList.add('hidden');
  }

  function showSnapshot(html, snapshot, mode) {
    statusEl.classList.add('hidden');
    snapshotEl.innerHTML = html;
    snapshotEl.classList.remove('hidden');
    var highlights = buildHighlightsFromSnapshot(snapshot || null, mode || currentMode);
    chrome.runtime.sendMessage({ type: 'applyPageEnhancements', payload: { headingSummaries: [], highlights: highlights } }, function (res) {
      var appliedIds = res && res.appliedIds ? res.appliedIds : [];
      appliedIds.forEach(function (id) {
        try {
          var sel = typeof CSS !== 'undefined' && CSS.escape ? '[data-cb-id="' + CSS.escape(id) + '"]' : '[data-cb-id="' + id.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]';
          var el = snapshotEl.querySelector(sel);
          if (el && !el.querySelector('.cb-highlightable-icon')) {
            var icon = document.createElement('span');
            icon.className = 'cb-highlightable-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.setAttribute('title', 'Highlighted on page – click to scroll');
            el.insertBefore(icon, el.firstChild);
          }
        } catch (e) {}
      });
    });
  }

  snapshotEl.addEventListener('click', function (e) {
    var li = e.target.closest('.cb-scroll-to');
    if (!li) return;
    var id = li.getAttribute('data-cb-id');
    if (!id) return;
    chrome.runtime.sendMessage({ type: 'scrollToHighlight', id: id }, function (res) {
      if (res && res.ok && res.found) return;
      setStatus('No matching highlight on this page', false);
      setTimeout(function () {
        if (snapshotEl.classList.contains('hidden')) return;
        statusEl.classList.add('hidden');
        snapshotEl.classList.remove('hidden');
      }, 2000);
    });
  });

  function setModeActive(mode) {
    currentMode = mode;
    modeBtns.forEach(btn => {
      const on = btn.getAttribute('data-mode') === mode;
      btn.classList.toggle('bg-primaryButton', on);
      btn.classList.toggle('text-secondaryButton', on);
      btn.classList.toggle('border-primaryButton', on);
      btn.classList.toggle('bg-white', !on);
      btn.classList.toggle('text-gray-700', !on);
      btn.classList.toggle('border-gray-200', !on);
    });
  }

  function fetchSnapshot() {
    if (!pageData) return;
    var url = pageData.url;
    var mode = currentMode;
    var cached = getCachedSnapshot(url, mode);
    if (cached && cached.snapshot) {
      try {
        var html = renderSnapshot(cached.snapshot, currentMode);
        showSnapshot(html || '<p class="text-gray-500">No summary returned.</p>', cached.snapshot, currentMode);
      } catch (e) {
        setStatus('Could not display summary.', true);
      }
      return;
    }
    setStatus('Getting summary…', false);
    var payload = {
      mode: currentMode,
      siteType: detectSiteType(pageData.url),
      title: pageData.title,
      url: pageData.url,
      chunks: pageData.chunks,
    };
    fetch(API_BASE + '/api/extension-reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        if (res.status === 429) throw new Error('Too many requests – try again in a minute.');
        if (!res.ok) {
          // Surface HTTP errors clearly in the panel
          throw new Error('HTTP ' + res.status + ' from API (' + API_BASE + ')');
        }
        return res.json();
      })
      .then(function (data) {
        try {
          var snap = data && data.snapshot ? data.snapshot : null;
          if (!snap || typeof snap !== 'object') {
            setStatus('No summary returned from API (' + API_BASE + ', mode=' + mode + ').', true);
            // Also log raw payload to the console for debugging
            try { console.error('ClinicalBuddy empty snapshot', data); } catch (e2) {}
            return;
          }
          setCachedSnapshot(url, mode, snap);
          var html = renderSnapshot(snap, currentMode);
          showSnapshot(html || '<p class="text-gray-500">No summary returned.</p>', snap, currentMode);
        } catch (e) {
          setStatus('Could not display summary (' + (e && e.message ? e.message : 'render error') + ').', true);
          try { console.error('ClinicalBuddy render error', e); } catch (e2) {}
        }
      })
      .catch(function (err) {
        setStatus('Summary failed (' + API_BASE + '): ' + (err && err.message ? err.message : 'network error'), true);
        try { console.error('ClinicalBuddy fetch error', err); } catch (e2) {}
      });
  }

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setModeActive(btn.getAttribute('data-mode'));
      fetchSnapshot();
    });
  });

  function onPageContentReceived(response) {
    if (!response) {
      setStatus('Could not get page content. Reload the tab and try again.', true);
      return;
    }
    if (!response.ok) {
      setStatus(response.error || 'Error', true);
      return;
    }
    pageData = response.data;
    var chunkCount = pageData.chunks ? pageData.chunks.length : 0;
    setStatus(chunkCount + ' section(s) extracted. Choose a mode or wait for summary.', false);
    modeBar.classList.remove('hidden');
    setModeActive('red_flags');
    fetchSnapshot();
  }

  function requestPageContent() {
    setStatus('Loading page content…', false);
    snapshotEl.classList.add('hidden');
    chrome.runtime.sendMessage({ type: 'getPageContent' }, onPageContentReceived);
  }

  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.type === 'tabChanged') {
      if (pageData && pageData.url === msg.url) return;
      requestPageContent();
    }
  });

  requestPageContent();
});
