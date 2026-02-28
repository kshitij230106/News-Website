/**
 * NewsSphere - Main frontend logic
 * Handles: headlines, categories, search, trending, save/bookmark, dark mode, loading, pagination,
 * toast notifications, hamburger menu, back-to-top.
 */

(function () {
  'use strict';

  // API base: use relative path when frontend is served from same host as backend (e.g. Express). For Netlify+Render set window.NEWSPHERE_API_URL.
  const API_BASE = typeof window.NEWSPHERE_API_URL === 'string' ? window.NEWSPHERE_API_URL.replace(/\/$/, '') : '';

  const STORAGE_SAVED = 'newssphere_saved';
  const STORAGE_THEME = 'newssphere_theme';
  const STORAGE_COUNTRY = 'newssphere_country';
  const PAGE_SIZE = 50; // Increased to show more news on front page

  let currentPage = 1;
  let currentCategory = '';
  let currentCountry = localStorage.getItem(STORAGE_COUNTRY) || 'us';
  let currentQuery = '';
  let totalResults = 0;
  let isLoading = false;
  let isSearchMode = false;
  let lastArticles = []; // Keep last fetched set for client-side re-sort

  const el = {
    grid: document.getElementById('articles-grid'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error-message'),
    errorText: document.getElementById('error-text'),
    retryBtn: document.getElementById('retry-btn'),
    noResults: document.getElementById('no-results'),
    loadMoreWrap: document.getElementById('load-more-wrap'),
    loadMoreBtn: document.getElementById('load-more-btn'),
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-input'),
    countryFilter: document.getElementById('country-filter'),
    dateSort: document.getElementById('date-sort'),
    resultsLabel: document.getElementById('results-label'),
    themeToggle: document.getElementById('theme-toggle'),
    trendingList: document.getElementById('trending-list'),
    trendingLoading: document.getElementById('trending-loading'),
    toastContainer: document.getElementById('toast-container'),
    backToTop: document.getElementById('back-to-top'),
    hamburger: document.getElementById('hamburger'),
    navActions: document.getElementById('nav-actions'),
  };

  // ----- Toast Notifications -----
  function showToast(message, duration) {
    duration = duration || 2500;
    if (!el.toastContainer) return;
    const toast = document.createElement('div');
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

  // ----- Helpers -----
  function getSavedIds() {
    try {
      const raw = localStorage.getItem(STORAGE_SAVED);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map(function (x) { return (x && x.url) ? x.url : x; }).filter(Boolean) : []);
    } catch (_) {
      return new Set();
    }
  }

  function saveArticle(article) {
    const raw = localStorage.getItem(STORAGE_SAVED);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return;
    const item = toStorageItem(article);
    if (list.some(function (x) { return x && x.url === item.url; })) return;
    list.push(item);
    localStorage.setItem(STORAGE_SAVED, JSON.stringify(list));
  }

  function removeSaved(url) {
    const raw = localStorage.getItem(STORAGE_SAVED);
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return;
    list = list.filter(function (x) { return x && x.url !== url; });
    localStorage.setItem(STORAGE_SAVED, JSON.stringify(list));
  }

  function toStorageItem(a) {
    return {
      url: a.url,
      title: a.title,
      description: a.description || '',
      urlToImage: a.urlToImage || '',
      source: (a.source && (a.source.name || a.source.id)) || 'Unknown',
      publishedAt: a.publishedAt || '',
    };
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diff = (now - d) / 60000;
    if (diff < 1) return 'Just now';
    if (diff < 60) return Math.floor(diff) + 'm ago';
    if (diff < 1440) return Math.floor(diff / 60) + 'h ago';
    if (diff < 43200) return Math.floor(diff / 1440) + 'd ago';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function showLoading(show) {
    if (el.loading) el.loading.hidden = !show;
  }

  function showError(msg, showRetry) {
    if (el.error) {
      el.error.hidden = !msg;
      if (el.errorText) el.errorText.textContent = msg || '';
      if (el.retryBtn) el.retryBtn.style.display = showRetry ? '' : 'none';
    }
  }

  function showNoResults(show) {
    if (el.noResults) el.noResults.hidden = !show;
  }

  function setResultsLabel(text) {
    if (el.resultsLabel) el.resultsLabel.textContent = text;
  }

  function sortArticlesByDate(articles, order) {
    const list = [].concat(articles);
    list.sort(function (a, b) {
      var ta = new Date(a.publishedAt || 0).getTime();
      var tb = new Date(b.publishedAt || 0).getTime();
      return order === 'oldest' ? ta - tb : tb - ta;
    });
    return list;
  }

  // ----- Fetch API -----
  async function fetchHeadlines(opts) {
    const o = opts || {};
    const params = new URLSearchParams({
      country: o.country || currentCountry,
      page: String(o.page || 1),
      pageSize: String(PAGE_SIZE),
    });
    if (o.category) params.set('category', o.category);
    const res = await fetch(API_BASE + '/api/headlines?' + params.toString());
    if (!res.ok) {
      const data = await res.json().catch(function () { return {}; });
      throw new Error(data.error || res.statusText || 'Failed to fetch');
    }
    return res.json();
  }

  async function fetchSearch(opts) {
    const o = opts || {};
    const params = new URLSearchParams({
      q: o.q || currentQuery,
      page: String(o.page || 1),
      pageSize: String(PAGE_SIZE),
      sortBy: o.sortBy || (el.dateSort && el.dateSort.value) || 'publishedAt',
    });
    const res = await fetch(API_BASE + '/api/search?' + params.toString());
    if (!res.ok) {
      const data = await res.json().catch(function () { return {}; });
      throw new Error(data.error || res.statusText || 'Search failed');
    }
    return res.json();
  }

  async function fetchTrending() {
    const res = await fetch(API_BASE + '/api/trending?pageSize=15');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles || []).filter(function (a) { return a.title && a.title !== '[Removed]'; });
  }

  // ----- Render article card -----
  function renderCard(article, savedIds) {
    const id = article.url;
    const saved = savedIds.has(id);
    const sourceName = (article.source && (article.source.name || article.source.id)) || 'Unknown';
    const card = document.createElement('article');
    card.className = 'article-card';
    card.setAttribute('data-url', id);
    card.innerHTML =
      (article.urlToImage
        ? '<img class="article-card-image" src="' + escapeHtml(article.urlToImage) + '" alt="" loading="lazy" />'
        : '<div class="article-card-image" style="background:var(--border)" aria-hidden="true"></div>') +
      '<div class="article-card-body">' +
      '<h3 class="article-card-title"><a href="' + escapeHtml(article.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(article.title || 'Untitled') + '</a></h3>' +
      (article.description ? '<p class="article-card-desc">' + escapeHtml(article.description) + '</p>' : '') +
      '<div class="article-card-meta">' +
      '<span class="article-card-source">' + escapeHtml(sourceName) + '</span>' +
      '<span>' + formatDate(article.publishedAt) + '</span>' +
      '</div>' +
      '<div class="article-card-actions">' +
      '<a class="btn-read-more" href="' + escapeHtml(article.url) + '" target="_blank" rel="noopener noreferrer">Read more</a>' +
      '<button type="button" class="btn-save ' + (saved ? 'saved' : '') + '" data-url="' + escapeHtml(id) + '" aria-label="' + (saved ? 'Unsave' : 'Save') + '">' + (saved ? '✓ Saved' : '♡ Save') + '</button>' +
      '</div></div>';
    var saveBtn = card.querySelector('.btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var url = this.getAttribute('data-url');
        var ids = getSavedIds();
        if (ids.has(url)) {
          removeSaved(url);
          this.classList.remove('saved');
          this.textContent = '♡ Save';
          this.setAttribute('aria-label', 'Save');
          showToast('Article removed from saved');
        } else {
          saveArticle(article);
          this.classList.add('saved');
          this.textContent = '✓ Saved';
          this.setAttribute('aria-label', 'Unsave');
          showToast('Article saved!');
        }
      });
    }
    return card;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // ----- Load and render main grid -----
  function clearGrid() {
    if (el.grid) el.grid.innerHTML = '';
  }

  function appendArticles(articles, sortOrder) {
    if (!el.grid) return;
    var order = sortOrder || (el.dateSort && el.dateSort.value) || 'latest';
    var sorted = sortArticlesByDate(articles, order === 'oldest' ? 'oldest' : 'latest');
    var savedIds = getSavedIds();
    sorted.forEach(function (a, i) {
      if (a.title && a.title !== '[Removed]') {
        var card = renderCard(a, savedIds);
        card.style.animationDelay = (i * 0.05) + 's';
        el.grid.appendChild(card);
      }
    });
  }

  async function loadContent(resetPage) {
    if (isLoading) return;
    var page = resetPage ? 1 : currentPage;
    if (resetPage) {
      currentPage = 1;
      clearGrid();
      showNoResults(false);
      showError('');
    }

    isLoading = true;
    showLoading(true);
    showError('');

    try {
      var data;
      if (isSearchMode && currentQuery.trim()) {
        data = await fetchSearch({ page: page });
        totalResults = data.totalResults || 0;
        setResultsLabel(totalResults ? '"' + currentQuery + '" — ' + totalResults + ' results' : 'Search results');
      } else {
        data = await fetchHeadlines({ category: currentCategory || undefined, page: page });
        totalResults = data.totalResults || 0;
        var label = currentCategory ? currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1) + ' news' : 'Top headlines';
        setResultsLabel(totalResults ? label + ' (' + totalResults + ')' : label);
      }

      var articles = data.articles || [];
      if (page === 1) {
        lastArticles = [];
      }
      lastArticles = lastArticles.concat(articles);
      if (page === 1 && articles.length === 0) {
        showNoResults(true);
      } else {
        appendArticles(articles);
        var totalLoaded = page * PAGE_SIZE;
        if (el.loadMoreWrap) {
          el.loadMoreWrap.hidden = totalLoaded >= totalResults || articles.length < PAGE_SIZE;
        }
      }
      if (resetPage && el.grid) el.grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      showError(err.message || 'Something went wrong. Please try again.', true);
      showNoResults(false);
      if (el.loadMoreWrap) el.loadMoreWrap.hidden = true;
    } finally {
      showLoading(false);
      isLoading = false;
    }
  }

  // ----- Trending sidebar -----
  async function loadTrending() {
    if (el.trendingLoading) el.trendingLoading.hidden = false;
    if (el.trendingList) el.trendingList.innerHTML = '';
    try {
      var articles = await fetchTrending();
      var sorted = sortArticlesByDate(articles, 'latest');
      sorted.slice(0, 15).forEach(function (a) {
        var sourceName = (a.source && (a.source.name || a.source.id)) || '';
        var node = document.createElement('a');
        node.className = 'trending-item';
        node.href = a.url;
        node.target = '_blank';
        node.rel = 'noopener noreferrer';
        node.innerHTML =
          '<div><span class="trending-item-title">' + escapeHtml(a.title || '') + '</span>' +
          '<span class="trending-item-meta">' + escapeHtml(sourceName) + ' · ' + formatDate(a.publishedAt) + '</span></div>';
        el.trendingList.appendChild(node);
      });
    } catch (_) {
      if (el.trendingList) el.trendingList.innerHTML = '<p class="trending-item-meta">Unable to load trending.</p>';
    }
    if (el.trendingLoading) el.trendingLoading.hidden = true;
  }

  // ----- Dark mode -----
  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    try {
      localStorage.setItem(STORAGE_THEME, theme || 'light');
    } catch (_) { }
  }

  function initTheme() {
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
  }

  // ----- Back to top -----
  function initBackToTop() {
    if (!el.backToTop) return;
    window.addEventListener('scroll', function () {
      if (window.scrollY > 400) el.backToTop.classList.add('visible');
      else el.backToTop.classList.remove('visible');
    }, { passive: true });
    el.backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ----- Hamburger menu -----
  function initHamburger() {
    if (!el.hamburger || !el.navActions) return;
    // Start collapsed on mobile
    if (window.innerWidth <= 768) {
      el.navActions.classList.add('collapsed');
    }
    el.hamburger.addEventListener('click', function () {
      this.classList.toggle('active');
      el.navActions.classList.toggle('collapsed');
    });
  }

  // ----- Event bindings -----
  function bindEvents() {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        currentCategory = this.getAttribute('data-category') || '';
        isSearchMode = false;
        currentQuery = '';
        if (el.searchInput) el.searchInput.value = '';
        loadContent(true);
      });
    });

    if (el.searchForm) {
      el.searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = (el.searchInput && el.searchInput.value || '').trim();
        if (!q) return;
        currentQuery = q;
        isSearchMode = true;
        document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
        var headlinesTab = document.querySelector('.tab[data-category=""]');
        if (headlinesTab) headlinesTab.classList.add('active');
        loadContent(true);
      });
    }

    if (el.countryFilter) {
      el.countryFilter.value = currentCountry; // Set initial value from localStorage
      el.countryFilter.addEventListener('change', function () {
        currentCountry = this.value || 'us';
        try { localStorage.setItem(STORAGE_COUNTRY, currentCountry); } catch (_) { }
        loadContent(true);
      });
    }

    if (el.dateSort) {
      el.dateSort.addEventListener('change', function () {
        var order = this.value === 'oldest' ? 'oldest' : 'latest';
        if (lastArticles.length) {
          clearGrid();
          appendArticles(lastArticles, order);
        }
      });
    }

    if (el.retryBtn) el.retryBtn.addEventListener('click', function () { loadContent(true); });
    if (el.loadMoreBtn) {
      el.loadMoreBtn.addEventListener('click', function () {
        currentPage += 1;
        loadContent(false);
      });
      // Infinite scroll: when Load more button is visible, trigger load
      var observer = new IntersectionObserver(
        function (entries) {
          if (entries[0] && entries[0].isIntersecting && el.loadMoreWrap && !el.loadMoreWrap.hidden && !isLoading) {
            currentPage += 1;
            loadContent(false);
          }
        },
        { rootMargin: '200px', threshold: 0 }
      );
      if (el.loadMoreWrap) observer.observe(el.loadMoreWrap);
    }
  }

  // ----- Init -----
  function init() {
    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    initTheme();
    initBackToTop();
    initHamburger();
    bindEvents();
    loadContent(true);
    loadTrending();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
