/* ===== CONFIG ===== */
const ADMIN_PASSWORD_HASH = 'REDACTED';

/* ===== STATE ===== */
let token = '';
let owner = '';
let repo = '';
let allPosts = [];
let editingId = null;

/* ===== DOM REFS — VIEWS ===== */
const viewLogin = document.getElementById('viewLogin');
const viewDashboard = document.getElementById('viewDashboard');
const viewEditor = document.getElementById('viewEditor');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

/* ===== DOM REFS — DASHBOARD ===== */
const postsBody = document.getElementById('postsBody');
const postsTable = document.getElementById('postsTable');
const emptyState = document.getElementById('emptyState');
const dashLoading = document.getElementById('dashLoading');
const newPostBtn = document.getElementById('newPostBtn');
const logoutBtn = document.getElementById('logoutBtn');

/* ===== DOM REFS — EDITOR ===== */
const editorBackBtn = document.getElementById('editorBackBtn');
const editorForm = document.getElementById('editorForm');
const editorTitle = document.getElementById('editorTitle');
const edSaveBtn = document.getElementById('edSaveBtn');
const edMsg = document.getElementById('edMsg');
const edTitle = document.getElementById('edTitle');
const edSlug = document.getElementById('edSlug');
const edCategory = document.getElementById('edCategory');
const edAuthor = document.getElementById('edAuthor');
const edDate = document.getElementById('edDate');
const edImage = document.getElementById('edImage');
const edExcerpt = document.getElementById('edExcerpt');
const edContent = document.getElementById('edContent');

/* ===== DOM REFS — SETTINGS ===== */
const settingsForm = document.getElementById('settingsForm');
const settingsMsg = document.getElementById('settingsMsg');
const settingsSaveBtn = document.getElementById('settingsSaveBtn');

/* ===== SHA-256 ===== */
async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ===== GITHUB API HELPERS ===== */
async function ghFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/${path}`, opts);
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `API error: ${res.status}`);
  }
  return res.json();
}

async function getFileSha(path) {
  const data = await ghFetch(`contents/${path}`);
  return data ? data.sha : null;
}

async function readFileContent(path) {
  const data = await ghFetch(`contents/${path}`);
  if (!data) return null;
  return { content: atob(data.content.replace(/\n/g, '')), sha: data.sha };
}

async function writeFile(path, content, sha = null) {
  const body = { message: `Update ${path}`, content: btoa(unescape(encodeURIComponent(content))) };
  if (sha) body.sha = sha;
  return ghFetch(`contents/${path}`, 'PUT', body);
}

async function deleteFile(path, sha) {
  return ghFetch(`contents/${path}`, 'DELETE', { message: `Delete ${path}`, sha });
}

/* ===== LOGIN ===== */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const pw = document.getElementById('loginPassword').value;
  const pwHash = await sha256(pw);
  if (pwHash !== ADMIN_PASSWORD_HASH) {
    loginError.textContent = 'Incorrect password.';
    return;
  }
  token = document.getElementById('loginToken').value.trim();
  owner = document.getElementById('loginOwner').value.trim();
  repo = document.getElementById('loginRepo').value.trim();
  if (!token || !owner || !repo) {
    loginError.textContent = 'Please fill in all fields.';
    return;
  }
  localStorage.setItem('adminToken', token);
  localStorage.setItem('adminOwner', owner);
  localStorage.setItem('adminRepo', repo);
  showDashboard();
});

/* ===== VIEWS ===== */
function showView(view) {
  [viewLogin, viewDashboard, viewEditor].forEach(v => v.style.display = 'none');
  view.style.display = '';
}

function showDashboard() {
  showView(viewDashboard);
  switchTab(document.querySelector('.tab.active'));
}

function showEditor(post = null) {
  showView(viewEditor);
  editingId = post ? post.id : null;
  editorTitle.textContent = post ? 'Edit Post' : 'New Post';
  edSaveBtn.textContent = post ? 'Update Post' : 'Publish Post';
  edMsg.textContent = '';
  edMsg.className = 'form-msg';

  if (post) {
    edTitle.value = post.title;
    edSlug.value = post.id;
    edCategory.value = post.category;
    edAuthor.value = post.author;
    edDate.value = post.date;
    edImage.value = post.image || '';
    edExcerpt.value = post.excerpt;
    edContent.value = post.content;
  } else {
    editorForm.reset();
    edSlug.value = '';
    edDate.value = new Date().toISOString().slice(0, 10);
    edAuthor.value = 'Ministry Team';
  }
}

/* ===== TABS ===== */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab));
});

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  const tabId = tab.dataset.tab;
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  const content = document.getElementById(`tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  if (content) content.style.display = '';

  if (tabId === 'posts') loadDashboardPosts();
  if (tabId === 'settings') loadSettings();
}

