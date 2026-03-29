document.addEventListener('DOMContentLoaded', async () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- UI Prvky ---
    const scoreDisplay = document.getElementById('score-display');
    const feedbackMessage = document.getElementById('feedback-message');
    const badgeAwardSection = document.getElementById('badge-award-section');
    const badgeImage = document.getElementById('badge-image');

    // --- Získání dat ---
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');
    const resultDataString = sessionStorage.getItem('quizResult');

    if (!quizId || !resultDataString) {
        alert('Nebyly nalezeny výsledky kvízu.');
        window.location.href = 'kvizova-mistnost.html';
        return;
    }

    const resultData = JSON.parse(resultDataString);
    const score = resultData.score;
    const totalQuestions = resultData.totalQuestions;
    const characterId = resultData.characterId;

    // --- Zobrazení výsledků ---
    scoreDisplay.textContent = `${score} / ${totalQuestions}`;
    displayFeedback(score, totalQuestions);

    // --- Zpracování odznaku ---
    auth.onAuthStateChanged(user => {
        if (user) {
            handleBadgeAward(user, characterId, score, totalQuestions);
        } else {
            // Pokud uživatel není přihlášen, nemůžeme mu dát odznak
            console.log("Uživatel není přihlášen, odznak nebude udělen.");
        }
    });

    function displayFeedback(score, total) {
        const percentage = total > 0 ? (score / total) * 100 : 0;
        let message = '';
        if (percentage === 100) {
            message = 'Dokonalé! Zodpověděl jsi vše správně a ukázal jsi mistrovské znalosti!';
        } else if (percentage >= 75) {
            message = 'Skvělý výkon! Jsi jen krůček od dokonalosti.';
        } else if (percentage >= 50) {
            message = 'Dobrý pokus! S trochou cviku to příště bude ještě lepší.';
        } else {
            message = 'Nevěš hlavu. Každá cesta začíná prvním krokem. Zkus to znovu!';
        }
        feedbackMessage.innerHTML = `<p>${message}</p>`;
    }

    async function handleBadgeAward(user, charId, score, total) {
        if (!charId) {
            console.log("Není známo ID postavy, odznak nelze udělit.");
            return;
        }

        // Podmínka pro získání odznaku: 100% skóre
        if (score !== total || total === 0) {
            return;
        }

        try {
            const quizDoc = await db.collection('kvizy').doc(quizId).get();
            if (!quizDoc.exists || !quizDoc.data().odznakUrl) {
                // Kvíz nemá odznak nebo neexistuje
                return;
            }

            const badgeUrl = quizDoc.data().odznakUrl;
            const characterRef = db.collection('postavy').doc(charId);
            
            // Zobrazíme odznak
            badgeImage.src = badgeUrl;
            badgeAwardSection.style.display = 'block';

            // Uložíme odznak k postavě
            // Použijeme FieldValue.arrayUnion pro atomické přidání do pole
            await characterRef.update({
                odznaky: firebase.firestore.FieldValue.arrayUnion(badgeUrl)
            });

        } catch (error) {
            console.error("Chyba při udělování odznaku: ", error);
            badgeAwardSection.style.display = 'none';
        }
    }

    // --- Úklid ---
    sessionStorage.removeItem('quizResult');
});
