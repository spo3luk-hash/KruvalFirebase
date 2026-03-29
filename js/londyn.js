// Tento soubor je připraven pro budoucí interaktivní logiku specifickou pro lokaci Londýn.
document.addEventListener('DOMContentLoaded', () => {
    console.log("Skript pro Londýn byl úspěšně načten.");

    const auth = firebase.auth();

    auth.onAuthStateChanged(user => {
        if (!user) {
            // Pokud uživatel není přihlášen, přesměrujeme ho pryč.
            window.location.href = 'index.html';
        }
    });

    // Zde bude v budoucnu kód pro otevírání obchodů, interakce s postavami atd.
});