/* ===== GENERATE SLUG ===== */
edTitle.addEventListener('input', () => {
  if (editingId) return;
  edSlug.value = edTitle.value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
});

/* ===== DASHBOARD: LOAD POSTS ===== */
async function loadDashboardPosts() {
  dashLoading.style.display = '';
  postsTable.style.display = 'none';
  emptyState.style.display = 'none';
  try {
    const data = await readFileContent('posts/posts.json');
    allPosts = data ? JSON.parse(data.content) : [];
  } catch {
    allPosts = [];
  }
  renderDashboardPosts();
}

function renderDashboardPosts() {
  dashLoading.style.display = 'none';
  if (!allPosts.length) {
    emptyState.style.display = '';
    postsTable.style.display = 'none';
    return;
  }
  postsTable.style.display = '';
  emptyState.style.display = 'none';
  postsBody.innerHTML = allPosts.map(p => `
    <tr>
      <td class="post-title">${escHtml(p.title)}</td>
      <td><span class="post-category">${escHtml(p.category)}</span></td>
      <td>${p.date}</td>
      <td class="actions">
        <button class="btn btn-secondary btn-sm" onclick="editPost('${escHtml(p.id)}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deletePost('${escHtml(p.id)}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ===== DASHBOARD: ACTIONS ===== */
newPostBtn.addEventListener('click', () => showEditor(null));
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminOwner');
  localStorage.removeItem('adminRepo');
  showView(viewLogin);
});
editorBackBtn.addEventListener('click', () => { showDashboard(); switchTab(document.querySelector('[data-tab="posts"]')); });
document.getElementById('edCancelBtn').addEventListener('click', () => { showDashboard(); switchTab(document.querySelector('[data-tab="posts"]')); });

function editPost(id) {
  const post = allPosts.find(p => p.id === id);
  if (post) showEditor(post);
}

async function deletePost(id) {
  if (!confirm(`Delete "${id}"? This cannot be undone.`)) return;
  try {
    const sha = await getFileSha(`posts/${id}.json`);
    if (sha) await deleteFile(`posts/${id}.json`, sha);
    const updated = allPosts.filter(p => p.id !== id);
    const content = JSON.stringify(updated, null, 2);
    const data = await readFileContent('posts/posts.json');
    await writeFile('posts/posts.json', content, data ? data.sha : null);
    allPosts = updated;
    renderDashboardPosts();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}

/* ===== SAVE POST ===== */
editorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  edMsg.textContent = 'Saving...';
  edMsg.className = 'form-msg';
  edSaveBtn.disabled = true;

  const title = edTitle.value.trim();
  const slug = edSlug.value.trim();
  const category = edCategory.value.trim();
  const author = edAuthor.value.trim();
  const date = edDate.value;
  const image = edImage.value.trim() || 'https://images.unsplash.com/photo-1504052434564-5ac4fc2b6cb0?w=800&q=80';
  const excerpt = edExcerpt.value.trim();
  const content = edContent.value.trim();

  if (!slug.match(/^[a-z0-9-]+$/)) {
    edMsg.textContent = 'Slug must contain only lowercase letters, numbers, and hyphens.';
    edMsg.className = 'form-msg error';
    edSaveBtn.disabled = false;
    return;
  }

  const post = { id: slug, title, date, author, excerpt, content, category, image };

  try {
    const postsData = await readFileContent('posts/posts.json');
    let posts = postsData ? JSON.parse(postsData.content) : [];
    const idx = posts.findIndex(p => p.id === slug);
    if (editingId && editingId !== slug) {
      const oldSha = await getFileSha(`posts/${editingId}.json`);
      if (oldSha) await deleteFile(`posts/${editingId}.json`, oldSha);
    }

    const postContent = JSON.stringify(post, null, 2);
    const postSha = editingId && editingId === slug ? await getFileSha(`posts/${slug}.json`) : null;
    await writeFile(`posts/${slug}.json`, postContent, postSha);

    const meta = { id: slug, title, date, author, excerpt, category, image };
    if (idx >= 0) { posts[idx] = meta; } else { posts.push(meta); }
    await writeFile('posts/posts.json', JSON.stringify(posts, null, 2), postsData ? postsData.sha : null);

    edMsg.textContent = 'Post published! Redirecting...';
    edMsg.className = 'form-msg success';
    setTimeout(() => { showDashboard(); switchTab(document.querySelector('[data-tab="posts"]')); }, 800);
  } catch (err) {
    edMsg.textContent = 'Error: ' + err.message;
    edMsg.className = 'form-msg error';
    edSaveBtn.disabled = false;
  }
});

/* ===== SETTINGS EDITOR ===== */
const SETTINGS_PATH = 'site-config.json';

/* Map setting field IDs to config paths */
const SETTINGS_FIELDS = [
  'siteName', 'metaDescription',
  'hero-title', 'hero-subtitle', 'hero-bgImage',
  'about-title', 'about-paragraph1', 'about-paragraph2', 'about-verse', 'about-image',
  'subscribe-title', 'subscribe-subtitle', 'subscribe-successMsg',
  'footer-tagline'
];

async function loadSettings() {
  settingsMsg.textContent = 'Loading...';
  settingsMsg.className = 'form-msg';
  try {
    const data = await readFileContent(SETTINGS_PATH);
    if (!data) throw new Error('site-config.json not found');
    const cfg = JSON.parse(data.content);
    SETTINGS_FIELDS.forEach(key => {
      const el = document.getElementById(`cfg-${key}`);
      if (el) {
        const val = key.split('-').reduce((o, p) => (o ? o[p] : undefined), cfg);
        el.value = val || '';
      }
    });
    settingsMsg.textContent = '';
    settingsMsg.className = 'form-msg';
  } catch (err) {
    settingsMsg.textContent = 'Error loading settings: ' + err.message;
    settingsMsg.className = 'form-msg error';
  }
}

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  settingsMsg.textContent = 'Saving...';
  settingsMsg.className = 'form-msg';
  settingsSaveBtn.disabled = true;

  const cfg = {};

  SETTINGS_FIELDS.forEach(key => {
    const el = document.getElementById(`cfg-${key}`);
    if (!el) return;
    const parts = key.split('-');
    let current = cfg;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = el.value;
  });

  cfg.siteName = cfg.siteName || 'Faith & Fellowship';

  try {
    const data = await readFileContent(SETTINGS_PATH);
    const content = JSON.stringify(cfg, null, 2);
    await writeFile(SETTINGS_PATH, content, data ? data.sha : null);
    settingsMsg.textContent = 'Settings saved! The site will update on next deploy.';
    settingsMsg.className = 'form-msg success';
  } catch (err) {
    settingsMsg.textContent = 'Error: ' + err.message;
    settingsMsg.className = 'form-msg error';
  }
  settingsSaveBtn.disabled = false;
});

/* ===== RESTORE SESSION ===== */
(function init() {
  const savedToken = localStorage.getItem('adminToken');
  const savedOwner = localStorage.getItem('adminOwner');
  const savedRepo = localStorage.getItem('adminRepo');
  if (savedToken && savedOwner && savedRepo) {
    token = savedToken;
    owner = savedOwner;
    repo = savedRepo;
    document.getElementById('loginToken').value = savedToken;
    document.getElementById('loginOwner').value = savedOwner;
    document.getElementById('loginRepo').value = savedRepo;
    showDashboard();
  }
})();
