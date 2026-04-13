// ============================================================
//  BlogNest — Authentication & User Management
//  Handles: register, login, logout, profile CRUD, navbar UI
// ============================================================

let currentUser        = null;
let currentUserProfile = null;

// ── Register ─────────────────────────────────────────────────
async function registerUser(email, password, displayName) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName });

  const profile = {
    uid:          cred.user.uid,
    displayName,
    email,
    photoURL:     '',
    bio:          '',
    role:         'author',
    articleCount: 0,
    totalViews:   0,
    bookmarks:    [],
    createdAt:    firebase.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('users').doc(cred.user.uid).set(profile);
  return cred.user;
}

// ── Login ────────────────────────────────────────────────────
async function loginUser(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  return cred.user;
}

// ── Logout ───────────────────────────────────────────────────
async function logoutUser() {
  await auth.signOut();
  currentUser        = null;
  currentUserProfile = null;
}

// ── Get Profile ──────────────────────────────────────────────
async function getUserProfile(uid) {
  const doc = await db.collection('users').doc(uid).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// ── Update Profile ───────────────────────────────────────────
async function updateUserProfile(uid, data) {
  const payload = {
    ...data,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('users').doc(uid).update(payload);

  if (data.displayName || data.photoURL) {
    const updates = {};
    if (data.displayName) updates.displayName = data.displayName;
    if (data.photoURL)    updates.photoURL    = data.photoURL;
    await auth.currentUser.updateProfile(updates);
  }
}

// ── Upload Profile Photo ─────────────────────────────────────
async function uploadProfilePhoto(file) {
  const user = auth.currentUser;
  if (!user) throw new Error('লগইন প্রয়োজন');
  const ref = storage.ref(`avatars/${user.uid}`);
  await ref.put(file);
  const url = await ref.getDownloadURL();
  await updateUserProfile(user.uid, { photoURL: url });
  return url;
}

// ── Init Auth (call on every page) ───────────────────────────
function initAuth(onUser = null, onNoUser = null) {
  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
      currentUserProfile = await getUserProfile(user.uid);
      updateNavbarUI(user, currentUserProfile);
      if (onUser) onUser(user, currentUserProfile);
    } else {
      currentUserProfile = null;
      updateNavbarUI(null, null);
      if (onNoUser) onNoUser();
    }
  });
}

// ── Require Auth (redirect if not logged in) ─────────────────
function requireAuth() {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href =
        `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    }
  });
}

// ── Update Navbar UI ─────────────────────────────────────────
function updateNavbarUI(user, profile) {
  const loginBtn  = document.getElementById('nav-login-btn');
  const writeBtn  = document.getElementById('nav-write-btn');
  const userMenu  = document.getElementById('nav-user-menu');
  const avatarImg = document.getElementById('nav-avatar');
  const initials  = document.getElementById('nav-initials');

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (writeBtn) writeBtn.style.display = 'inline-flex';
    if (userMenu) userMenu.style.display = 'block';

    if (profile?.photoURL && avatarImg) {
      avatarImg.src           = profile.photoURL;
      avatarImg.style.display = 'block';
      if (initials) initials.style.display = 'none';
    } else if (initials) {
      initials.style.display  = 'block';
      initials.textContent    = getInitials(user.displayName || user.email);
      if (avatarImg) avatarImg.style.display = 'none';
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (writeBtn) writeBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'none';
  }
}

// ── Toggle Dropdown ──────────────────────────────────────────
function toggleDropdown(id) {
  const menu = document.getElementById(id);
  if (menu) menu.classList.toggle('show');
}

// ── Logout Handler (used in navbar button) ───────────────────
async function handleLogout() {
  try {
    await logoutUser();
    showToast('লগআউট সফল হয়েছে ✓');
    setTimeout(() => window.location.href = 'index.html', 800);
  } catch (e) {
    showToast('লগআউট ব্যর্থ হয়েছে', 'error');
  }
}

// ── Close dropdowns on outside click ────────────────────────
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-menu.show')
      .forEach(m => m.classList.remove('show'));
  }
});

// ── Firebase error → Bengali message ────────────────────────
function firebaseErrorMessage(code) {
  const map = {
    'auth/user-not-found':       'এই ইমেইলে কোনো অ্যাকাউন্ট নেই',
    'auth/wrong-password':       'পাসওয়ার্ড ভুল হয়েছে',
    'auth/invalid-email':        'সঠিক ইমেইল দিন',
    'auth/email-already-in-use': 'এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে',
    'auth/weak-password':        'পাসওয়ার্ড আরও শক্তিশালী করুন (কমপক্ষে ৬ অক্ষর)',
    'auth/too-many-requests':    'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পরে আবার চেষ্টা করুন',
    'auth/invalid-credential':   'ইমেইল বা পাসওয়ার্ড ভুল',
    'auth/network-request-failed': 'ইন্টারনেট সংযোগ পরীক্ষা করুন'
  };
  return map[code] || 'কিছু একটা ভুল হয়েছে, আবার চেষ্টা করুন';
}
