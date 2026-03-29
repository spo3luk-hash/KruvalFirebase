document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Reference na DOM prvky
    const accountInfoContent = document.getElementById('account-info-content');
    const characterInfoContent = document.getElementById('character-info-content');
    const logoutButton = document.getElementById('logout-btn-hra');
    const onlinePlayersList = document.getElementById('online-players-list');
    const menuNastenka = document.getElementById('menu-nastenka');
    const mainContentArea = document.getElementById('main-content-area');
    const mainContentHeader = document.querySelector('.main-content-header');
    const contentTitle = document.getElementById('content-title');
    const contentDescription = document.getElementById('content-description');
    const mailIconLink = document.getElementById('mail-icon-link');
    const mailNotificationCount = document.getElementById('mail-notification-count');

    let currentUser = null;
    let unsubscribeStatusListener = null;
    let unsubscribeMailListener = null;

    // === INICIALIZACE HRY ===
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            const characterId = sessionStorage.getItem('selectedCharacterId');
            if (!characterId) {
                window.location.href = 'vyber-postavy.html';
                return;
            }
            const characterRef = db.collection('hraci').doc(user.uid).collection('postavy').doc(characterId);
            loadGameData(characterRef);
            setupFirestorePresence(user.uid);
            renderCurrentLocation();
            setupUnreadMailListener(characterRef); // Spustíme nový listener pošty
        } else {
            if (unsubscribeStatusListener) unsubscribeStatusListener();
            if (unsubscribeMailListener) unsubscribeMailListener();
            currentUser = null;
            window.location.href = 'index.html';
        }
    });

    async function loadGameData(characterRef) {
        const playerDoc = await db.collection('hraci').doc(currentUser.uid).get();
        if (playerDoc.exists) displayAccountInfo(playerDoc.data());

        const charDoc = await characterRef.get();
        if (charDoc.exists) {
            displayCharacterInfo(charDoc.data());
        }
    }

    // === NOVÝ EFEKTIVNÍ LISTENER PRO NEPŘEČTENOU POŠTU ===
    function setupUnreadMailListener(characterRef) {
        if (unsubscribeMailListener) unsubscribeMailListener();

        unsubscribeMailListener = db.collection('posta')
            .where('prijemcePath', '==', characterRef.path)
            .where('precteno', '==', false)
            .where('casDoruceni', '<=', new Date())
            .onSnapshot(snapshot => {
                const unreadCount = snapshot.size;
                updateMailBadge(unreadCount);
            }, error => {
                console.error("Chyba při sledování nepřečtené pošty: ", error);
            });
    }

    // === AKTUALIZACE NOTIFIKAČNÍHO ODZNAKU ===
    function updateMailBadge(count) {
        if (mailNotificationCount && mailIconLink) {
            if (count > 0) {
                mailNotificationCount.textContent = count;
                mailNotificationCount.style.display = 'flex'; // Použijeme flex pro lepší zarovnání
            } else {
                mailNotificationCount.style.display = 'none';
            }
        }
    }

    function renderCurrentLocation() {
        mainContentHeader.style.display = 'block';
        mainContentArea.innerHTML = '';
        contentTitle.textContent = 'Velká síň';
        contentDescription.textContent = 'Srdce hradu, kde se studenti setkávají a stolují.';
        const locationContent = document.createElement('p');
        locationContent.textContent = 'Jsi ve Velké síni. Kolem tebe je rušno, studenti všech kolejí spolu živě diskutují. Co uděláš?';
        mainContentArea.appendChild(locationContent);
    }

    async function renderBulletinBoard() {
        mainContentHeader.style.display = 'none';
        mainContentArea.innerHTML = `<div class="loading-spinner">Načítám příspěvky...</div>`;
        try {
            const snapshot = await db.collection('nastenka').orderBy('createdAt', 'desc').get();
            const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const boardContainer = document.createElement('div');
            boardContainer.className = 'bulletin-board';
            boardContainer.innerHTML = `
                <div class="bulletin-board-header">
                    <h3>Nástěnka</h3>
                    <button id="close-bulletin-btn" class="close-btn" title="Zavřít"><i class="fas fa-times"></i></button>
                </div>
                <div class="bulletin-board-nav">
                    <button class="tab-btn active" data-tab="novinky">Seznam novinek</button>
                    <button class="tab-btn" data-tab="nonrp">Non-RP Informace</button>
                </div>
                <div class="bulletin-board-content">
                    <div id="tab-novinky" class="tab-pane active"></div>
                    <div id="tab-nonrp" class="tab-pane"></div>
                </div>
            `;
            mainContentArea.innerHTML = '';
            mainContentArea.appendChild(boardContainer);
            const novinkyContainer = boardContainer.querySelector('#tab-novinky');
            const nonrpContainer = boardContainer.querySelector('#tab-nonrp');
            const formatTimestamp = ts => ts ? ts.toDate().toLocaleDateString('cs-CZ') : 'Neznámo';
            const novinkyPosts = posts.filter(p => p.category === 'novinky');
            const nonrpPosts = posts.filter(p => p.category === 'nonrp');
            novinkyContainer.innerHTML = novinkyPosts.length > 0 ? novinkyPosts.map(post => `
                <div class="post-item">
                    <h3>${post.title}</h3>
                    <p>${post.content.replace(/\n/g, '<br>')}</p>
                    <span class="post-meta">Vydal: ${post.author} | ${formatTimestamp(post.createdAt)}</span>
                </div>
            `).join('') : '<p class="placeholder-text">Žádné novinky k zobrazení.</p>';
            nonrpContainer.innerHTML = nonrpPosts.length > 0 ? nonrpPosts.map(post => `
                <div class="post-item">
                    <h3>${post.title}</h3>
                    <p>${post.content.replace(/\n/g, '<br>')}</p>
                    <span class="post-meta">Vydal: ${post.author} | ${formatTimestamp(post.createdAt)}</span>
                </div>
            `).join('') : '<p class="placeholder-text">Žádné non-RP informace k zobrazení.</p>';
            boardContainer.querySelector('#close-bulletin-btn').addEventListener('click', renderCurrentLocation);
            const tabButtons = boardContainer.querySelectorAll('.tab-btn');
            const tabPanes = boardContainer.querySelectorAll('.tab-pane');
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    const targetTab = button.getAttribute('data-tab');
                    tabPanes.forEach(pane => {
                        pane.classList.toggle('active', pane.id === 'tab-' + targetTab);
                    });
                });
            });
        } catch (error) {
            console.error("Chyba při načítání nástěnky: ", error);
            mainContentArea.innerHTML = '<p class="error-text">Nepodařilo se načíst nástěnku. Zkuste to prosím znovu později.</p>';
        }
    }

    menuNastenka.addEventListener('click', (e) => {
        e.preventDefault();
        renderBulletinBoard();
    });

    async function setupFirestorePresence(uid) {
        const statusDocRef = db.collection('status').doc(uid);
        try {
            await statusDocRef.set({ state: 'online', last_changed: new Date() });
        } catch (error) {
            console.error("Error setting online status: ", error);
        }
        if (unsubscribeStatusListener) unsubscribeStatusListener();
        unsubscribeStatusListener = db.collection('status').where('state', '!=', 'offline').onSnapshot(async (snapshot) => {
            const onlineUsers = {};
            snapshot.forEach(doc => onlineUsers[doc.id] = doc.data());
            await renderOnlinePlayers(onlineUsers);
        });
        setupActivityListeners(statusDocRef);
        window.addEventListener('beforeunload', () => {
            statusDocRef.set({ state: 'offline', last_changed: new Date() });
        });
    }

    function setupActivityListeners(statusDocRef) {
        let afkTimeout;
        const goAway = () => statusDocRef.update({ state: 'away', last_changed: new Date() });
        const goOnline = async () => {
            const doc = await statusDocRef.get();
            if (doc.exists && doc.data().state === 'away') {
                statusDocRef.update({ state: 'online', last_changed: new Date() });
            }
        };
        const resetAfkTimeout = () => {
            clearTimeout(afkTimeout);
            goOnline();
            afkTimeout = setTimeout(goAway, 3 * 60 * 1000);
        };
        ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            window.addEventListener(event, resetAfkTimeout, { passive: true });
        });
        resetAfkTimeout();
    }

    async function renderOnlinePlayers(onlineUsers) {
        onlinePlayersList.innerHTML = '';
        const userPromises = Object.keys(onlineUsers).map(async (uid) => {
            try {
                const playerDoc = await db.collection('hraci').doc(uid).get();
                if (!playerDoc.exists) return null;
                const playerData = playerDoc.data();
                const activeCharId = playerData.aktivniPostava;
                let characterData = null;
                if (activeCharId) {
                    const charDoc = await db.collection('hraci').doc(uid).collection('postavy').doc(activeCharId).get();
                    if (charDoc.exists) characterData = charDoc.data();
                }
                return { uid, presence: onlineUsers[uid], playerData, characterData };
            } catch (error) {
                console.error(`Chyba při načítání dat pro hráče ${uid}:`, error);
                return null;
            }
        });
        const usersWithData = (await Promise.all(userPromises)).filter(Boolean);
        if (usersWithData.length === 0) {
            onlinePlayersList.innerHTML = '<p class="placeholder-text">Nikdo není online.</p>';
            return;
        }
        usersWithData.forEach(user => {
            if (user) onlinePlayersList.appendChild(createPlayerElement(user));
        });
    }

    function createPlayerElement(user) {
        const { presence, playerData, characterData } = user;
        const avatarUrl = playerData.avatarUrl || '';
        const frameId = playerData.avatarFrame || 'frame-default';
        const nick = playerData.herniNick || 'Neznámý';
        const initial = (nick || '?').charAt(0).toUpperCase();
        const frameData = SVG_FRAMES_RENDERER.find(f => f.id === frameId);
        const frameSvg = frameData ? `<svg viewBox="0 0 256 256">${frameData.svg}</svg>` : '';
        const sim = { characterState: "Má se dobře", characterLocation: "Velká síň" };
        const characterStatus = (characterData && characterData.status) 
            ? `<p class="player-info__status-msg">${characterData.status}</p>` 
            : '';
        const playerElement = document.createElement('div');
        playerElement.className = 'player-item';
        const backgroundStyle = avatarUrl ? `url('${avatarUrl}')` : 'none';
        playerElement.innerHTML = `
            <div class="player-item__avatar-container" style="grid-area: player_avatar;">
                <div class="avatar-container small-avatar" data-frame-id="${frameId}">
                    <div class="avatar-image" style="background-image: ${backgroundStyle};">
                        ${!avatarUrl ? `<span class="initial-in-grid">${initial}</span>` : ''}
                    </div>
                    <div class="avatar-frame">${frameSvg}</div>
                </div>
            </div>
            <div class="player-item__info" style="grid-area: player_info;">
                <div class="player-info__header"><span class="status-icon ${presence.state}"></span><span class="player-info__nick">${nick}</span></div>
                ${characterStatus}
            </div>
            ${characterData ? `
                <div class="character-item__info" style="grid-area: char_info;">
                    <div><span class="character-info__name">${characterData.jmeno}</span><span class="character-info__role">(${characterData.herniRole || 'Nováček'})</span></div>
                    <div class="character-info__details">
                        <span><i class="fas fa-map-marker-alt"></i> ${sim.characterLocation}</span>
                        <span><i class="fas fa-heartbeat"></i> ${sim.characterState}</span>
                    </div>
                </div>
            ` : '<div class="character-item__info placeholder-text" style="grid-area: char_info; font-size: 0.9em;">Žádná aktivní postava</div>'}
            <div class="interact-icons" style="grid-area: interact_icons;"><i class="fas fa-envelope" title="Poslat zprávu"></i><i class="fas fa-user-circle" title="Zobrazit profil hráče"></i></div>
        `;
        return playerElement;
    }

    function displayAccountInfo(playerData) {
        if (!accountInfoContent) return;
        accountInfoContent.innerHTML = `<p><strong>Herní nick:</strong> ${playerData.herniNick || 'Neznámý'}</p><p><strong>Email:</strong> ${currentUser.email}</p><p><strong>Role:</strong> ${playerData.role || 'hrac'}</p>`;
    }

    function displayCharacterInfo(charData) {
        if (!characterInfoContent) return;
        const currentYear = new Date().getFullYear();
        const vek = charData.rokNarozeni ? currentYear - charData.rokNarozeni : 'Neznámý';
        const puvodText = {cistokrevny: "Čistokrevný", smiseny: "Smíšený původ", mudlovsky: "Z mudlovské rodiny"}[charData.puvod] || "Neznámý původ";
        characterInfoContent.innerHTML = `<p><strong>Jméno:</strong> ${charData.jmeno}</p><p><strong>Herní role:</strong> ${charData.herniRole || 'Nováček'}</p><p><strong>Věk:</strong> ${vek} let</p><p><strong>Původ:</strong> ${puvodText}</p><hr><p><strong>XP body:</strong> ${charData.xpBody || 0}</p><p><strong>Zdraví:</strong> 100/100</p><p><strong>Mana:</strong> 50/50</p><hr><div class="penize"><strong>Peníze:</strong><span><i class="fas fa-coins"></i> G: ${charData.peněženka?.galeony || 0}</span><span>S: ${charData.peněženka?.srpce || 0}</span><span>Svr: ${charData.peněženka?.svrcky || 0}</span></div>`;
    }

    logoutButton.addEventListener('click', async () => {
        if (unsubscribeMailListener) unsubscribeMailListener();
        if (currentUser) {
            const userDocRef = db.collection('hraci').doc(currentUser.uid);
            await userDocRef.update({ aktivniPostava: firebase.firestore.FieldValue.delete() });
            const statusDocRef = db.collection('status').doc(currentUser.uid);
            await statusDocRef.set({ state: 'offline', last_changed: new Date() });
        }
        sessionStorage.removeItem('selectedCharacterId');
        await auth.signOut();
    });
});