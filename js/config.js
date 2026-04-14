// ============================================================
//  InsightGrid — Firebase + Cloudinary Configuration
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyB4jobCYJBlGeif138c9AJyuJYtpqy9JWQ",
  authDomain:        "insightgrid-697cc.firebaseapp.com",
  projectId:         "insightgrid-697cc",
  storageBucket:     "insightgrid-697cc.appspot.com",
  messagingSenderId: "547445746637",
  appId:             "1:547445746637:web:89acbecd4b72fb733bb284",
  measurementId:     "G-SN5PXJ8XK4"
};

// ── Initialize Firebase ──────────────────────────────────────
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ── Global Firebase Services ─────────────────────────────────
window.auth = firebase.auth();
window.db = firebase.firestore();
window.storage = firebase.storage();

const auth    = window.auth;
const db      = window.db;
const storage = window.storage;

// ── Firestore Settings ───────────────────────────────────────
window.db.settings({
  ignoreUndefinedProperties: true
});

// ── Admin Configuration ──────────────────────────────────────
window.ADMIN_UID = "4zxg2gIs75UpghRuB1Ttil04BSj2";

// ── Safe Helper (Optional but Recommended) ───────────────────
window.isAdmin = function () {
  return window.auth.currentUser &&
         window.auth.currentUser.uid === window.ADMIN_UID;
};

// ── Cloudinary Config (used for all image uploads) ───────────
const CLOUDINARY_CLOUD_NAME   = "dmqatg7jk";
const CLOUDINARY_UPLOAD_PRESET = "blog_upload";
const CLOUDINARY_UPLOAD_URL   =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// ── Categories (used across the whole app) ───────────────────
const CATEGORIES = [
  { value: "Technology",    label: "প্রযুক্তি"  },
  { value: "Education",     label: "শিক্ষা"     },
  { value: "Business",      label: "ব্যবসা"     },
  { value: "Health",        label: "স্বাস্থ্য"  },
  { value: "Science",       label: "বিজ্ঞান"    },
  { value: "Sports",        label: "খেলাধুলা"   },
  { value: "Entertainment", label: "বিনোদন"     },
  { value: "Travel",        label: "ভ্রমণ"      },
  { value: "Food",          label: "খাবার"      },
  { value: "Lifestyle",     label: "জীবনধারা"   },
  { value: "General",       label: "সাধারণ"     }
];

// ── Cloudinary upload helper (used by articles.js) ───────────
async function uploadToCloudinary(file) {
  if (!file) {
    console.error('Cloudinary upload failed: missing file');
    throw new Error('কোনও ফাইল নির্বাচন করা হয়নি');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  try {
    console.log('Cloudinary upload start:', { name: file.name, size: file.size, type: file.type });
    const res  = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
    const data = await res.json();

    console.log('Cloudinary upload response:', data);

    if (!res.ok || data.error) {
      const message = data.error?.message || 'Cloudinary upload ব্যর্থ হয়েছে';
      console.error('Cloudinary upload failed:', message, data);
      throw new Error(message);
    }

    const url = data.secure_url || data.url;
    if (!url) {
      console.error('Cloudinary upload missing secure_url:', data);
      throw new Error('Cloudinary upload থেকে কোন URL ফিরেছে না');
    }

    return url;
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    throw err;
  }
}
window.uploadToCloudinary = uploadToCloudinary;
