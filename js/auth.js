// ============================================================
//  InsightGrid — Authentication & User Management
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
    role:         'user',
    articleCount: 0,
    totalViews:   0,
    bookmarks:    [],
    createdAt:    firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('users').doc(cred.user.uid).set(profile);
  } catch (firestoreErr) {
    // Auth user তৈরি হয়েছে কিন্তু profile save হয়নি
    // তাই sign out করে clean state এ ফিরে যাও
    await auth.signOut();
    throw new Error('প্রোফাইল তৈরি ব্যর্থ হয়েছে। Firestore rules চেক করুন।');
  }

  return cred.user;
}

// ── Login ────────────────────────────────────────────────────
async function loginUser(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  return cred.user;
}


// ── Google Sign-In ───────────────────────────────────────────
async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const cred     = await auth.signInWithPopup(provider);
  const user     = cred.user;

  // Create Firestore profile only on first Google login
  const existing = await db.collection('users').doc(user.uid).get();
  if (!existing.exists) {
    await db.collection('users').doc(user.uid).set({
      uid:          user.uid,
      displayName:  user.displayName || '',
      email:        user.email,
      photoURL:     user.photoURL || '',
      bio:          '',
      role:         'user',
      articleCount: 0,
      totalViews:   0,
      bookmarks:    [],
      createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  return user;
}
// ── Logout ───────────────────────────────────────────────────
async function logoutUser() {
  await auth.signOut();
  currentUser        = null;
  currentUserProfile = null;
}

// ── Get Profile ──────────────────────────────────────────────
async function getUserProfile(uid) {
  try {
    const doc     = await db.collection('users').doc(uid).get();
    const profile = doc.exists ? { id: doc.id, ...doc.data() } : null;

    console.log('👤 User Profile Fetch:', { uid: uid.slice(-8), exists: doc.exists, role: profile?.role });

    // Auto-assign admin role if UID matches ADMIN_UID
    if (profile && uid === ADMIN_UID) {
      profile.role = 'admin';
      console.log('✓ Admin role assigned (UID match)', uid);

      // Also persist it to Firestore if not already set
      if (doc.data()?.role !== 'admin') {
        console.log('⏳ Persisting admin role to Firestore...');
        db.collection('users').doc(uid)
          .update({ role: 'admin' })
          .then(() => console.log('✓ Admin role persisted to Firestore'))
          .catch((err) => {
            console.error('❌ Failed to persist admin role:', err.message);
            console.error('   This might block article creation. Check Firestore rules.');
          });
      }
    }

    return profile;
  } catch (err) {
    console.error('❌ Failed to fetch user profile:', err.message);
    throw err;
  }
}

// ── Admin helpers ────────────────────────────────────────────
function isAdminUser(user, profile) {
  return Boolean(user && (profile?.role === 'admin' || user.uid === ADMIN_UID));
}

function setAdminVisibility(isAdmin = false) {
  document.querySelectorAll('.admin-only').forEach(el => {
    if (isAdmin) return;
    el.style.display = 'none';
    if (el.parentNode) el.parentNode.removeChild(el);
  });
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

// ── Init Auth (call on every page) ───────────────────────────
function initAuth(onUser = null, onNoUser = null) {
  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
      console.log('🔐 Auth State Changed - User:', user.uid.slice(-8));
      currentUserProfile = await getUserProfile(user.uid);
      const isAdmin = isAdminUser(user, currentUserProfile);
      console.log('📊 Auth Status:', { isAdmin, role: currentUserProfile?.role, uid: user.uid.slice(-8) });
      updateNavbarUI(user, currentUserProfile, isAdmin);
      setAdminVisibility(isAdmin);
      if (onUser) onUser(user, currentUserProfile);
    } else {
      console.log('🔓 Not logged in');
      currentUserProfile = null;
      updateNavbarUI(null, null, false);
      setAdminVisibility(false);
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

// ── Require Admin (redirect if not admin) ────────────────────
function requireAdmin() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.log('⛔ Redirecting: User not logged in');
      window.location.href =
        `login.html?redirect=${encodeURIComponent(window.location.href)}`;
      return;
    }

    const profile = await getUserProfile(user.uid);
    const isAdmin = isAdminUser(user, profile);
    
    console.log('🔐 Admin Check:', { isAdmin, role: profile?.role, uid: user.uid.slice(-8) });
    
    if (!isAdmin) {
      console.error('⛔ ADMIN ACCESS DENIED');
      console.error('   User UID:', user.uid.slice(-8), '(Expected:', ADMIN_UID.slice(-8) + ')');
      console.error('   Profile role:', profile?.role);
      window.location.href = 'index.html';
    }
  });
}

// ── Update Navbar UI ─────────────────────────────────────────
function updateNavbarUI(user, profile, isAdmin = false) {
  const loginBtn  = document.getElementById('nav-login-btn');
  const writeBtn  = document.getElementById('nav-write-btn');
  const userMenu  = document.getElementById('nav-user-menu');
  const avatarImg = document.getElementById('nav-avatar');
  const initials  = document.getElementById('nav-initials');

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (writeBtn) {
      writeBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    }
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

// ── Upload Profile Photo ─────────────────────────────────────
async function uploadProfilePhoto(file) {
  const user = auth.currentUser;
  if (!user) throw new Error('লগইন প্রয়োজন');
  if (!file) throw new Error('কোনও ফাইল নির্বাচন করা হয়নি');

  try {
    const ref = storage.ref(`profiles/${user.uid}`);
    const snapshot = await ref.put(file);
    const url = await snapshot.ref.getDownloadURL();

    await db.collection('users').doc(user.uid).update({
      photoURL: url
    });

    return url;
  } catch (err) {
    console.error('Profile photo upload error:', err);
    throw new Error('প্রোফাইল ছবি আপলোড ব্যর্থ হয়েছে');
  }
}

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
