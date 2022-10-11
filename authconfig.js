// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore'

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA4zgM3ghanc2qxZVa-e12VRA8QhgKvz-o",
  authDomain: "st-pet-er.firebaseapp.com",
  projectId: "st-pet-er",
  storageBucket: "st-pet-er.appspot.com",
  messagingSenderId: "558917149713",
  appId: "1:558917149713:web:f421b3ae2e96a200187db0"
};

// Initialize Firebase
const firestore = initializeApp(firebaseConfig);

console.log("Hello, there firestore!");
