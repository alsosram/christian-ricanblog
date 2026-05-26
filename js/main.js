/* ===== STATE ===== */
let allPosts = [];

/* ===== DOM REFS ===== */
const postsGrid = document.getElementById('postsGrid');
const modalOverlay = document.getElementById('modalOverlay');
const navToggle = document.getElementById('navToggle');
const navList = document.querySelector('.nav-list');
const navLinks = document.querySelectorAll('.nav-link');

/* ===== FORMAT DATE ===== */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

/* ===== RENDER POST CARDS ===== */
function renderPosts(posts) {
  postsGrid.innerHTML = posts.map(post => `
    <article class="post-card" data-id="${post.id}">
      <img src="${post.image}" alt="${post.title}" class="post-card-image" loading="lazy">
      <div class="post-card-body">
        <span class="post-card-category">${post.category}</span>
        <div class="post-card-date">${formatDate(post.date)}</div>
        <h3 class="post-card-title">${post.title}</h3>
        <p class="post-card-excerpt">${post.excerpt}</p>
      </div>
    </article>
  `).join('');

  document.querySelectorAll('.post-card').forEach(card => {
    card.addEventListener('click', () => openPost(card.dataset.id));
  });
}

/* ===== OPEN POST MODAL ===== */
async function openPost(id) {
  try {
    const res = await fetch(`posts/${id}.json`);
    if (!res.ok) return;
    const post = await res.json();
    showModal(post);
  } catch {}
}

function showModal(post) {
  modalOverlay.innerHTML = `
    <div class="modal">
      <img src="${post.image}" alt="${post.title}" class="modal-image" loading="lazy">
      <div class="modal-body">
        <span class="post-card-category">${post.category}</span>
        <div class="modal-date">${formatDate(post.date)} &middot; by ${post.author}</div>
        <h2 class="modal-title">${post.title}</h2>
        <div class="modal-content">${post.content}</div>
        <button class="modal-close">Close</button>
      </div>
    </div>
  `;
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  modalOverlay.querySelector('.modal-close').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', handleEsc);
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', handleEsc);
}

function handleEsc(e) {
  if (e.key === 'Escape') closeModal();
}

/* ===== LOAD POSTS ===== */
async function loadPosts() {
  try {
    const res = await fetch('posts/posts.json');
    allPosts = await res.json();
    renderPosts(allPosts);
  } catch {}
}

/* ===== MOBILE NAV ===== */
navToggle.addEventListener('click', () => {
  const open = navList.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', open);
});

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    navList.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

/* ===== ACTIVE NAV LINK ===== */
function updateActiveNav() {
  const scrollY = window.scrollY + 120;
  let current = 'home';

  document.querySelectorAll('section[id]').forEach(section => {
    const top = section.offsetTop - 100;
    const bottom = top + section.offsetHeight;
    if (scrollY >= top && scrollY < bottom) {
      current = section.id;
    }
  });

  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
}

window.addEventListener('scroll', updateActiveNav);

/* ===== CONTACT FORM ===== */
document.getElementById('contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('.btn');
  const orig = btn.textContent;
  btn.textContent = 'Message Sent!';
  btn.style.background = '#4CAF50';
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.background = '';
    e.target.reset();
  }, 2500);
});

/* ===== INIT ===== */
loadPosts();
