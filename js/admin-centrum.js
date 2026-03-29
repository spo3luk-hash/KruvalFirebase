document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // === ODKAZY NA DOM ELEMENTY ===
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const menuClose = document.getElementById('mobile-menu-close');
    const adminMenu = document.getElementById('admin-menu');
    const headerTitle = document.getElementById('admin-header-title');
    const headerSubtitle = document.getElementById('admin-header-subtitle');
    const playerListContainer = document.getElementById('player-list-container');
    const characterListContainer = document.getElementById('character-list-container');
    
    const newPostForm = document.getElementById('new-post-form');
    const postTitleInput = document.getElementById('post-title');
    const postContentInput = document.getElementById('post-content');
    const postCategoryInput = document.getElementById('post-category');
    const bulletinBoardList = document.getElementById('bulletin-board-list');

    const headerTexts = {
        prehled: { title: 'Přehled Systému', subtitle: 'Centrální správa hráčů a herního světa.' },
        'seznam-postav': { title: 'Seznam Postav', subtitle: 'Kompletní přehled všech postav ve hře.' },
        nastenka: { title: 'Správa Nástěnky', subtitle: 'Tvorba a správa příspěvků zobrazovaných ve hře.' },
        audit: { title: 'Audit Log', subtitle: 'Detailní záznamy o všech důležitých událostech v systému.' },
        opravneni: { title: 'Správa Oprávnění', subtitle: 'Nástroje pro definování a přidělování uživatelských rolí a práv.' }
    };

    let playerStatuses = {};
    let currentAdminNick = 'Admin';

    // === UNIVERZÁLNÍ FUNKCE ===
    const formatTimestamp = (ts) => {
        if (!ts) return 'Neznámo';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleString('cs-CZ');
    };

    auth.onAuthStateChanged(user => {
        if (user) {
            checkAdminStatusAndLoadData(user);
        } else {
            alert('Přístup odepřen. Nejste přihlášeni.');
            window.location.href = 'index.html';
        }
    });

    async function checkAdminStatusAndLoadData(user) {
        try {
            const idTokenResult = await user.getIdTokenResult();
            if (idTokenResult.claims.admin === true) {
                const userDoc = await db.collection('hraci').doc(user.uid).get();
                if (userDoc.exists) {
                    currentAdminNick = userDoc.data().herniNick || 'Admin';
                }
                await loadPlayerStatuses();
                loadAllPlayers();
                loadAllCharacters();
                loadBulletinBoardPosts();
            } else {
                alert('Přístup odepřen. Chybí vám administrátorská oprávnění.');
                window.location.href = 'vyber-postavy.html';
            }
        } catch (error) {
            console.error("Chyba při ověřování administrátora nebo načítání dat: ", error);
            alert('Při ověřování role nebo načítání dat došlo k závažné chybě.');
        }
    }

    window.openConfirmationModal = (title, onConfirm) => {
        const modalHtml = `
            <div id="confirmation-modal-overlay" class="modal-overlay visible">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="modal-body confirmation-body">
                        <p>Tato akce je nevratná. Jste si jisti?</p>
                    </div>
                    <div class="modal-footer confirmation-footer">
                        <button id="confirm-btn" class="submit-btn danger">Potvrdit</button>
                        <button id="cancel-btn" class="submit-btn">Zrušit</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const overlay = document.getElementById('confirmation-modal-overlay');
        const confirmBtn = document.getElementById('confirm-btn');
        const cancelBtn = document.getElementById('cancel-btn');
        const closeModal = () => overlay.remove();
        confirmBtn.onclick = () => { onConfirm(); closeModal(); };
        cancelBtn.onclick = closeModal;
        overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
    };

    if (menuToggle) menuToggle.addEventListener('click', () => adminMenu.classList.add('open'));
    if (menuClose) menuClose.addEventListener('click', () => adminMenu.classList.remove('open'));

    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.toggle('active', section.id === targetId);
            });
            if (headerTexts[targetId]) {
                headerTitle.textContent = headerTexts[targetId].title;
                headerSubtitle.textContent = headerTexts[targetId].subtitle;
            }
            if (window.innerWidth <= 992) adminMenu.classList.remove('open');
        });
    });

    if (newPostForm) {
        newPostForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = postTitleInput.value.trim();
            const content = postContentInput.value.trim();
            const category = postCategoryInput.value;
            if (!title || !content) {
                alert('Titulek a obsah nesmí být prázdné.');
                return;
            }
            try {
                await db.collection('nastenka').add({
                    title: title,
                    content: content,
                    category: category,
                    author: currentAdminNick,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                newPostForm.reset();
                alert('Příspěvek byl úspěšně přidán.');
                loadBulletinBoardPosts();
            } catch (error) {
                console.error("Chyba při přidávání příspěvku: ", error);
                alert('Při ukládání příspěvku došlo k chybě.');
            }
        });
    }

    async function loadBulletinBoardPosts() {
        if (!bulletinBoardList) return;
        try {
            const snapshot = await db.collection('nastenka').orderBy('createdAt', 'desc').get();
            bulletinBoardList.innerHTML = snapshot.empty 
                ? '<div class="placeholder-content"><p>Zatím nebyly vytvořeny žádné příspěvky.</p></div>' 
                : renderBulletinBoardList(snapshot.docs);
            setupDeleteButtons();
        } catch (error) {
            console.error("Chyba při načítání příspěvků z nástěnky: ", error);
            bulletinBoardList.innerHTML = '<p>Chyba při načítání příspěvků.</p>';
        }
    }

    function renderBulletinBoardList(posts) {
        return posts.map(doc => {
            const post = doc.data();
            const categoryText = post.category === 'novinky' ? 'Seznam novinek (RP)' : 'Non-RP Informace';
            return `
                <div class="post-item-admin">
                    <h4>${post.title}</h4>
                    <p>${post.content.substring(0, 150)}...</p>
                    <div class="post-meta-admin">
                         <div class="meta-info">
                            <span class="category ${post.category}">${categoryText}</span>
                            <span>Autor: <strong>${post.author}</strong></span>
                            <span>Vytvořeno: ${formatTimestamp(post.createdAt)}</span>
                        </div>
                        <button class="delete-btn" data-id="${doc.id}">Smazat</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    function setupDeleteButtons() {
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const docId = e.target.getAttribute('data-id');
                window.openConfirmationModal('Smazat příspěvek?', async () => {
                    try {
                        await db.collection('nastenka').doc(docId).delete();
                        alert('Příspěvek smazán.');
                        loadBulletinBoardPosts();
                    } catch (error) {
                        console.error("Chyba při mazání příspěvku: ", error);
                        alert('Při mazání došlo k chybě.');
                    }
                });
            });
        });
    }

    async function loadPlayerStatuses() {
        try {
            const snapshot = await db.collection('status').get();
            snapshot.forEach(doc => { playerStatuses[doc.id] = doc.data().state; });
        } catch (error) {
            console.error("Chyba při načítání statusů hráčů: ", error);
        }
    }

    function getStatusInfo(playerId) {
        const state = playerStatuses[playerId] || 'offline';
        switch (state) {
            case 'online': return { className: 'status-online', title: 'Online' };
            case 'away': return { className: 'status-away', title: 'Neaktivní' };
            default: return { className: 'status-offline', title: 'Offline' };
        }
    }
    
    function createAvatarHtml(item, sizeClass) {
        const avatarUrl = item.avatarUrl || '';
        const frameId = item.avatarFrame || 'frame-default';
        const nick = item.herniNick || '–';
        const initial = (nick.charAt(0) || '?').toUpperCase();
        return `
            <div class="avatar-container ${sizeClass}" data-frame-id="${frameId}">
                <div class="avatar-image" style="background-image: ${avatarUrl ? `url('${avatarUrl}')` : 'none'};">
                    ${!avatarUrl ? `<span>${initial}</span>` : ''}
                </div>
                <div class="avatar-frame-container"></div>
            </div>
        `;
    }

    async function loadAllPlayers() {
        try {
            const playersSnapshot = await db.collection('hraci').orderBy('herniNick').get();
            const playerPromises = playersSnapshot.docs.map(async (playerDoc) => {
                const playerData = playerDoc.data();
                const playerId = playerDoc.id;
                const postavySnapshot = await db.collection('hraci').doc(playerId).collection('postavy').get();
                const pocetPostav = postavySnapshot.size;
                let aktivniPostavaJmeno = '–';
                const aktivniPostavaId = playerData.aktivniPostava;
                if (aktivniPostavaId) {
                    const postavaDoc = await db.collection('hraci').doc(playerId).collection('postavy').doc(aktivniPostavaId).get();
                    if (postavaDoc.exists) {
                        aktivniPostavaJmeno = postavaDoc.data().jmeno || '–';
                    }
                }
                return { id: playerId, ...playerData, pocetPostav: pocetPostav, aktivniPostavaJmeno: aktivniPostavaJmeno };
            });
            const playersWithDetails = await Promise.all(playerPromises);
            renderPlayerTable(playersWithDetails);
        } catch (error) {
            console.error("Chyba při načítání hráčů: ", error);
            playerListContainer.innerHTML = '<p class="error-text">Chyba při načítání hráčů a jejich postav.</p>';
        }
    }

    function renderPlayerTable(players) {
        const tableRows = players.map(player => {
            const status = getStatusInfo(player.id);
            const registrationTimestamp = player.datumRegistrace || player.datumVytvoreni;
            let isDisabled = player.disabled;
            if (isDisabled && player.banExpires && player.banExpires.toDate() < new Date()) {
                isDisabled = false; 
                db.collection('hraci').doc(player.id).update({ disabled: false, banExpires: null });
            }
            return `
            <tr data-player-id="${player.id}" data-player-name="${player.herniNick || ''}">
                <td class="text-center"><i class="fas fa-circle status-icon ${status.className}" title="${status.title}"></i></td>
                <td class="avatar-cell">${createAvatarHtml(player, 'in-table')}</td>
                <td>${player.herniNick || '–'}</td>
                <td>${player.email || '–'}</td>
                <td>${formatTimestamp(registrationTimestamp)}</td>
                <td>${player.pocetPostav !== undefined ? player.pocetPostav : '0'}</td>
                <td>${player.aktivniPostavaJmeno || '–'}</td>
                <td>${formatTimestamp(player.posledniAktivita)}</td>
                <td class="text-center"><i class="fas fa-circle status-icon ${isDisabled ? 'status-danger' : 'status-ok'}" title="${isDisabled ? 'Zablokován' : 'V pořádku'}"></i></td>
                <td class="text-center action-icons">
                    <i class="fas fa-balance-scale punishment-icon" title="Správa trestů"></i>
                </td>
            </tr>
        `}).join('');
        playerListContainer.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th class="text-center">Stav</th><th>Avatar</th><th>Herní Nick</th><th>Email</th><th>Datum Registrace</th>
                        <th>Počet postav</th><th>Aktivní postava</th><th>Poslední Aktivita</th><th class="text-center">Stav účtu</th><th class="text-center">Akce</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;
        window.renderAvatarFrames();
        document.querySelectorAll('.punishment-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const playerId = row.getAttribute('data-player-id');
                const playerName = row.getAttribute('data-player-name');
                handlePunishmentClick(playerId, playerName);
            });
        });
    }

    function handlePunishmentClick(playerId, playerName) {
        const modalHtml = `
            <div id="punishment-modal-overlay" class="modal-overlay visible">
                <div class="modal-content" id="punishment-modal-content">
                    <div class="modal-header">
                        <h3>Správa trestů pro: ${playerName}</h3>
                        <button id="punishment-modal-close" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body" id="punishment-modal-body">
                        <p>Načítání existujících trestů...</p>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const overlay = document.getElementById('punishment-modal-overlay');
        const closeBtn = document.getElementById('punishment-modal-close');

        const closeModal = () => overlay.remove();
        closeBtn.onclick = closeModal;
        overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

        loadPunishmentsForPlayer(playerId, playerName);
    }

    async function loadPunishmentsForPlayer(playerId, playerName) {
        const modalBody = document.getElementById('punishment-modal-body');
        try {
            const playerDoc = await db.collection('hraci').doc(playerId).get();
            const playerData = playerDoc.data();
            const isDisabled = playerData.disabled === true;

            const punishmentsSnapshot = await db.collection('hraci').doc(playerId).collection('tresty').orderBy('datumUdeleni', 'desc').get();
            const punishments = punishmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            renderPunishments(modalBody, punishments, playerId, playerName, isDisabled);
        } catch (error) {
            console.error(`Chyba při načítání trestů pro hráče ${playerName}:`, error);
            modalBody.innerHTML = '<p class="error-text">Nepodařilo se načíst tresty.</p>';
        }
    }

    function renderPunishments(container, punishments, playerId, playerName, isDisabled) {
        const accountStatusHtml = isDisabled ? `
            <div class="account-status-banner">
                <p>Tento hráč má zablokovaný účet!</p>
                <button id="unban-player-btn" class="submit-btn danger">Odblokovat účet</button>
            </div>
        ` : '';

        const punishmentsHtml = punishments.length > 0 ? punishments.map(p => {
            const now = new Date();
            const expirationDate = p.trvaniDo ? p.trvaniDo.toDate() : null;
            const isPermanent = !expirationDate;
            const isActive = p.typ === 'ban' && (isPermanent || expirationDate > now) && !p.zrusil;

            let statusText = 'Vypršel';
            let statusClass = 'expired-punishment';

            if (p.zrusil) {
                statusText = `Zrušeno`;
                statusClass = 'revoked-punishment';
            } else if (isActive) {
                statusText = 'Aktivní';
                statusClass = 'active-punishment';
            }
            
            const revokedInfo = p.zrusil ? `<p><strong>Zrušil:</strong> ${p.zrusil.admin} (${formatTimestamp(p.zrusil.datum)})</p>` : '';

            return `
                <div class="punishment-card ${statusClass}">
                    <div class="punishment-card-header">
                        <h4>${p.typ === 'ban' ? 'Ban' : 'Varování'}</h4>
                        <span class="punishment-status">${statusText}</span>
                    </div>
                    <div class="punishment-card-body">
                        <p><strong>Důvod:</strong> ${p.duvod}</p>
                        <p><strong>Uděleno adminem:</strong> ${p.udelil}</p>
                        <p><strong>Datum udělení:</strong> ${formatTimestamp(p.datumUdeleni)}</p>
                        <p><strong>Platnost do:</strong> ${expirationDate ? formatTimestamp(expirationDate) : 'Trvalý'}</p>
                        ${revokedInfo}
                    </div>
                    ${isActive ? `
                    <div class="punishment-card-footer">
                        <button class="revoke-btn small-btn" data-punishment-id="${p.id}" data-punishment-type="${p.typ}">Zrušit trest</button>
                    </div>` : ''}
                </div>
            `;
        }).join('') : '<div class="placeholder-content"><p>Tento hráč nemá žádné záznamy o trestech.</p></div>';

        container.innerHTML = `
            ${accountStatusHtml}
            <div class="punishments-list">${punishmentsHtml}</div>
            <div class="new-punishment-form">
                <h4>Nový trest</h4>
                <select id="punishment-type">
                    <option value="warning">Varování</option>
                    <option value="ban">Ban</option>
                </select>
                <input type="text" id="punishment-reason" placeholder="Důvod trestu">
                <input type="datetime-local" id="punishment-duration" title="Nechte prázdné pro trvalý trest">
                <button id="add-punishment-btn" class="submit-btn">Udělit trest</button>
            </div>
        `;

        // Event Listeners
        document.getElementById('add-punishment-btn')?.addEventListener('click', () => addPunishment(playerId, playerName));
        
        document.querySelectorAll('.revoke-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const punishmentId = e.target.getAttribute('data-punishment-id');
                revokeSinglePunishment(playerId, playerName, punishmentId);
            });
        });

        if (isDisabled) {
            document.getElementById('unban-player-btn')?.addEventListener('click', () => unbanPlayer(playerId, playerName));
        }
    }

    async function addPunishment(playerId, playerName) {
        const type = document.getElementById('punishment-type').value;
        const reason = document.getElementById('punishment-reason').value.trim();
        const duration = document.getElementById('punishment-duration').value;

        if (!reason) {
            alert('Musíte uvést důvod trestu.');
            return;
        }

        let expiration = null;
        if (duration) {
            expiration = firebase.firestore.Timestamp.fromDate(new Date(duration));
        }

        try {
            const punishmentData = {
                typ: type,
                duvod: reason,
                trvaniDo: expiration,
                datumUdeleni: firebase.firestore.FieldValue.serverTimestamp(),
                udelil: currentAdminNick,
                zrusil: null
            };
            await db.collection('hraci').doc(playerId).collection('tresty').add(punishmentData);

            if (type === 'ban') {
                await db.collection('hraci').doc(playerId).update({ disabled: true, banExpires: expiration });
            }

            alert('Trest byl úspěšně udělen.');
            loadPunishmentsForPlayer(playerId, playerName);
            loadAllPlayers();
        } catch (error) {
            console.error("Chyba při udělování trestu: ", error);
            alert('Při udělování trestu došlo k chybě.');
        }
    }

    function revokeSinglePunishment(playerId, playerName, punishmentId) {
        window.openConfirmationModal('Zrušit tento trest?', async () => {
            try {
                const punishmentRef = db.collection('hraci').doc(playerId).collection('tresty').doc(punishmentId);
                await punishmentRef.update({
                    zrusil: {
                        admin: currentAdminNick,
                        datum: firebase.firestore.FieldValue.serverTimestamp()
                    }
                });

                alert('Trest byl zrušen. Poznámka: Pokud je účet stále zablokován kvůli jinému banu, použijte tlačítko "Odblokovat účet".');
                loadPunishmentsForPlayer(playerId, playerName);
                // Zda se má odblokovat i hráč, je komplexnější otázka, řeší to primárně tlačítko "Odblokovat"
            } catch (error) {
                console.error("Chyba při rušení trestu: ", error);
                alert('Při rušení trestu došlo k chybě.');
            }
        });
    }
    
    function unbanPlayer(playerId, playerName) {
        window.openConfirmationModal('Odblokovat účet hráče?', async () => {
            const playerRef = db.collection('hraci').doc(playerId);
            const punishmentsRef = playerRef.collection('tresty');

            try {
                const batch = db.batch();

                // Zrušit všechny aktivní bany
                const activeBansSnapshot = await punishmentsRef
                    .where('typ', '==', 'ban')
                    .where('zrusil', '==', null)
                    .get();

                activeBansSnapshot.forEach(doc => {
                    const punishment = doc.data();
                    const expirationDate = punishment.trvaniDo ? punishment.trvaniDo.toDate() : null;
                    const isPermanent = !expirationDate;
                    if (isPermanent || expirationDate > new Date()) {
                         batch.update(doc.ref, {
                            zrusil: {
                                admin: currentAdminNick,
                                datum: firebase.firestore.FieldValue.serverTimestamp()
                            }
                        });
                    }
                });
                
                // Odblokovat hráče
                batch.update(playerRef, {
                    disabled: false,
                    banExpires: null
                });

                await batch.commit();

                alert(`Účet hráče ${playerName} byl úspěšně odblokován a všechny aktivní bany byly zrušeny.`);
                
                // Obnovit zobrazení
                loadPunishmentsForPlayer(playerId, playerName);
                loadAllPlayers();

            } catch (error) {
                console.error(`Chyba při odblokování hráče ${playerName}:`, error);
                alert('Při odblokování účtu došlo k závažné chybě.');
            }
        });
    }

    async function loadAllCharacters() {
        try {
            characterListContainer.innerHTML = '<div class="loading-spinner"></div>';
            const allCharacters = [];
            const playersSnapshot = await db.collection('hraci').get();

            for (const playerDoc of playersSnapshot.docs) {
                const charactersSnapshot = await playerDoc.ref.collection('postavy').get();
                charactersSnapshot.forEach(charDoc => {
                    allCharacters.push({ 
                        id: charDoc.id, 
                        ownerNick: playerDoc.data().herniNick || 'Neznámý',
                        ...charDoc.data() 
                    });
                });
            }
            renderCharacterTable(allCharacters);
        } catch (error) {
            console.error("Chyba při novém způsobu načítání postav: ", error);
            characterListContainer.innerHTML = '<p class="error-text">Chyba při načítání postav. Zkuste obnovit stránku.</p>';
        }
    }
    
    function renderCharacterTable(characters) {
        const tableRows = characters.sort((a, b) => a.jmeno.localeCompare(b.jmeno)).map(char => {
            return `
            <tr>
                <td>${char.jmeno || '–'}</td>
                <td>${char.ownerNick || '–'}</td>
                <td>${char.herniRole || 'Nováček'}</td>
                <td>${char.kolej || 'Neurčeno'}</td>
                <td>${char.xpBody || 0}</td>
            </tr>
        `}).join('');

        characterListContainer.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Jméno Postavy</th>
                        <th>Vlastník</th>
                        <th>Herní Role</th>
                        <th>Kolej</th>
                        <th>XP Body</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;
    }
});
