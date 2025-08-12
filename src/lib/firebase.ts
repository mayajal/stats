// Your web app's Firebase configuration
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyDlBQSqy5zwe43cZ6Wb7mfqKjVa03bxA9c",
  authDomain: "statviz-j3txi.firebaseapp.com",
  projectId: "statviz-j3txi",
  storageBucket: "statviz-j3txi.firebasestorage.app",
  messagingSenderId: "737809041422",
  appId: "1:737809041422:web:22c97023c02733c2c2d45f"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export function getFirebaseAuth() {
  if (typeof window !== 'undefined') {
    return getAuth(app);
  }
  return undefined;
}
 

