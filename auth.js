// Shared auth helpers for the PandaRoc account pages.
// Keeps the user logged in: stores both the short-lived access token and the
// long-lived refresh token, and silently renews the access token on a 401.
const PANDAROC_API = 'https://api.pandaroc.com';

function saveTokens(data) {
  if (!data) return;
  if (data.access_token) localStorage.setItem('pandaroc_token', data.access_token);
  if (data.refresh_token) localStorage.setItem('pandaroc_refresh', data.refresh_token);
  if (data.license_key) localStorage.setItem('pandaroc_license_key', data.license_key);
}

function clearTokens() {
  localStorage.removeItem('pandaroc_token');
  localStorage.removeItem('pandaroc_refresh');
  localStorage.removeItem('pandaroc_license_key');
}

function getAccessToken() {
  return localStorage.getItem('pandaroc_token');
}

// Exchange the stored refresh token for a fresh access token. Returns the new
// access token, or null if there's no valid refresh token (session truly ended).
async function refreshAccessToken() {
  const rt = localStorage.getItem('pandaroc_refresh');
  if (!rt) return null;
  try {
    const res = await fetch(PANDAROC_API + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) {
      if (res.status === 401) clearTokens();
      return null;
    }
    const data = await res.json();
    saveTokens(data);
    return data.access_token;
  } catch (e) {
    return null;
  }
}

// fetch() wrapper for authenticated API calls. Attaches the access token and,
// on a 401, transparently refreshes it once and retries before giving up.
async function authFetch(path, opts) {
  opts = opts || {};
  const headers = Object.assign({}, opts.headers || {});
  const token = getAccessToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  let res = await fetch(PANDAROC_API + path, Object.assign({}, opts, { headers }));
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = 'Bearer ' + newToken;
      res = await fetch(PANDAROC_API + path, Object.assign({}, opts, { headers }));
    }
  }
  return res;
}
