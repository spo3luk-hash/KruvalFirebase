document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const urlParams = new URLSearchParams(window.location.search);
    const characterId = urlParams.get('id');

    const characterNameTitle = document.getElementById('character-name-title');
    const inventoryList = document.getElementById('inventory-list');

    auth.onAuthStateChanged(user => {
        if (user) {
            if (!characterId) {
                characterNameTitle.textContent = 'Chyba: ID postavy nebylo nalezeno.';
                return;
            }
            loadCharacterInventory(user.uid, characterId);
        } else {
            window.location.href = 'index.html';
        }
    });

    function loadCharacterInventory(userId, charId) {
        const charRef = db.collection('hraci').doc(userId).collection('postavy').doc(charId);

        charRef.get().then(doc => {
            if (doc.exists) {
                const charData = doc.data();
                characterNameTitle.textContent = `Správa postavy: ${charData.jmeno}`;
            }
        });

        const inventoryRef = charRef.collection('inventar');
        inventoryRef.onSnapshot(snapshot => {
            if (snapshot.empty) {
                inventoryList.innerHTML = '<p>Inventář je prázdný.</p>';
                return;
            }
            inventoryList.innerHTML = '';
            snapshot.forEach(doc => {
                const item = doc.data();
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('inventory-item');
                itemDiv.innerHTML = `<strong>${item.nazev}</strong>`;
                inventoryList.appendChild(itemDiv);
            });
        }, err => {
            console.error('Chyba při načítání inventáře: ', err);
            inventoryList.innerHTML = '<p>Došlo k chybě při načítání inventáře.</p>';
        });
    }
});
