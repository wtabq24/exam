/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { 
  initializeAuth, 
  browserLocalPersistence, 
  browserPopupRedirectResolver, 
  indexedDBLocalPersistence,
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { 
  initializeFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  orderBy, 
  limit, 
  getDocFromServer, 
  Query, 
  QuerySnapshot, 
  DocumentData, 
  serverTimestamp,
  writeBatch,
  enableNetwork
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Manual Firebase Configuration with environment variable support
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBMMyOInaVHnNKyUJ6TQI64f-bzMRR-RP4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "intelligent-exam-archiving.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "intelligent-exam-archiving",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "intelligent-exam-archiving.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "616355375955",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:616355375955:web:5c789a4f6752be01188fa6",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-NKN1P4572K"
};

export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.apiKey !== "TODO_KEYHERE");

if (!isFirebaseConfigured) {
  console.warn("Firebase is not fully configured. Please set VITE_FIREBASE_* environment variables.");
}

const app = initializeApp(firebaseConfig);

// Initialize Auth with explicit persistence and resolver for better reliability in iframes
// We use a list of persistence types to ensure it works in various browser environments
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});

// Initialize Analytics safely
export let analytics: any;
if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (err) {
        console.error('Firebase Analytics failed to initialize:', err);
      }
    }
  }).catch(err => {
    console.warn('Firebase Analytics is not supported in this environment:', err);
  });
}

// Initialize Firestore with long-polling as requested to ensure "offline" error is resolved
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  // @ts-ignore - useFetchStreams is an experimental property
  useFetchStreams: false,
  ignoreUndefinedProperties: true
});

// Silently attempt to enable network
enableNetwork(db).catch(() => {});

export const storage = getStorage(app);
storage.maxUploadRetryTime = 600000; // 10 minutes
storage.maxOperationRetryTime = 300000; // 5 minutes
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  orderBy, 
  limit,
  getDocFromServer,
  serverTimestamp,
  writeBatch,
  enableNetwork,
  ref,
  uploadBytes,
  getDownloadURL
};

export type { 
  Query, 
  QuerySnapshot, 
  DocumentData 
};
