// ============================================================
//  InsightGrid — Articles, Comments & Engagement
//  Handles: create, read, update, delete articles
//           comments, likes, bookmarks, image upload, rendering
// ============================================================

const ARTICLES_PER_PAGE = 9;

// ════════════════════════════════════════════════════════════
//  ARTICLE — CREATE
// ════════════════════════════════════════════════════════════
async function createArticle(data) {
  const user = auth.currentUser;
  if (!user) throw new Error('লগইন প্রয়োজন');

  const article = {
    title:        data.title.trim(),
    slug:         slugify(data.title),
    content:      data.content,
    thumbnail:    data.thumbnail || '',
    authorId:     user.uid,
    authorName:   user.displayName || 'Anonymous',
    authorPhoto:  currentUserProfile?.photoURL || '',
    tags:         (data.tags || []).filter(Boolean),
    category:     data.category || 'General',
    status:       data.status || 'draft',
    views:        0,
    likes:        [],
    commentCount: 0,
    readTime:     estimateReadTime(data.content),
    createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
  };

  const ref = await db.collection('articles').add(article);

  // Increment author's article count
  db.collection('users').doc(user.uid)
    .update({ articleCount: firebase.firestore.FieldValue.increment(1) })
    .catch(() => {});

  return { id: ref.id, ...article };
}

