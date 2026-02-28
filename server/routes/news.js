/**
 * NewsSphere - Backend API Routes
 * Proxies requests to NewsData.io to keep API key secure on the server.
 */

const express = require('express');
const router = express.Router();

const NEWS_API_BASE = 'https://newsdata.io/api/1';
const API_KEY = process.env.NEWSDATA_API_KEY;

// Helper: normalize a NewsData.io article to match our frontend format
function normalizeArticle(item) {
  return {
    url: item.link || '',
    title: item.title || '',
    description: item.description || '',
    urlToImage: item.image_url || '',
    publishedAt: item.pubDate || '',
    source: {
      name: item.source_name || item.source_id || 'Unknown',
      id: item.source_id || '',
    },
    content: item.content || '',
  };
}

// Helper: fetch from NewsData.io with error handling
async function fetchNewsApi(endpoint, params = {}) {
  if (!API_KEY) {
    throw new Error('NEWS_API_KEY is not configured. Add it to your .env file.');
  }
  const url = new URL(NEWS_API_BASE + endpoint);
  url.searchParams.set('apikey', API_KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'NewsData.io returned a non-JSON response (HTTP ' + res.status + '). Please check your API key.'
    );
  }
  const data = await res.json();
  if (data.status === 'error') {
    const err = new Error((data.results && data.results.message) || data.message || 'NewsData API error');
    err.code = data.results && data.results.code;
    throw err;
  }
  return data;
}

/**
 * Helper: fetch multiple pages to satisfy requested pageSize (since API free tier strictly limits to 10 per request)
 */
async function fetchArticlesWithPagination(endpoint, baseParams, targetSize) {
  let allArticles = [];
  let currentPageToken = baseParams.page || null;
  let nextTokenToReturn = null;

  const params = { ...baseParams };
  delete params.size; // Force API default (10) to avoid "invalid size" error on free tier

  // Safety break: don't make more than 5 API requests per user load
  for (let i = 0; i < 5; i++) {
    if (currentPageToken && currentPageToken !== '1') params.page = currentPageToken;
    else delete params.page;

    const data = await fetchNewsApi(endpoint, params);
    const rawArticles = (data.results || []).map(normalizeArticle);

    // Dedupe within this batch explicitly
    const unique = rawArticles.filter((a, idx, arr) =>
      a.title && arr.findIndex((x) => x.title === a.title) === idx
    );

    allArticles.push(...unique);

    if (!data.nextPage) {
      nextTokenToReturn = null;
      break;
    }

    currentPageToken = data.nextPage;
    nextTokenToReturn = data.nextPage;

    // Dedupe across all fetched so far
    allArticles = allArticles.filter((a, idx, arr) => arr.findIndex((x) => x.title === a.title) === idx);

    if (allArticles.length >= targetSize) break;
  }

  return {
    articles: allArticles.slice(0, targetSize),
    nextPage: nextTokenToReturn,
    totalResults: allArticles.length // Approximation, API's totalResults is global
  };
}
/**
 * GET /api/headlines
 * Query: country, category, page, pageSize
 */
router.get('/headlines', async (req, res) => {
  try {
    const { country = 'us', category, page, pageSize = 20 } = req.query;
    const params = {
      country: country.toLowerCase(),
      language: 'en',
    };
    if (category) params.category = category;
    if (page && page !== '1') params.page = page;

    // Fetch up to the requested pageSize using our custom paginator
    const targetSize = Math.min(parseInt(pageSize, 10) || 20, 50);
    const data = await fetchArticlesWithPagination('/latest', params, targetSize);

    res.json({
      status: 'ok',
      totalResults: data.totalResults,
      articles: data.articles,
      nextPage: data.nextPage,
    });
  } catch (err) {
    console.error('Headlines error:', err.message);
    res.status(502).json({
      error: err.message || 'Failed to fetch headlines',
    });
  }
});

/**
 * GET /api/search
 * Query: q, language, page, pageSize
 */
router.get('/search', async (req, res) => {
  try {
    const { q, language = 'en', page, pageSize = 20 } = req.query;
    if (!q || q.trim() === '') {
      return res.status(400).json({ error: 'Search query "q" is required' });
    }
    const params = {
      q: q.trim(),
      language: language,
    };
    if (page && page !== '1') params.page = page;

    // Fetch up to the requested pageSize using our custom paginator
    const targetSize = Math.min(parseInt(pageSize, 10) || 20, 50);
    const data = await fetchArticlesWithPagination('/latest', params, targetSize);

    res.json({
      status: 'ok',
      totalResults: data.totalResults,
      articles: data.articles,
      nextPage: data.nextPage,
    });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(502).json({
      error: err.message || 'Search failed',
    });
  }
});

/**
 * GET /api/trending - latest news, randomized category for fresh content on refresh
 */
router.get('/trending', async (req, res) => {
  try {
    // Pick a random category to give "different news" on each refresh
    const categories = ['top', 'world', 'business', 'technology', 'entertainment', 'sports', 'health', 'science'];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];

    // Fetch in a single optimized request (fast, no long loading)
    const data = await fetchNewsApi('/latest', {
      country: 'us,gb,in,ca,au',
      language: 'en',
      category: randomCategory,
    });

    let articles = (data.results || []).map(normalizeArticle).filter((a) => a.title && a.title !== '[Removed]');

    // Shuffle the array of articles to randomize display order
    for (let i = articles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [articles[i], articles[j]] = [articles[j], articles[i]];
    }

    // Filter duplicates
    const unique = articles.filter((a, i, arr) => arr.findIndex((x) => x.url === a.url) === i);

    res.json({ articles: unique.slice(0, 10), totalResults: unique.length });
  } catch (err) {
    console.error('Trending error:', err.message);
    res.status(502).json({ error: err.message || 'Failed to fetch trending' });
  }
});

module.exports = router;
