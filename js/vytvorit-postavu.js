document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const createCharForm = document.getElementById('create-char-form');
    const errorMessage = document.getElementById('error-message');
    const submitBtn = document.getElementById('submit-btn');

    let currentUser = null;
    let hracNick = null;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            const userDocRef = db.collection('hraci').doc(user.uid);
            
            userDocRef.get().then(doc => {
                if (doc.exists && doc.data().herniNick) {
                    hracNick = doc.data().herniNick;
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Vytvořit postavu';
                } else {
                    showError("Chyba: Váš profil hráče je neúplný (chybí přezdívka). Kontaktujte administrátora.");
                }
            }).catch(error => {
                 console.error("Chyba při načítání profilu hráče: ", error);
                 showError("Nepodařilo se načíst váš profil. Zkuste obnovit stránku.");
            });
        } else {
            window.location.href = 'index.html';
        }
    });

    createCharForm.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!currentUser || !hracNick) {
            showError('Váš profil není plně načten. Zkuste to za okamžik znovu.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Vytvářím...';

        const charName = document.getElementById('char-name').value.trim();
        const birthYear = parseInt(document.getElementById('birth-year').value);
        const bloodOrigin = document.getElementById('blood-origin').value;
        const description = document.getElementById('description').value.trim();

        const postavyCollectionRef = db.collection('hraci').doc(currentUser.uid).collection('postavy');
        const newCharRef = postavyCollectionRef.doc();

        const newCharacterData = {
            id: newCharRef.id,
            jmeno: charName,
            rokNarozeni: birthYear,
            puvod: bloodOrigin,
            popis: description,
            datumVytvoreni: firebase.firestore.FieldValue.serverTimestamp(),
            vlastnikNick: hracNick,
            herniRole: "Nováček",
            xpBody: 0,
            peněženka: {
                galeony: 0,
                srpce: 0,
                svrcky: 0
            }
        };

        newCharRef.set(newCharacterData)
        .then(() => {
            // Zkontrolujeme, zda je to první postava, a případně udělíme odznak
            return postavyCollectionRef.get().then(snapshot => {
                if (snapshot.size === 1) {
                    return grantFirstCharacterBadge(currentUser.uid);
                }
            });
        })
        .then(() => {
            window.location.href = 'vyber-postavy.html';
        })
        .catch((error) => {
            console.error("Chyba při ukládání postavy nebo udělování odznaku: ", error);
            showError('Při vytváření postavy došlo k chybě. Zkuste to prosím znovu.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Vytvořit postavu';
        });
    });

    async function grantFirstCharacterBadge(hracId) {
        const badgeRef = db.collection('hraci').doc(hracId).collection('ziskaneOdznaky').doc('prvni-postava');
        const badgeData = {
            nazev: 'První postava',
            popis: 'Odznak za vytvoření tvé první herní postavy.',
            datumZiskani: firebase.firestore.FieldValue.serverTimestamp(),
            ikona: 'fas fa-user-plus' // Ikonka pro budoucí využití
        };
        await badgeRef.set(badgeData);

        const notificationRef = db.collection('notifications').doc();
        const notificationData = {
            hracId: hracId,
            typ: 'soukrome',
            precteno: false,
            nazevUpozorneni: 'Získán nový úspěch!',
            obsahUpozorneni: `Gratulujeme! Získal jsi svůj první úspěch: "První postava". Můžeš si ho prohlédnout ve svém profilu v záložce Úspěchy.`,
            // Přidáme odkaz pro snadné přesměrování
            link: `profil-hrace.html?id=${hracId}&tab=uspechy`,
            casVytvoreni: firebase.firestore.FieldValue.serverTimestamp()
        };
        await notificationRef.set(notificationData);
        console.log(`Hráč ${hracId} získal odznak 'První postava' a bylo mu odesláno upozornění.`);
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
});
