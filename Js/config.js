const firebaseConfig = {
    apiKey: "AIzaSyB4jobCYJBlGeif138c9AJyuJYtpqy9JWQ",
    authDomain: "insightgrid-697cc.firebaseapp.com",
    projectId: "insightgrid-697cc",
    storageBucket: "insightgrid-697cc.firebasestorage.app",
    messagingSenderId: "547445746637",
    appId: "1:547445746637:web:89acbecd4b72fb733bb284",
    measurementId: "G-SN5PXJ8XK4"
  };

// ── Initialize Firebase ──────────────────────────────────────
firebase.initializeApp(firebaseConfig);

const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

// ── Firestore Settings ───────────────────────────────────────
db.settings({ ignoreUndefinedProperties: true });

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
