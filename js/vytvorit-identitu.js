document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const identityForm = document.getElementById('vytvorit-identitu-form');
    const identityNameInput = document.getElementById('jmeno-identity');
    const errorMessage = document.getElementById('chybova-zprava');

    let currentUser = null;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            // Zkontrolujeme, jestli uživatel už nemá identitu
            const userRef = db.collection('users').doc(user.uid);
            userRef.get().then(doc => {
                if (doc.exists && doc.data().identitaNaForu) {
                    // Pokud už identitu má, přesměrujeme ho pryč
                    window.location.href = 'forum.html';
                }
            });
        } else {
            // Pokud není přihlášen, pošleme ho na hlavní stránku
            window.location.href = 'index.html';
        }
    });

    identityForm.addEventListener('submit', (e) => {
        e.preventDefault();
        errorMessage.style.display = 'none';
        const identityName = identityNameInput.value.trim();

        if (!currentUser) {
            errorMessage.textContent = 'Nejste přihlášen.';
            errorMessage.style.display = 'block';
            return;
        }

        if (identityName.length < 3) {
            errorMessage.textContent = 'Jméno musí mít alespoň 3 znaky.';
            errorMessage.style.display = 'block';
            return;
        }

        // Uložení identity do databáze
        const userRef = db.collection('users').doc(currentUser.uid);
        userRef.set({ // Použijeme .set s { merge: true }, abychom nepřepsali ostatní data
            identitaNaForu: identityName
        }, { merge: true }).then(() => {
            // Po úspěšném uložení přesměrujeme zpět na fórum
            window.location.href = 'forum.html';
        }).catch(error => {
            console.error("Chyba při ukládání identity: ", error);
            errorMessage.textContent = 'Došlo k chybě při ukládání. Zkuste to prosím znovu.';
            errorMessage.style.display = 'block';
        });
    });
});
