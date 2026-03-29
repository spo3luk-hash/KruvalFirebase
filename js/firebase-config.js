// Konfigurace Firebase - Tento soubor je klíčový pro spojení s databází
const firebaseConfig = {
    apiKey: "AIzaSyAMIWfMe0oBagjkOc8JgWh2REFWB0rKVgg",
    authDomain: "hrakruval2-9a626.firebaseapp.com",
    projectId: "hrakruval2-9a626",
    storageBucket: "hrakruval2-9a626.firebasestorage.app",
    messagingSenderId: "868808538299",
    appId: "1:868808538299:web:ecb52ed4aee2afdb81519e",
    measurementId: "G-FCTJQSF3XB"
};

// Inicializace Firebase
firebase.initializeApp(firebaseConfig);
console.log("Firebase magická brána byla úspěšně otevřena.");
