"use client";

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDS2kZ4505DY8RzprHi22r1irgmNGHMvvI",
  authDomain: "body-reset-49a74.firebaseapp.com",
  projectId: "body-reset-49a74",
  storageBucket: "body-reset-49a74.firebasestorage.app",
  messagingSenderId: "366999871121",
  appId: "1:366999871121:web:d8069c7d1a61eccae7a930"
};
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
