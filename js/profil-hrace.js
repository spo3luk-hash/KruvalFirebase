document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();

    const urlParams = new URLSearchParams(window.location.search);
    const playerId = urlParams.get('id');
    const openTab = urlParams.get('tab');

    const loadingContainer = document.getElementById('profil-loading');
    const profileContainer = document.getElementById('profil-container');

    const tabLinks = document.querySelectorAll('.tab-link');
    const tabPanes = document.querySelectorAll('.tab-pane');

    // Reference na HTML elementy
    const avatarInitial = document.getElementById('player-avatar-initial');
    const playerNameEl = document.getElementById('player-name');
    const playerTitleEl = document.getElementById('player-title');
    const playerAgeEl = document.getElementById('player-age');
    const playerBirthdateEl = document.getElementById('player-birthdate');
    const playerGenderEl = document.getElementById('player-gender');
    const playerActivityEl = document.getElementById('player-activity');
    const charactersListEl = document.getElementById('characters-list');
    const badgesListEl = document.getElementById('badges-list');
    const friendsListEl = document.getElementById('friends-list');

    const switchTab = (tabId) => {
        tabLinks.forEach(link => link.classList.toggle('active', link.dataset.tab === tabId));
        tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === tabId));
        const newUrl = `${window.location.pathname}?id=${playerId}&tab=${tabId}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
    };

    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(link.dataset.tab);
        });
    });

    const calculateAge = (birthdate) => {
        if (!birthdate) return 'Neznámý';
        const birthDate = new Date(birthdate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const formatBirthdate = (birthdate) => {
        if (!birthdate) return '';
        const date = new Date(birthdate);
        return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
    };

    const renderPlayerProfile = (playerData) => {
        playerNameEl.textContent = playerData.herniNick || 'Jméno nebylo nalezeno';
        playerTitleEl.textContent = playerData.titul || 'Hráč';
        
        playerAgeEl.textContent = calculateAge(playerData.birthdate);
        playerBirthdateEl.textContent = formatBirthdate(playerData.birthdate);

        playerGenderEl.textContent = playerData.pohlavi || 'Neznámé';
        playerActivityEl.textContent = playerData.posledniAktivita ? new Date(playerData.posledniAktivita.seconds * 1000).toLocaleDateString('cs-CZ') : 'Neznámá';
        
        avatarInitial.textContent = (playerData.herniNick || '?').charAt(0).toUpperCase();
        
        if (playerData.avatar) {
             document.getElementById('player-avatar-rect').style.backgroundImage = `url('${playerData.avatar}')`;
             avatarInitial.style.display = 'none';
        }
    };

    const renderPlayerCharacters = (playerId) => {
        charactersListEl.innerHTML = '<p>Načítám postavy...</p>';
        db.collection('hraci').doc(playerId).collection('postavy').orderBy('datumVytvoreni', 'desc').get().then(snapshot => {
            if (snapshot.empty) {
                charactersListEl.innerHTML = '<p>Tento hráč zatím nevlastní žádné postavy.</p>';
                return;
            }
            let charactersHTML = '';
            snapshot.forEach(doc => {
                const char = doc.data();

                // --- MIGRATION LOGIC ---
                // If the document is missing the 'id' field, add it for future queries.
                if (!char.id) {
                    doc.ref.update({ id: doc.id });
                }
                // --- END MIGRATION LOGIC ---

                charactersHTML += `
                    <div class="character-card">
                        <a href="profil-postavy.html?id=${doc.id}&hracId=${playerId}">
                            <h3>${char.jmeno}</h3>
                            <p>${char.herniRole || 'Nováček'}</p>
                        </a>
                    </div>
                `;
            });
            charactersListEl.innerHTML = charactersHTML;
        }).catch(err => {
            console.error("Chyba při načítání postav hráče: ", err);
            charactersListEl.innerHTML = '<p>Došlo k chybě při načítání postav.</p>';
        });
    };
    
    const renderPlayerFriends = async (playerId) => {
        friendsListEl.innerHTML = '<p>Načítám přátele...</p>';
        try {
            const userDoc = await db.collection('hraci').doc(playerId).get();
            if (!userDoc.exists) {
                friendsListEl.innerHTML = '<p>Hráč nenalezen.</p>';
                return;
            }

            const friends = userDoc.data().friends || [];
            if (friends.length === 0) {
                friendsListEl.innerHTML = '<p>Tento hráč zatím nemá žádné přátele.</p>';
                return;
            }

            let friendsHTML = '';
            for (const friendId of friends) {
                const friendDoc = await db.collection('hraci').doc(friendId).get();
                if (friendDoc.exists) {
                    const friendData = friendDoc.data();
                    friendsHTML += `
                        <div class="friend-card">
                            <a href="profil-hrace.html?id=${friendId}">
                                <div class="friend-avatar">${(friendData.herniNick || '?').charAt(0).toUpperCase()}</div>
                                <h3>${friendData.herniNick}</h3>
                            </a>
                        </div>
                    `;
                }
            }
            friendsListEl.innerHTML = friendsHTML;
        } catch (err) {
            console.error("Chyba při načítání přátel: ", err);
            friendsListEl.innerHTML = '<p>Došlo k chybě při načítání přátel.</p>';
        }
    };

    const renderPlayerBadges = (playerId) => {
        badgesListEl.innerHTML = '<p>Načítám úspěchy...</p>';
        db.collection('hraci').doc(playerId).collection('ziskaneOdznaky').orderBy('datumZiskani', 'desc').get().then(snapshot => {
            if (snapshot.empty) {
                badgesListEl.innerHTML = '<p>Tento hráč zatím nezískal žádné úspěchy.</p>';
                return;
            }
            let badgesHTML = '';
            snapshot.forEach(doc => {
                const badge = doc.data();
                badgesHTML += `
                    <div class="badge-item">
                        <div class="badge-icon"><i class="${badge.ikona || 'fas fa-medal'}"></i></div>
                        <div class="badge-details">
                            <h3>${badge.nazev}</h3>
                            <p>${badge.popis}</p>
                            <span class="badge-date">Získáno: ${badge.datumZiskani ? new Date(badge.datumZiskani.seconds * 1000).toLocaleDateString('cs-CZ') : 'Datum neznámé'}</span>
                        </div>
                    </div>
                `;
            });
            badgesListEl.innerHTML = badgesHTML;
        }).catch(err => {
            console.error("Chyba při načítání úspěchů hráče: ", err);
            badgesListEl.innerHTML = '<p>Došlo k chybě při načítání úspěchů.</p>';
        });
    };

    if (!playerId) {
        loadingContainer.innerHTML = '<p class="error-message">Chyba: ID hráče nebylo v adrese nalezeno.</p>';
        return;
    }

    db.collection('hraci').doc(playerId).get().then(doc => {
        if (!doc.exists) {
            loadingContainer.innerHTML = '<p class="error-message">Hráč s tímto ID nebyl nalezen.</p>';
            return;
        }

        loadingContainer.style.display = 'none';
        profileContainer.style.display = 'block';

        const playerData = doc.data();
        renderPlayerProfile(playerData);
        renderPlayerCharacters(playerId);
        renderPlayerBadges(playerId);
        renderPlayerFriends(playerId);

        if (openTab && document.getElementById(openTab)) {
            switchTab(openTab);
        } else {
            switchTab('overview');
        }

    }).catch(err => {
        console.error("Chyba při načítání profilu hráče: ", err);
        loadingContainer.innerHTML = '<p class="error-message">Při načítání profilu došlo k závažné chybě.</p>';
    });
});
