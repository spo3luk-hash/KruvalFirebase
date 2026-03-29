(() => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const playerSelectModal = document.getElementById('player-select-modal');
    const messageContentModal = document.getElementById('message-content-modal');
    const sendMessageBtnModal = document.getElementById('send-message-btn-modal');

    if (!playerSelectModal || !messageContentModal || !sendMessageBtnModal) {
        console.error('Nepodařilo se najít všechny potřebné prvky v modálním okně. Skript se ukončuje.');
        return;
    }

    let activeCharacterRef = null;

    const init = async () => {
        const user = auth.currentUser;
        if (user) {
            try {
                const userDoc = await db.collection('hraci').doc(user.uid).get();
                if (userDoc.exists && userDoc.data().aktivniPostava) {
                    activeCharacterRef = db.collection('hraci').doc(user.uid).collection('postavy').doc(userDoc.data().aktivniPostava);
                    await loadPlayersModal();
                } else {
                     console.error('Aktivní postava nenalezena.');
                }
            } catch (error) {
                console.error('Chyba při inicializaci modálního okna:', error);
            }
        }
    };

    async function loadPlayersModal() {
        const snapshot = await db.collectionGroup('postavy').get();
        playerSelectModal.innerHTML = '<option value="">Vyber hráče</option>';
        const currentCharacterId = activeCharacterRef.id;
        snapshot.forEach(doc => {
            const data = doc.data();
            if(doc.id !== currentCharacterId) {
                playerSelectModal.innerHTML += `<option value="${doc.ref.path}">${data.jmeno}</option>`;
            }
        });
    }

    async function getDeliveryTimeInSeconds() {
        let deliveryTime = 20 * 60; // Výchozí hodnota 20 minut
        if (!activeCharacterRef) return deliveryTime;

        const charDoc = await activeCharacterRef.get();
        if (!charDoc.exists || !charDoc.data().mazlicek) return deliveryTime;
        
        let petData = charDoc.data().mazlicek;

        // Pokud u mazlíčka existuje schopnost, použijeme ji
        if (petData.schopnosti && typeof petData.schopnosti.dobaDoruceni === 'number') {
            return petData.schopnosti.dobaDoruceni;
        }

        // Pokud schopnost chybí (stará data), zkusíme ji načíst z obchodu
        if (petData.id) { // `id` odkazuje na původní item v obchodě
            try {
                const shopItemDoc = await db.collection('obchody').doc('zverimex').collection('mazlicci').doc(petData.id).get();
                if (shopItemDoc.exists) {
                    const shopItemData = shopItemDoc.data();
                    if (shopItemData.schopnosti && typeof shopItemData.schopnosti.dobaDoruceni === 'number') {
                        // Našli jsme, uložíme schopnosti k mazlíčkovi pro příště
                        petData.schopnosti = shopItemData.schopnosti;
                        await activeCharacterRef.update({ mazlicek: petData });
                        return shopItemData.schopnosti.dobaDoruceni;
                    }
                }
            } catch (error) {
                console.error("Nepodařilo se načíst data z obchodu pro doplnění schopností.", error);
            }
        }

        return deliveryTime; // Pokud se nic nepodařilo, vrátíme výchozí hodnotu
    }

    sendMessageBtnModal.addEventListener('click', async () => {
        const recipientPath = playerSelectModal.value;
        const content = messageContentModal.value.trim();

        if (!recipientPath || !content) {
            alert('Vyber prosím adresáta a napiš zprávu.');
            return;
        }

        sendMessageBtnModal.disabled = true;
        sendMessageBtnModal.textContent = 'Odesílám...';

        try {
            const recipientRef = db.doc(recipientPath);
            const recipientDoc = await recipientRef.get();
            if (!recipientDoc.exists) {
                alert('Cílová postava nebyla nalezena!');
                sendMessageBtnModal.disabled = false;
                sendMessageBtnModal.textContent = 'Odeslat zprávu';
                return;
            }

            const dobaDoruceniSekundy = await getDeliveryTimeInSeconds();
            const casOdeslani = firebase.firestore.Timestamp.now();
            const casDoruceni = new firebase.firestore.Timestamp(casOdeslani.seconds + dobaDoruceniSekundy, casOdeslani.nanoseconds);

            await db.collection('posta').add({
                odesilatelPath: activeCharacterRef.path,
                prijemcePath: recipientPath,
                obsah: content,
                casOdeslani: casOdeslani,
                casDoruceni: casDoruceni, 
                precteno: false,
                stav: 'dostarcza',
                typ: 'havrani_posta'
            });

            alert('Zpráva byla úspěšně odeslána havranem!');
            if (window.closeCurrentModal) {
                window.closeCurrentModal();
            }
        } catch (error) {
            console.error("Chyba při odesílání zprávy: ", error);
            alert('Při odesílání zprávy došlo k chybě.');
        } finally {
            sendMessageBtnModal.disabled = false;
            sendMessageBtnModal.textContent = 'Odeslat zprávu';
        }
    });

    init();
})();