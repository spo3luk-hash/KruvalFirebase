document.addEventListener('DOMContentLoaded', () => {
    // Získání všech potřebných elementů ze stránky
    const playerNickElement = document.getElementById('player-nick');
    const playerEmailElement = document.getElementById('player-email');
    const playerAvatarElement = document.getElementById('player-avatar');
    const playerFrameElement = document.getElementById('player-frame');
    const playerRoleElement = document.getElementById('player-role');
    const anonymousLoginBtn = document.getElementById('anonymous-login-btn');
    const anonymousNickInput = document.getElementById('anonymous-nick');
    const playerEntryBtn = document.querySelector('.player-entry .btn-main-action');

    // Naslouchání změn stavu přihlášení
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // --- Uživatel je přihlášen ---
            const db = firebase.firestore();
            // ZMĚNA: Používáme kolekci 'hraci' pro konzistenci
            db.collection('hraci').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    
                    // Nastavení jména a emailu - preferujeme 'herniNick'
                    playerNickElement.textContent = userData.herniNick || userData.username || 'Neznámý hráč';
                    playerEmailElement.textContent = user.email;

                    // Logika pro avatar
                    if (userData.avatarUrl) {
                        playerAvatarElement.src = userData.avatarUrl;
                    } else {
                        playerAvatarElement.src = 'img/avatars/default.png';
                    }
                    
                    // Logika pro rámeček
                    if (userData.avatarFrame && userData.avatarFrame !== 'frame-default') {
                        // Zde bude v budoucnu potřeba načíst SVG rámečku, prozatím skryjeme
                        playerFrameElement.style.display = 'none'; 
                    } else {
                        playerFrameElement.style.display = 'none';
                    }

                    // Zobrazení role
                    playerRoleElement.textContent = userData.role || 'Pozorovatel';

                } else {
                    // Fallback, pokud data v databázi 'hraci' neexistují
                    playerNickElement.textContent = user.displayName || 'Nový hráč';
                    playerEmailElement.textContent = user.email;
                    playerRoleElement.textContent = 'Nováček';
                }
            }).catch(error => {
                console.error("Chyba při načítání dat hráče z 'hraci': ", error);
                playerNickElement.textContent = 'Chyba načítání';
                playerEmailElement.textContent = 'N/A';
            });

        } else {
            // --- Uživatel není přihlášen ---
            const playerEntry = document.querySelector('.player-entry');
            playerEntry.style.opacity = '0.6';
            playerEntry.style.pointerEvents = 'none';

            playerNickElement.textContent = 'Nepřihlášen';
            playerEmailElement.textContent = 'N/A';
            playerRoleElement.textContent = 'N/A';
            playerEntryBtn.textContent = 'Nejprve se přihlaste';
            playerEntryBtn.href = 'index.html'; 
        }
    });

    // --- Funkčnost pro anonymní vstup ---
    anonymousLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const nick = anonymousNickInput.value.trim();
        if (nick) {
            sessionStorage.setItem('anonymousNick', nick);
            window.location.href = anonymousLoginBtn.href;
        } else {
            alert('Prosím, zadejte přezdívku pro anonymní vstup.');
        }
    });
});
