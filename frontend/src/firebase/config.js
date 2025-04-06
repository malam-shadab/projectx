// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC8VnLx1wbHMhrQgvS6GylSieQJ4Z6eSSE",
  authDomain: "textanalysis-ce6bb.firebaseapp.com",
  projectId: "textanalysis-ce6bb",
  storageBucket: "textanalysis-ce6bb.firebasestorage.app",
  messagingSenderId: "85383043333",
  appId: "1:85383043333:web:601d5806498c5b491b7f6c",
  measurementId: "G-481BV5SH2N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);