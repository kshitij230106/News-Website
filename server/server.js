/**
 * NewsSphere - Express Backend
 * Serves static frontend and proxies NewsAPI requests (API key hidden).
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const newsRoutes = require('./routes/news');



const app = express();
const PORT = process.env.PORT || 5000;

// Security & CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.use(express.json());
app.use('/api', newsRoutes);

const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// 404 catch-all
app.use((req, res) => {
  res.status(404).sendFile(path.join(publicPath, '404.html'));
});

app.listen(PORT, () => {
  console.log(`NewsSphere server running at http://localhost:${PORT}`);
  if (!process.env.NEWS_API_KEY) {
    console.warn('Warning: NEWS_API_KEY not set. Get a key at https://newsapi.org');
  }
});
