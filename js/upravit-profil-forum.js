document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const form = document.getElementById('profile-form');
    const nicknameInput = document.getElementById('forum-nickname');
    const avatarInput = document.getElementById('forum-avatar');
    const signatureInput = document.getElementById('forum-signature');
    const submitButton = form.querySelector('.btn-primary');
    const currentNicknameDisplay = document.getElementById('current-nickname-display');
    const avatarPreview = document.getElementById('avatar-preview'); // Přidáno pro náhled

    let currentUser = null;
    let userDocRef = null;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            userDocRef = db.collection('users').doc(currentUser.uid);

            userDocRef.get().then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    nicknameInput.value = data.identitaNaForu || '';
                    avatarInput.value = data.avatarNaForu || '';
                    signatureInput.value = data.podpisNaForu || '';
                    currentNicknameDisplay.textContent = data.identitaNaForu || 'Zatím neuvedeno';

                    // Zobrazíme aktuální avatar v náhledu při načtení stránky
                    if (data.avatarNaForu) {
                        avatarPreview.src = data.avatarNaForu;
                    } else {
                        avatarPreview.src = 'images/silhouettes/placeholder.png';
                    }
                } else {
                    console.error("Dokument uživatele v kolekci 'users' nebyl nalezen.");
                    alert("Váš uživatelský profil nebyl nalezen. Kontaktujte prosím podporu.");
                }
            }).catch(error => {
                console.error("Chyba při načítání uživatelského profilu: ", error);
                alert("Nepodařilo se načíst váš profil. Zkuste to prosím později.");
            });
        } else {
            alert("Pro úpravu profilu se musíte přihlásit.");
            window.location.href = 'index.html';
        }
    });

    // Funkce pro aktualizaci náhledu avataru
    const updateAvatarPreview = () => {
        const newAvatarUrl = avatarInput.value.trim();
        if (newAvatarUrl) {
            avatarPreview.src = newAvatarUrl;
        } else {
            avatarPreview.src = 'images/silhouettes/placeholder.png'; // Výchozí obrázek, pokud je pole prázdné
        }
    };

    // Naslouchání události 'input' na poli pro URL avataru
    avatarInput.addEventListener('input', updateAvatarPreview);
    
    // Ošetření chyby při načítání obrázku
    avatarPreview.onerror = () => {
        avatarPreview.src = 'images/silhouettes/placeholder.png'; // Zobrazíme placeholder, pokud URL není platný obrázek
        // Můžete přidat i nějaké upozornění pro uživatele
    };


    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser || !userDocRef) {
            alert("Došlo k chybě. Zkuste prosím obnovit stránku.");
            return;
        }

        const newNickname = nicknameInput.value.trim();
        if (!newNickname) {
            alert("Jméno na fóru nesmí být prázdné.");
            return;
        }
        
        submitButton.disabled = true;
        submitButton.textContent = 'Ukládám...';

        const dataToUpdate = {
            identitaNaForu: newNickname,
            avatarNaForu: avatarInput.value.trim(),
            podpisNaForu: signatureInput.value.trim(),
            profileLastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };

        userDocRef.update(dataToUpdate).then(() => {
            alert("Profil byl úspěšně aktualizován!");
            window.location.href = 'forum.html';
        }).catch(error => {
            console.error("Chyba při aktualizaci profilu: ", error);
            alert("Při ukládání profilu došlo k chybě. Zkuste to prosím znovu.");
            submitButton.disabled = false;
            submitButton.textContent = 'Uložit změny';
        });
    });
});
