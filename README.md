
# NewsSphere — Global News Aggregator

A responsive, full-stack news website that aggregates articles from multiple global sources. One-stop destination for diverse, real-time news with categories, search, trending panel, and saved articles.

## Features

- **Homepage**: Top headlines from US, UK, India, Canada, Australia with article cards (image, title, description, source, date, Read more).
- **Categories**: Tabs for Headlines, Business, Technology, Sports, Entertainment, Health, Science — fetch without reload.
- **Search**: Search bar in navbar; keyword search with "No results found" state.
- **Trending**: Side panel with trending/recent articles sorted by latest published date.
- **Save articles**: Bookmark articles; stored in `localStorage`; dedicated **Saved News** page.
- **Dark mode**: Toggle with preference saved in `localStorage`.
- **Loading & errors**: Spinner while fetching; user-friendly error message and retry.
- **Filters**: Country dropdown, date sort (latest/oldest).
- **Infinite scroll**: Load more on button click or automatically when scrolling near bottom.
- **SEO**: Meta tags and semantic HTML.
- **Security**: API key kept on backend; use environment variables.

## Tech Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js + Express
- **API**: [NewsAPI](https://newsapi.org/) (free tier)

## Project Structure

```
NewsWebsite/
├── public/
│   ├── index.html      # Homepage
│   ├── saved.html      # Saved articles page
│   ├── styles.css      # Global styles (light/dark, responsive)
│   ├── script.js       # Main app logic
│   └── saved.js        # Saved page logic
├── server/
│   ├── server.js       # Express app, static + API
│   └── routes/
│       └── news.js     # NewsAPI proxy routes
├── .env.example        # Template for env vars
├── .gitignore
├── package.json
└── README.md
```

## Run Locally

### 1. Get a NewsAPI key

- Go to [https://newsapi.org/register](https://newsapi.org/register) and sign up (free).
- Copy your API key.

### 2. Clone / open project and install

```bash
cd NewsWebsite
npm install
```

### 3. Environment variables

```bash
cp .env.example .env
```

Edit `.env` and set:

```
NEWS_API_KEY=your_actual_api_key_here
PORT=3000
```

### 4. Start the server

```bash
npm start
```

- Backend + static frontend: **http://localhost:3000**
- Homepage: **http://localhost:3000/**
- Saved page: **http://localhost:3000/saved.html**

The app will use relative `/api` requests, so everything works from one origin.

---

## Deploy: Netlify (frontend) + Render (backend)

Frontend and backend are split so you can host the UI on Netlify and the API on Render, with the API key only on the server.

### Backend on Render

1. **Create a Web Service** on [Render](https://render.com).
2. Connect your repo (or push this project to GitHub and connect it).
3. **Build & start**:
   - Build command: `npm install`
   - Start command: `npm start`
4. **Environment**:
   - Add variable: `NEWS_API_KEY` = your NewsAPI key.
   - `NODE_ENV` = `production` (optional).
5. Deploy. Note the service URL, e.g. `https://newssphere-api.onrender.com`.

### Frontend on Netlify

1. **New site** from Git (same repo).
2. **Build settings**:
   - Base directory: leave default (root).
   - Build command: leave empty (static site).
   - Publish directory: `public`.
3. **Environment variables** (so the frontend knows the API URL):
   - Key: `NEWSPHERE_API_URL`
   - Value: your Render URL, e.g. `https://newssphere-api.onrender.com` (no trailing slash).
4. **Inject API URL into the frontend**  
   Netlify doesn’t run Node, so the frontend must get the API base URL at runtime. Two options:

   **Option A — Build-time inject (recommended)**  
   Add a pre-build step that creates a small config file read by the browser:

   - In the repo root, add a file that Netlify will use to generate `public/config.js` during build, or add a **Netlify build script** that writes the API URL into `public/config.js`, e.g.:
     ```js
     // public/config.js (generated at build time)
     window.NEWSPHERE_API_URL = 'https://newssphere-api.onrender.com';
     ```
   - In `public/index.html` and `public/saved.html`, add before your main script:
     ```html
     <script src="config.js"></script>
     ```
   - In Netlify, set env var `NEWSPHERE_API_URL` and in the Build command run something like:
     ```bash
     echo "window.NEWSPHERE_API_URL = \"$NEWSPHERE_API_URL\";" > public/config.js
     ```
     (Use Netlify’s env substitution; exact syntax may vary.)

   **Option B — No build**  
   Hardcode the API URL in `public/script.js` (only for production): set `API_BASE` to your Render URL. Less flexible.

5. Deploy. Your Netlify URL (e.g. `https://newssphere.netlify.app`) will load the frontend; it will call the Render URL for all `/api/*` requests.

### CORS

The backend already sends `Access-Control-Allow-Origin: *` for GET requests, so the Netlify origin can call the Render API. For production you can restrict this to your Netlify domain.

### Summary

| Part        | Host   | URL / directory      |
|------------|--------|----------------------|
| Frontend   | Netlify | Publish: `public`    |
| Backend API| Render  | e.g. `https://newssphere-api.onrender.com` |
| API key    | Render only (env var `NEWS_API_KEY`)       |
| Frontend config | Netlify: set `NEWSPHERE_API_URL` and generate `public/config.js` in build so `script.js` can use it. |

## License

MIT.