// ════════════════════════════════════════════════════════════
//  ARTICLE — UPDATE
// ════════════════════════════════════════════════════════════
async function updateArticle(articleId, data) {
  const user = auth.currentUser;
  if (!user) throw new Error('লগইন প্রয়োজন');

  const payload = { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  if (data.content) payload.readTime = estimateReadTime(data.content);

  // Clean undefined values
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  await db.collection('articles').doc(articleId).update(payload);
}

// ════════════════════════════════════════════════════════════
//  ARTICLE — DELETE
// ════════════════════════════════════════════════════════════
async function deleteArticle(articleId) {
  const user = auth.currentUser;
  if (!user) throw new Error('লগইন প্রয়োজন');

  const snap    = await db.collection('articles').doc(articleId).get();
  if (!snap.exists) throw new Error('আর্টিকেল পাওয়া যায়নি');

  const article  = snap.data();
  const isAdmin  = currentUserProfile?.role === 'admin';

  if (article.authorId !== user.uid && !isAdmin)
    throw new Error('এই আর্টিকেল মুছতে আপনার অনুমতি নেই');

  await db.collection('articles').doc(articleId).delete();

  // Note: Cloudinary images are managed from the Cloudinary dashboard
  // Decrement author's article count
  db.collection('users').doc(article.authorId)
    .update({ articleCount: firebase.firestore.FieldValue.increment(-1) })
    .catch(() => {});
}

// ════════════════════════════════════════════════════════════
//  ARTICLE — READ (paginated feed)
// ════════════════════════════════════════════════════════════
async function getArticles({ category = 'all', lastDoc = null, limit = ARTICLES_PER_PAGE } = {}) {
  let query = db.collection('articles')
    .where('status', '==', 'published')
    .orderBy('createdAt', 'desc')
    .limit(limit);

  if (category && category !== 'all') {
    query = db.collection('articles')
      .where('status', '==', 'published')
      .where('category', '==', category)
      .orderBy('createdAt', 'desc')
      .limit(limit);
  }

  if (lastDoc) query = query.startAfter(lastDoc);

  const snap = await query.get();
  return {
    articles: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc:  snap.docs[snap.docs.length - 1] || null,
    hasMore:  snap.docs.length === limit
  };
}

// ── Get single article by slug ────────────────────────────
async function getArticleBySlug(slug) {
  const snap = await db.collection('articles')
    .where('slug', '==', slug).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

// ── Get single article by ID ──────────────────────────────
async function getArticleById(id) {
  const doc = await db.collection('articles').doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// ── Get all articles by a specific user ───────────────────
async function getUserArticles(userId) {
  const snap = await db.collection('articles')
    .where('authorId', '==', userId)
    .orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Search articles by title & content (case-insensitive) ──
async function searchArticles(query) {
  if (!query || query.length < 2) return [];
  
  const lowerQuery = query.toLowerCase();
  
  try {
    // Fetch all published articles (with reasonable limit)
    const snap = await db.collection('articles')
      .where('status', '==', 'published')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    // Client-side filtering for case-insensitive search
    const results = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(article => {
        const titleMatch = (article.title || '').toLowerCase().includes(lowerQuery);
        const contentMatch = (article.content || '').toLowerCase().includes(lowerQuery);
        const tagsMatch = (article.tags || []).some(tag => 
          (tag || '').toLowerCase().includes(lowerQuery)
        );
        return titleMatch || contentMatch || tagsMatch;
      })
      .slice(0, 20); // Return top 20 results
    
    return results;
  } catch (err) {
    console.error('Search error:', err.message);
    showToast(`সার্চ ব্যর্থ: ${err.message}`, 'error');
    return [];
  }
}

// ── Get user's bookmarked articles ────────────────────────
async function getBookmarkedArticles(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  const ids = userDoc.data()?.bookmarks || [];
  if (!ids.length) return [];

  // Firestore 'in' limit = 10, chunk if needed
  const chunks = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

  const results = await Promise.all(
    chunks.map(chunk =>
      db.collection('articles').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get()
    )
  );

  return results.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

// ════════════════════════════════════════════════════════════
//  ENGAGEMENT — Views, Likes, Bookmarks
// ════════════════════════════════════════════════════════════
function incrementViews(articleId) {
  db.collection('articles').doc(articleId)
    .update({ views: firebase.firestore.FieldValue.increment(1) })
    .catch(() => {});
}

async function toggleLike(articleId) {
  const user = auth.currentUser;
  if (!user) { showToast('লাইক করতে লগইন করুন', 'error'); return null; }

  const ref   = db.collection('articles').doc(articleId);
  const snap  = await ref.get();
  const likes = snap.data()?.likes || [];
  const liked = likes.includes(user.uid);

  await ref.update({
    likes: liked
      ? firebase.firestore.FieldValue.arrayRemove(user.uid)
      : firebase.firestore.FieldValue.arrayUnion(user.uid)
  });

  return !liked; // returns new state: true = liked, false = unliked
}

async function toggleBookmark(articleId) {
  const user = auth.currentUser;
  if (!user) { showToast('বুকমার্ক করতে লগইন করুন', 'error'); return null; }

  const ref       = db.collection('users').doc(user.uid);
  const snap      = await ref.get();
  const bookmarks = snap.data()?.bookmarks || [];
  const saved     = bookmarks.includes(articleId);

  await ref.update({
    bookmarks: saved
      ? firebase.firestore.FieldValue.arrayRemove(articleId)
      : firebase.firestore.FieldValue.arrayUnion(articleId)
  });

  return !saved; // true = saved, false = removed
}

// ════════════════════════════════════════════════════════════
//  IMAGE UPLOAD — via Cloudinary
// ════════════════════════════════════════════════════════════
async function uploadThumbnail(file) {
  if (!auth.currentUser) throw new Error('লগইন প্রয়োজন');
  return await uploadToCloudinary(file);
}

async function uploadInlineImage(file) {
  if (!auth.currentUser) throw new Error('লগইন প্রয়োজন');
  return await uploadToCloudinary(file);
}

// ════════════════════════════════════════════════════════════
//  COMMENTS
// ════════════════════════════════════════════════════════════
async function addComment(articleId, content) {
  const user = auth.currentUser;
  if (!user) throw new Error('মন্তব্য করতে লগইন করুন');

  const comment = {
    articleId,
    userId:    user.uid,
    userName:  user.displayName || 'Anonymous',
    userPhoto: currentUserProfile?.photoURL || '',
    content:   content.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const ref = await db.collection('comments').add(comment);

  db.collection('articles').doc(articleId)
    .update({ commentCount: firebase.firestore.FieldValue.increment(1) })
    .catch(() => {});

  return { id: ref.id, ...comment, createdAt: { toDate: () => new Date() } };
}

async function getComments(articleId) {
  const snap = await db.collection('comments')
    .where('articleId', '==', articleId)
    .orderBy('createdAt', 'asc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function deleteComment(commentId, articleId) {
  const user = auth.currentUser;
  if (!user) throw new Error('লগইন প্রয়োজন');
  await db.collection('comments').doc(commentId).delete();
  db.collection('articles').doc(articleId)
    .update({ commentCount: firebase.firestore.FieldValue.increment(-1) })
    .catch(() => {});
}

// ════════════════════════════════════════════════════════════
//  RENDER HELPERS
// ════════════════════════════════════════════════════════════

// Article card for home feed
function renderArticleCard(a) {
  const thumb = a.thumbnail
    ? `<img src="${a.thumbnail}" alt="${a.title}" class="card-thumb" loading="lazy">`
    : `<div class="card-thumb no-thumb"><i data-lucide="file-text"></i></div>`;

  const tags = (a.tags || []).slice(0, 2)
    .map(t => `<span class="tag">${t}</span>`).join('');

  return `
  <article class="article-card" onclick="navigateTo('article.html',{slug:'${a.slug}'})">
    <div class="card-body">
      <div class="card-meta">
        <div class="avatar-xs">
          ${a.authorPhoto
            ? `<img src="${a.authorPhoto}" alt="${a.authorName}">`
            : `<span>${getInitials(a.authorName)}</span>`}
        </div>
        <span class="meta-name">${a.authorName}</span>
        <span class="meta-dot">·</span>
        <span class="meta-time">${formatDateShort(a.createdAt)}</span>
      </div>
      <h2 class="card-title">${a.title}</h2>
      <p class="card-excerpt">${truncateText(a.content, 150)}</p>
      <div class="card-footer">
        <div class="card-tags">${tags}</div>
        <div class="card-stats">
          <span><i data-lucide="clock" style="width:0.9em;height:0.9em;display:inline;vertical-align:text-bottom"></i> ${a.readTime}মি</span>
          <span><i data-lucide="eye" style="width:0.9em;height:0.9em;display:inline;vertical-align:text-bottom"></i> ${formatNumber(a.views)}</span>
          <span><i data-lucide="heart" style="width:0.9em;height:0.9em;display:inline;vertical-align:text-bottom"></i> ${(a.likes || []).length}</span>
        </div>
      </div>
    </div>
    ${thumb}
  </article>`;
}

// Comment item
function renderComment(c, currentUid) {
  const canDel = currentUid === c.userId || currentUserProfile?.role === 'admin';
  return `
  <div class="comment-item" id="comment-${c.id}">
    <div class="avatar-xs">
      ${c.userPhoto
        ? `<img src="${c.userPhoto}" alt="${c.userName}">`
        : `<span>${getInitials(c.userName)}</span>`}
    </div>
    <div class="comment-body">
      <div class="comment-head">
        <span class="comment-author">${c.userName}</span>
        <span class="comment-time">${formatDateShort(c.createdAt)}</span>
        ${canDel ? `<button class="comment-del" onclick="removeComment('${c.id}')">✕</button>` : ''}
      </div>
      <p class="comment-text">${c.content}</p>
    </div>
  </div>`;
      }
      
