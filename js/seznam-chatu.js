document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    const roomListContainer = document.getElementById('room-list-container');

    // Ověření, zda je uživatel přihlášen
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = '/index.html';
        }
    });

    // Načtení a zobrazení místností
    db.collection('chat_mistnosti').orderBy('name', 'asc').onSnapshot(snapshot => {
        if (snapshot.empty) {
            roomListContainer.innerHTML = '<p class="loading-text">Zatím nebyly vytvořeny žádné veřejné místnosti.</p>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const room = doc.data();
            const defaultImage = '/img/default-background.jpg'; // Výchozí obrázek, pokud není specifikován

            html += `
                <a href="/chat.html?id=${doc.id}" class="room-card">
                    <div class="room-card-image" style="background-image: url('${room.backgroundUrl || defaultImage}')">
                        ${!room.backgroundUrl ? room.name : ''} <!-- Zobrazit název v obrázku, jen pokud obrázek chybí -->
                    </div>
                    <div class="room-card-content">
                        <h3>${room.name}</h3>
                        <p>${room.description || 'Popis není k dispozici.'}</p>
                    </div>
                </a>
            `;
        });

        roomListContainer.innerHTML = html;

    }, err => {
        console.error("Chyba při načítání místností: ", err);
        roomListContainer.innerHTML = '<p class="loading-text error">Nepodařilo se načíst seznam místností. Zkuste to prosím později.</p>';
    });
});
