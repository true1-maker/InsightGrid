// ============================================================
//  InsightGrid — Firebase + Cloudinary Configuration
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyB4jobCYJBlGeif138c9AJyuJYtpqy9JWQ",
  authDomain:        "insightgrid-697cc.firebaseapp.com",
  projectId:         "insightgrid-697cc",
  storageBucket:     "insightgrid-697cc.firebasestorage.app",
  messagingSenderId: "547445746637",
  appId:             "1:547445746637:web:89acbecd4b72fb733bb284",
  measurementId:     "G-SN5PXJ8XK4"
};

// ── Initialize Firebase ──────────────────────────────────────
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();
window.storage = firebase.storage();
window.ADMIN_UID = "4zxg2gIs75UpghRuB1Ttil04BSj2";

// ── Firestore Settings ───────────────────────────────────────
db.settings({ ignoreUndefinedProperties: true });

// ── Admin ───────────────────────────────────────────────────
const ADMIN_UID = "4zxg2gIs75UpghRuB1Ttil04BSj2";

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
  const formData = new FormData();
  formData.append('file',         file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res  = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
  const data = await res.json();

  if (!res.ok || data.error) throw new Error(data.error?.message || 'আপলোড ব্যর্থ হয়েছে');
  return data.secure_url;
}
