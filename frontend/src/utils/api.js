import axios from 'axios';

// 30 s baseline timeout — Render's free tier cold-starts can take 30–60 s
// from idle. Individual long uploads (e.g. /streams/go-live, /clips) override
// this with their own `timeout: 60000` per call.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('lyvstreem_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Track retry count for the response interceptor below
  if (typeof config._retryCount !== 'number') config._retryCount = 0;
  return config;
});

api.interceptors.response.use(
  res => res,
  async err => {
    // Auth — clear token and redirect to login
    if (err.response?.status === 401) {
      localStorage.removeItem('lyvstreem_token');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }

    // Auto-retry on TRANSPORT errors (no response received: server cold-start,
    // dropped connection, timeout). 4xx/5xx responses come back through `res`
    // intact and are NOT retried — those represent real server decisions.
    const config = err.config;
    const noResponse = !err.response;
    const transportError = noResponse && (
      err.code === 'ECONNABORTED' ||           // axios timeout
      err.code === 'ERR_NETWORK' ||
      err.message?.includes('timeout') ||
      err.message?.includes('Network Error')
    );
    if (config && transportError && !config._noRetry) {
      const attempt = (config._retryCount || 0) + 1;
      if (attempt <= 2) {
        config._retryCount = attempt;
        // Linear backoff: 1.5 s, 3 s
        await new Promise(r => setTimeout(r, 1500 * attempt));
        return api.request(config);
      }
    }

    return Promise.reject(err);
  }
);

// Wake the backend up. Render free-tier services sleep after ~15 min of
// inactivity and the first request takes 30–60 s to come back. Calling this
// on app boot means by the time the user clicks anything, the server is
// already responding. Failures are swallowed — this is purely best-effort.
export const warmupServer = () => api
  .get('/health', { timeout: 60000, _noRetry: true })
  .catch(() => {});

export default api;
