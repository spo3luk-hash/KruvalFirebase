
document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Elementy stránky
    const charList = document.getElementById('char-list');
    const createNewCharBtn = document.getElementById('create-new-char-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const forumLinkBtn = document.getElementById('forum-link-btn');
    const adminButton = document.getElementById('admin-button');

    // Elementy uživatelského panelu
    const userPanel = document.getElementById('user-panel');
    const usernameDisplay = document.getElementById('username-display');
    const userRoleDisplay = document.getElementById('user-role-display');
    const userAvatarDiv = document.getElementById('user-avatar-img');
    const userFrameDiv = document.getElementById('user-frame-img');
    const notificationBadge = document.getElementById('general-notification-badge');

    let currentUserId = null;
    let privateNotificationListener = null;
    let globalNotificationListener = null;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            const userStatusRef = db.collection('status').doc(currentUserId);
            userStatusRef.set({ state: 'online', last_changed: new Date() });

            window.addEventListener('beforeunload', () => {
                userStatusRef.set({ state: 'offline', last_changed: new Date() });
            });

            loadAndDisplayUserData(currentUserId);
            loadCharacters(currentUserId);
            setupNotificationListeners(currentUserId); 

        } else {
            window.location.href = 'index.html';
            if (privateNotificationListener) privateNotificationListener();
            if (globalNotificationListener) globalNotificationListener();
        }
    });

    function loadAndDisplayUserData(userId) {
        const userDocRef = db.collection('hraci').doc(userId);
        userDocRef.onSnapshot(doc => {
            if (doc.exists) {
                const hracData = doc.data();
                if(userPanel) userPanel.style.display = 'flex';
                if(usernameDisplay) usernameDisplay.textContent = hracData.herniNick || 'Uživatel';
                if(userRoleDisplay) userRoleDisplay.textContent = hracData.role || 'Nováček';
                zobrazAvatarHrace(userId, userAvatarDiv, userFrameDiv, hracData.herniNick);
                if (hracData.role === 'Admin') {
                    if(adminButton) adminButton.style.display = 'flex';
                }
            } else {
                console.warn(`Hráč s UID ${userId} nebyl nalezen v kolekci 'hraci'.`);
            }
        }, err => {
            console.error("Chyba při načítání dat hráče: ", err);
        });
    }

    // --- OPRAVENÁ FUNKCIONALITA NOTIFIKACÍ ---
    function setupNotificationListeners(userId) {
        let unreadPrivateCount = 0;
        let unreadGlobalCount = 0;

        const updateBadge = () => {
            const totalUnread = unreadPrivateCount + unreadGlobalCount;
            if (notificationBadge) {
                if (totalUnread > 0) {
                    notificationBadge.textContent = totalUnread;
                    notificationBadge.classList.remove('hidden');
                } else {
                    notificationBadge.classList.add('hidden');
                }
            }
        };

        // Listener pro soukromá upozornění (čte z 'notifications')
        privateNotificationListener = db.collection('notifications').where('hracId', '==', userId)
            .onSnapshot(snapshot => {
                unreadPrivateCount = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    // Kontroluje, jestli pole readBy existuje a neobsahuje ID uživatele
                    return !data.readBy || !data.readBy.includes(userId);
                }).length;
                updateBadge();
            }, error => console.error("Chyba při načítání soukromých upozornění: ", error));

        // Listener pro globální upozornění (čte z 'notifications')
        globalNotificationListener = db.collection('notifications').where('typ', '==', 'globalni')
            .onSnapshot(snapshot => {
                unreadGlobalCount = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    return !data.readBy || !data.readBy.includes(userId);
                }).length;
                updateBadge();
            }, error => console.error("Chyba při načítání globálních upozornění: ", error));
    }

    logoutBtn.addEventListener('click', async () => {
        if (currentUserId) {
            await db.collection('status').doc(currentUserId).set({ state: 'offline', last_changed: new Date() });
        }
        if (privateNotificationListener) privateNotificationListener();
        if (globalNotificationListener) globalNotificationListener();
        auth.signOut();
    });

    createNewCharBtn.addEventListener('click', () => window.location.href = 'vytvorit-postavu.html');
    forumLinkBtn.addEventListener('click', () => window.location.href = 'forum.html');

    function loadCharacters(userId) {
        charList.innerHTML = '<p>Načítám postavy...</p>';
        const postavyRef = db.collection('hraci').doc(userId).collection('postavy').orderBy("datumVytvoreni", "desc");

        postavyRef.onSnapshot((snapshot) => {
            if (snapshot.empty) {
                charList.innerHTML = '<p>Zatím zde nejsou žádné postavy.</p>';
                return;
            }
            charList.innerHTML = '';
            const currentYear = new Date().getFullYear();

            snapshot.forEach(doc => {
                const postava = doc.data();
                const vek = postava.rokNarozeni ? currentYear - postava.rokNarozeni : 'Neznámý';
                const puvodText = {
                    cistokrevny: "Čistokrevný",
                    smiseny: "Smíšený původ",
                    mudlovsky: "Z mudlovské rodiny"
                }[postava.puvod] || "Neznámý původ";

                const kouzelnickaUroven = Math.floor((postava.xpBody || 0) / 100) + 1;

                const charCard = document.createElement('div');
                charCard.classList.add('char-card');
                charCard.setAttribute('data-id', doc.id);

                charCard.innerHTML = `
                    <h3>${postava.jmeno || 'Bezejmenná postava'} [Lvl. ${kouzelnickaUroven}]</h3>
                    <div class="char-details">
                        <p><strong>Věk:</strong> ${vek} let</p>
                        <p><strong>Původ:</strong> ${puvodText}</p>
                        <p><strong>Herní role:</strong> ${postava.herniRole || 'Nováček'}</p>
                        <p><strong>XP body:</strong> ${postava.xpBody || 0}</p>
                        <div class="penize-small">
                            <strong>🪙 Peněženka:</strong>
                            <span>Galeonů - ${postava.peněženka?.galeony || 0}</span>, 
                            <span>Srpců - ${postava.peněženka?.srpce || 0}</span>, 
                            <span>Svrčků - ${postava.peněženka?.svrcky || 0}</span>
                        </div>
                    </div>
                    <div class="char-actions">
                        <button class="play-button">Začít hrát</button>
                        <button class="play-button">Spravovat postavu</button>
                    </div>
                `;
                
                const buttons = charCard.querySelectorAll('.play-button');

                buttons[0].addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const characterId = doc.id;
                    
                    try {
                        const userDocRef = db.collection('hraci').doc(userId);
                        await userDocRef.update({ aktivniPostava: characterId });
                        
                        sessionStorage.setItem('selectedCharacterId', characterId);
                        window.location.href = 'hra.html';

                    } catch (error) {
                        console.error("Chyba při nastavování aktivní postavy: ", error);
                        alert("Nepodařilo se vstoupit do hry. Zkuste to prosím znovu.");
                    }
                });

                buttons[1].addEventListener('click', (e) => {
                    e.stopPropagation();
                    const characterId = doc.id;
                    window.location.href = `postava-upravit.html?id=${characterId}`;
                });

                charList.appendChild(charCard);
            });
        }, (error) => {
            console.error("Chyba při načítání postav: ", error);
            charList.innerHTML = '<p>Došlo k chybě při načítání postav.</p>';
        });
    }
});
