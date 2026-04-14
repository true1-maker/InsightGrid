// ============================================================
//  InsightGrid — Utility Functions
//  Used across all pages. Load this before auth.js & articles.js
// ============================================================

// ── Slug Generator ───────────────────────────────────────────
function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0980-\u09FF\-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    + '-' + Date.now();
}

// ── Date Formatters ──────────────────────────────────────────
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('bn-BD', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatDateShort(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((new Date() - date) / 1000);
  if (diff < 60)     return 'এইমাত্র';
  if (diff < 3600)   return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} দিন আগে`;
  return formatDate(timestamp);
}

// ── Reading Time ─────────────────────────────────────────────
function estimateReadTime(content) {
  const words = (content || '').replace(/<[^>]*>/g, '').trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ── Text Helpers ─────────────────────────────────────────────
function truncateText(html, max = 160) {
  const plain = (html || '').replace(/<[^>]*>/g, '').trim();
  return plain.length > max ? plain.substring(0, max) + '…' : plain;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000)    return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

// ── URL / Navigation ─────────────────────────────────────────
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function navigateTo(page, params = {}) {
  const qs = new URLSearchParams(params).toString();
  window.location.href = qs ? `${page}?${qs}` : page;
}

// ── Toast Notification ───────────────────────────────────────
function showToast(message, type = 'success') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className   = `toast toast-${type} show`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Loading / Empty States ───────────────────────────────────
function showLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <span>লোড হচ্ছে...</span>
    </div>`;
}

function showEmpty(containerId, title = 'কিছু নেই', msg = '', icon = '📭') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <h3>${title}</h3>
      ${msg ? `<p>${msg}</p>` : ''}
    </div>`;
}

// ── Debounce ─────────────────────────────────────────────────
function debounce(fn, delay = 350) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── Build Category <select> options ──────────────────────────
function buildCategoryOptions(selectId, selectedValue = '') {
  const el = document.getElementById(selectId);
  if (!el || typeof CATEGORIES === 'undefined') return;
  el.innerHTML = `<option value="">বিষয় বেছে নিন</option>` +
    CATEGORIES.map(c =>
      `<option value="${c.value}" ${c.value === selectedValue ? 'selected' : ''}>${c.label}</option>`
    ).join('');
}

// ── Copy to Clipboard ────────────────────────────────────────
function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => showToast('কপি হয়েছে ✓'))
    .catch(() => showToast('কপি ব্যর্থ হয়েছে', 'error'));
 }
  
async function uploadImage(file) {
  if (!file) {
    console.error('uploadImage failed: missing file');
    return null;
  }

  try {
    const url = await uploadToCloudinary(file);
    if (!url) {
      console.error('uploadImage failed: Cloudinary returned no URL');
      return null;
    }
    return url;
  } catch (err) {
    console.error('uploadImage error:', err);
    return null;
  }
}
