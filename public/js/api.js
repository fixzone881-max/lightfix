const api = {
  async request(method, path, body) {
    const res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  patch(path, body) { return this.request('PATCH', path, body); },
  del(path) { return this.request('DELETE', path); },
};

async function requireLogin() {
  try {
    return await api.get('/dashboard/me');
  } catch {
    window.location.href = '/login.html';
    return null;
  }
}

function fmtMoney(cents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents || 0) / 100);
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- Theme toggle (light/dark), shared across every page that loads this file ---
(function initTheme() {
  const stored = localStorage.getItem('signal-theme');
  const theme = stored || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  function addToggleButton() {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.type = 'button';
    btn.title = 'Toggle light / dark theme';
    btn.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? '🌙' : '☀️';
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', current);
      localStorage.setItem('signal-theme', current);
      btn.textContent = current === 'light' ? '🌙' : '☀️';
    });
    document.body.appendChild(btn);
  }

  if (document.body) addToggleButton();
  else document.addEventListener('DOMContentLoaded', addToggleButton);
})();
