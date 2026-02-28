/**
 * NewsSphere - Saved News page
 * Reads saved articles from localStorage and renders them. Supports remove, dark mode, toast.
 */

(function () {
  'use strict';

  const STORAGE_SAVED = 'newssphere_saved';
  const STORAGE_THEME = 'newssphere_theme';

  const el = {
    grid: document.getElementById('saved-grid'),
    empty: document.getElementById('saved-empty'),
    loading: document.getElementById('saved-loading'),
    themeToggle: document.getElementById('theme-toggle'),
    toastContainer: document.getElementById('toast-container'),
  };

  // ----- Toast -----
  function showToast(message, duration) {
    duration = duration || 2500;
    if (!el.toastContainer) return;
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    el.toastContainer.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', function () {
        toast.remove();
      });
    }, duration);
  }

  function getSaved() {
    try {
      var raw = localStorage.getItem(STORAGE_SAVED);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function removeSaved(url) {
    var list = getSaved();
    list = list.filter(function (x) { return x && x.url !== url; });
    localStorage.setItem(STORAGE_SAVED, JSON.stringify(list));
    showToast('Article removed');
    render();
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    try {
      localStorage.setItem(STORAGE_THEME, theme || 'light');
    } catch (_) { }
  }

  function render() {
    var list = getSaved();
    if (el.loading) el.loading.hidden = true;
    if (el.empty) el.empty.hidden = list.length > 0;
    if (!el.grid) return;

    el.grid.innerHTML = '';
    list.forEach(function (a, i) {
      var card = document.createElement('article');
      card.className = 'article-card';
      card.setAttribute('data-url', a.url || '');
      card.style.animationDelay = (i * 0.05) + 's';
      card.innerHTML =
        (a.urlToImage
          ? '<img class="article-card-image" src="' + escapeHtml(a.urlToImage) + '" alt="" loading="lazy" />'
          : '<div class="article-card-image" style="background:var(--border)" aria-hidden="true"></div>') +
        '<div class="article-card-body">' +
        '<h3 class="article-card-title"><a href="' + escapeHtml(a.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(a.title || 'Untitled') + '</a></h3>' +
        (a.description ? '<p class="article-card-desc">' + escapeHtml(a.description) + '</p>' : '') +
        '<div class="article-card-meta">' +
        '<span class="article-card-source">' + escapeHtml(a.source || '') + '</span>' +
        '<span>' + formatDate(a.publishedAt) + '</span>' +
        '</div>' +
        '<div class="article-card-actions">' +
        '<a class="btn-read-more" href="' + escapeHtml(a.url) + '" target="_blank" rel="noopener noreferrer">Read more</a>' +
        '<button type="button" class="btn-save saved btn-remove" data-url="' + escapeHtml(a.url) + '" aria-label="Remove from saved">Remove</button>' +
        '</div></div>';
      var btn = card.querySelector('.btn-remove');
      if (btn) btn.addEventListener('click', function () { removeSaved(this.getAttribute('data-url')); });
      el.grid.appendChild(card);
    });
  }

  function init() {
    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    var theme = 'light';
    try {
      theme = localStorage.getItem(STORAGE_THEME) || 'light';
    } catch (_) { }
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (theme === 'dark' || (!theme && prefersDark)) applyTheme('dark');
    else applyTheme('light');

    if (el.themeToggle) {
      el.themeToggle.addEventListener('click', function () {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        applyTheme(isDark ? 'light' : 'dark');
      });
    }

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
