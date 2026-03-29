document.addEventListener('DOMContentLoaded', () => {
    // --- Elementy ---
    const navRunes = document.querySelectorAll('.nav-rune');
    const wings = document.querySelectorAll('.observatory-wing');
    const astralOverlay = document.getElementById('astral-overlay');
    const astralTitle = document.getElementById('astral-title');
    const astralContent = document.getElementById('astral-content');
    const astralActions = document.getElementById('astral-actions');
    const userProfileWidget = document.querySelector('.user-profile-widget');
    const userNameSpan = document.getElementById('forum-user-name');

    // --- Firebase & Stav ---
    const db = firebase.firestore();
    const auth = firebase.auth();
    let currentUserIsAdmin = false;
    let unsubscribeDecrees = null;
    let unsubscribeSpecialDecrees = null;

    // --- Utility funkce ---
    function formatFirestoreTimestamp(timestamp) {
        if (!timestamp || !timestamp.toDate) {
            return 'Neznámé datum';
        }
        const date = timestamp.toDate();
        return `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()}`;
    }

    // --- Systém Astrálních Oken ---
    function hideAstralWindow() {
        if (astralOverlay) astralOverlay.style.display = 'none';
    }

    function showAstralWindow({ title, content, buttons = [] }) {
        if (!astralOverlay || !astralTitle || !astralContent || !astralActions) return;

        astralTitle.textContent = title;
        astralContent.innerHTML = content;
        astralActions.innerHTML = '';

        if (buttons.length === 0) {
            buttons.push({ text: 'Zavřít', className: 'confirm', action: hideAstralWindow });
        }

        buttons.forEach(btnConfig => {
            const button = document.createElement('button');
            button.textContent = btnConfig.text;
            button.className = `astral-button ${btnConfig.className || ''}`;
            button.onclick = () => {
                if (btnConfig.action) {
                    btnConfig.action();
                } else {
                    hideAstralWindow();
                }
            };
            astralActions.appendChild(button);
        });

        astralOverlay.style.display = 'flex';
    }

    if (astralOverlay) {
        astralOverlay.addEventListener('click', (e) => {
            if (e.target === astralOverlay) hideAstralWindow();
        });
    }

    // --- Navigace ---
    navRunes.forEach(rune => {
        rune.addEventListener('click', (e) => {
            e.preventDefault();
            navRunes.forEach(r => r.classList.remove('active'));
            wings.forEach(w => w.classList.remove('active'));
            const targetWing = document.getElementById(rune.dataset.target);
            rune.classList.add('active');
            if (targetWing) targetWing.classList.add('active');
        });
    });

    // --- Speciální Dekrety (Novinky a Aktualizace) ---
    function loadSpecialDecrees(isAdmin) {
        const wall = document.getElementById('special-decree-wall');
        if (!wall) return;
        if (unsubscribeSpecialDecrees) unsubscribeSpecialDecrees();

        unsubscribeSpecialDecrees = db.collection("special_decrees").orderBy("timestamp", "desc")
            .onSnapshot((querySnapshot) => {
                wall.innerHTML = '';
                querySnapshot.forEach(doc => {
                    wall.appendChild(createSpecialDecreeStone(doc, isAdmin));
                });
                if (isAdmin) addSpecialDeleteListeners();
            }, (error) => {
                console.error("Chyba při načítání speciálních runových kamenů: ", error);
                wall.innerHTML = `<p class="placeholder-text">Při čtení speciálních run došlo k chybě: ${error.message}</p>`;
            });
    }

    function createSpecialDecreeStone(doc, isAdmin) {
        const data = doc.data();
        const element = document.createElement('article');
        element.classList.add('decree-stone', 'special-decree-stone');
        element.dataset.id = doc.id;

        const formattedDate = formatFirestoreTimestamp(data.timestamp);

        const adminControls = isAdmin ? `<button class="delete-decree-btn delete-special-decree-btn" data-id="${doc.id}" title="Rozbít speciální runový kámen">×</button>` : '';

        element.innerHTML = `
            <header class="decree-header">
                <h3>${data.title}</h3>
                <div class="header-controls">
                    <span class="decree-category decree-category-special">${data.category}</span>
                    ${adminControls}
                </div>
            </header>
            <div class="decree-meta"><span><span class="meta-author">${data.author}</span> | ${formattedDate}</span></div>
            <div class="decree-content"><p>${data.content.replace(/\n/g, '</p><p>')}</p></div>
            <div class="updates-wall"></div>
            <footer class="special-decree-footer"></footer>
        `;

        renderUpdates(element.querySelector('.updates-wall'), doc.id, data.updates || [], isAdmin);

        if (isAdmin && data.category === 'Novinky a aktualizace') {
            const footer = element.querySelector('.special-decree-footer');
            const addNewsBtn = document.createElement('button');
            addNewsBtn.textContent = 'Založit Novinku';
            addNewsBtn.className = 'archon-button';
            addNewsBtn.onclick = () => showCreateNewsForm(doc.id);
            footer.appendChild(addNewsBtn);
        }

        return element;
    }
    
    function addSpecialDeleteListeners() {
      document.querySelectorAll('.delete-special-decree-btn').forEach(button => {
          button.removeEventListener('click', handleSpecialDeleteClick);
          button.addEventListener('click', handleSpecialDeleteClick);
      });
    }

    function handleSpecialDeleteClick(e) {
        const docId = e.target.dataset.id;
        showAstralWindow({
            title: 'Rozbít Speciální Runový Kámen?',
            content: '<p>Tato akce je nevratná a smaže veškeré navázané novinky. Opravdu si přeješ tento dekret navždy odstranit?</p>',
            buttons: [
                { text: 'Zrušit', className: 'cancel', action: hideAstralWindow },
                { 
                    text: 'Rozbít', 
                    className: 'danger', 
                    action: () => {
                        db.collection('special_decrees').doc(docId).delete()
                          .then(() => hideAstralWindow())
                          .catch(err => {
                                console.error("Chyba: ", err);
                                showAstralWindow({ title: 'Chyba', content: `<p>Při rozbíjení runy došlo k chybě: ${err.message}</p>` });
                           });
                    }
                }
            ]
        });
    }

    // --- Systém Živých Novinek ---
    function renderUpdates(wall, decreeId, updates, isAdmin) {
        wall.innerHTML = '';
        updates.sort((a, b) => {
            const statusOrder = { 'visible': 1, 'active': 2, 'retired': 3, 'invisible': 4 };
            return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        });

        updates.forEach(update => {
            if (!isAdmin && (update.status === 'invisible' || update.status === 'retired')) return;

            const updateElement = document.createElement('div');
            updateElement.classList.add('news-update');
            if(isAdmin) updateElement.classList.add(`status-${update.status}`);

            const isNew = !update.updateLog || update.updateLog.length === 0;
            const tagClass = isNew ? 'news-tag-new' : 'news-tag-updated';
            const tagText = isNew ? 'Novinka' : 'Aktualizováno';

            let adminControls = '';
            if (isAdmin) {
                 adminControls += `<div class="news-admin-icons">
                                    <span class="news-admin-icon update-news-btn" data-update-id="${update.id}" title="Aktualizovat novinku">&#x270E;</span>
                                    <span class="news-admin-icon close-news-btn" data-update-id="${update.id}" title="Uzavřít novinku">&#x1F5D9;</span>
                                </div>`;
                if (update.status === 'invisible') {
                    adminControls = `<button class="news-control-btn start-news" data-update-id="${update.id}">Spustit novinku</button>` + adminControls;
                }
            }

            const updateLogHtml = (update.updateLog && update.updateLog.length > 0) ?
                `<div class="update-log">
                    ${update.updateLog.map(log => `<div class="update-log-entry">- ${log}</div>`).join('')}
                </div>` : '';

            updateElement.innerHTML = `
                <div class="news-header">
                    <h4>${update.title}</h4>
                    <div class="news-controls">${adminControls}</div>
                </div>
                <p>${update.description}</p>
                <div class="news-meta-info">
                    <span class="news-tag ${tagClass}">${tagText}</span>
                    <span class="news-last-update">${formatFirestoreTimestamp(update.lastUpdatedAt)}</span>
                </div>
                ${updateLogHtml}
            `;
            wall.appendChild(updateElement);
        });

        if (isAdmin) {
             wall.querySelectorAll('.start-news').forEach(btn => {
                btn.onclick = (e) => updateNewsStatus(decreeId, e.target.dataset.updateId, 'visible');
            });
            wall.querySelectorAll('.update-news-btn').forEach(btn => {
                btn.onclick = (e) => showUpdateNewsForm(decreeId, e.target.dataset.updateId);
            });
            wall.querySelectorAll('.close-news-btn').forEach(btn => {
                btn.onclick = (e) => updateNewsStatus(decreeId, e.target.dataset.updateId, 'retired');
            });
        }
    }
    
    function showCreateNewsForm(decreeId) {
        const content = `
            <form id="new-news-form" class="astral-form">
                <input type="text" id="news-title" placeholder="Název novinky" required>
                <textarea id="news-description" placeholder="Popis novinky..." rows="5" required></textarea>
            </form>
        `;

        showAstralWindow({
            title: 'Vytvořit Novou Novinku',
            content: content,
            buttons: [
                { text: 'Zrušit', className: 'cancel', action: hideAstralWindow },
                {
                    text: 'Vytvořit Novinku',
                    className: 'confirm',
                    action: () => {
                        const title = document.getElementById('news-title').value;
                        const description = document.getElementById('news-description').value;
                        if (!title || !description) {
                           showAstralWindow({ title: 'Chyba', content: '<p>Název i popis novinky musí být vyplněn.</p>'});
                           return;
                        }

                        const now = new Date();
                        const newUpdate = {
                            id: now.getTime().toString(),
                            title,
                            description,
                            status: 'invisible',
                            createdAt: firebase.firestore.Timestamp.fromDate(now),
                            lastUpdatedAt: firebase.firestore.Timestamp.fromDate(now),
                            updateLog: []
                        };

                        const decreeRef = db.collection('special_decrees').doc(decreeId);
                        
                        decreeRef.update({
                            updates: firebase.firestore.FieldValue.arrayUnion(newUpdate)
                        }).then(() => {
                            hideAstralWindow();
                        }).catch(error => {
                            console.error("Chyba při přidávání novinky: ", error);
                            showAstralWindow({ title: 'Chyba', content: `<p>Nepodařilo se uložit novinku: ${error.message}</p>` });
                        });
                    }
                }
            ]
        });
    }

    function showUpdateNewsForm(decreeId, updateId) {
        const content = `
            <form id="update-news-form" class="astral-form">
                <textarea id="news-update-text" placeholder="Zadejte text aktualizace..." rows="4" required></textarea>
            </form>
        `;

        showAstralWindow({
            title: 'Aktualizovat Novinku',
            content: content,
            buttons: [
                { text: 'Zrušit', className: 'cancel', action: hideAstralWindow },
                {
                    text: 'Aktualizovat',
                    className: 'confirm',
                    action: () => {
                        const updateText = document.getElementById('news-update-text').value;
                        if (!updateText) {
                            showAstralWindow({ title: 'Chyba', content: '<p>Text aktualizace nesmí být prázdný.</p>'});
                            return;
                        }
                        updateNewsLog(decreeId, updateId, updateText);
                    }
                }
            ]
        });
    }

    async function updateNewsStatus(decreeId, updateId, newStatus) {
        const decreeRef = db.collection('special_decrees').doc(decreeId);
        try {
            const doc = await decreeRef.get();
            if (!doc.exists) throw new Error("Dekret nenalezen.");

            let updates = doc.data().updates || [];
            const updateIndex = updates.findIndex(u => u.id === updateId);

            if (updateIndex > -1) {
                updates[updateIndex].status = newStatus;
                updates[updateIndex].lastUpdatedAt = firebase.firestore.Timestamp.now(); // O opraveno

                await decreeRef.update({ updates });
            } else {
                throw new Error("Novinka nenalezena v poli.");
            }
        } catch (error) {
            console.error("Chyba při aktualizaci stavu novinky: ", error);
            showAstralWindow({ title: 'Chyba', content: `<p>Nepodařilo se aktualizovat stav novinky: ${error.message}</p>` });
        }
    }

    async function updateNewsLog(decreeId, updateId, updateText) {
        const decreeRef = db.collection('special_decrees').doc(decreeId);
        try {
            const doc = await decreeRef.get();
            if (!doc.exists) throw new Error("Dekret nenalezen.");

            let updates = doc.data().updates || [];
            const updateIndex = updates.findIndex(u => u.id === updateId);

            if (updateIndex > -1) {
                const now = firebase.firestore.Timestamp.now();
                const updateLogEntry = `${formatFirestoreTimestamp(now)}: ${updateText}`;
                
                if (!updates[updateIndex].updateLog) {
                    updates[updateIndex].updateLog = [];
                }
                updates[updateIndex].updateLog.push(updateLogEntry);
                updates[updateIndex].lastUpdatedAt = now; // O opraveno
                
                await decreeRef.update({ updates });
                hideAstralWindow();
            } else {
                throw new Error("Novinka nenalezena v poli pro aktualizaci logu.");
            }
        } catch (error) {
            console.error("Chyba při přidávání záznamu do logu: ", error);
            showAstralWindow({ title: 'Chyba', content: `<p>Nepodařilo se uložit záznam o aktualizaci: ${error.message}</p>` });
        }
    }

    // --- Běžné Dekrety ---
    function loadDecrees(isAdmin) {
        const wall = document.getElementById('regular-decree-wall');
        if (!wall) return;
        if (unsubscribeDecrees) unsubscribeDecrees();

        unsubscribeDecrees = db.collection("observatory_decrees").orderBy("timestamp", "desc")
            .onSnapshot((querySnapshot) => {
                wall.innerHTML = querySnapshot.empty ? '<p class="placeholder-text">Žádné dekrety nebyly vytesány.</p>' : '';
                querySnapshot.forEach(doc => wall.appendChild(createDecreeStone(doc, isAdmin)));
                if (isAdmin) addDeleteListeners();
            }, (error) => {
                console.error("Chyba při načítání runových kamenů: ", error);
                wall.innerHTML = `<p class="placeholder-text">Při čtení run došlo k chybě: ${error.message}</p>`;
            });
    }

    function createDecreeStone(doc, isAdmin) {
        const data = doc.data();
        const element = document.createElement('article');
        element.classList.add('decree-stone');

        const formattedDate = formatFirestoreTimestamp(data.timestamp);
        
        const adminControls = isAdmin ? `<button class="delete-decree-btn" data-id="${doc.id}" title="Rozbít runový kámen">×</button>` : '';

        element.innerHTML = `
            <header class="decree-header">
                <h3>${data.title}</h3>
                <div class="header-controls">
                    <span class="decree-category decree-category-${data.category.toLowerCase()}">${data.category}</span>
                    ${adminControls}
                </div>
            </header>
            <div class="decree-meta"><span><span class="meta-author">${data.author}</span> | ${formattedDate}</span></div>
            <div class="decree-content"><p>${data.content.replace(/\n/g, '</p><p>')}</p></div>
        `;
        return element;
    }

    function addDeleteListeners() {
      document.querySelectorAll('.delete-decree-btn:not(.delete-special-decree-btn)').forEach(button => {
          button.removeEventListener('click', handleDeleteClick);
          button.addEventListener('click', handleDeleteClick);
      });
    }

    function handleDeleteClick(e) {
        const docId = e.target.dataset.id;
        showAstralWindow({
            title: 'Rozbít Runový Kámen?',
            content: '<p>Tato akce je nevratná. Opravdu si přeješ tento dekret navždy odstranit z existence?</p>',
            buttons: [
                { text: 'Zrušit', className: 'cancel', action: hideAstralWindow },
                { 
                    text: 'Rozbít', 
                    className: 'danger', 
                    action: () => {
                        db.collection('observatory_decrees').doc(docId).delete()
                          .then(() => hideAstralWindow())
                          .catch(err => {
                              console.error("Chyba: ", err);
                              showAstralWindow({ title: 'Chyba', content: `<p>Při rozbíjení runy došlo k chybě: ${err.message}</p>` });
                          });
                    }
                }
            ]
        });
    }

    // --- Nástroje Archonů ---
    function setupArchonTools(user, userDoc) {
        const archonToolsContainer = document.getElementById('archon-tools');
        if (!archonToolsContainer) return;
        archonToolsContainer.style.display = 'block';

        const showFormBtn = document.getElementById('show-decree-form-btn');
        const formContainer = document.getElementById('new-decree-form-container');
        const decreeForm = document.getElementById('new-decree-form');
        const cancelBtn = document.getElementById('cancel-decree-btn');

        const showSpecialFormBtn = document.getElementById('show-special-decree-form-btn');
        showSpecialFormBtn.classList.add('special-decree');
        const specialFormContainer = document.getElementById('new-special-decree-form-container');
        const specialDecreeForm = document.getElementById('new-special-decree-form');
        const cancelSpecialBtn = document.getElementById('cancel-special-decree-btn');

        const archonButtons = [showFormBtn, showSpecialFormBtn];

        showFormBtn.onclick = () => { formContainer.style.display = 'block'; archonButtons.forEach(b => b.style.display = 'none'); };
        cancelBtn.onclick = () => { formContainer.style.display = 'none'; archonButtons.forEach(b => b.style.display = 'inline-block'); decreeForm.reset(); };

        showSpecialFormBtn.onclick = () => { specialFormContainer.style.display = 'block'; archonButtons.forEach(b => b.style.display = 'none'); };
        cancelSpecialBtn.onclick = () => { specialFormContainer.style.display = 'none'; archonButtons.forEach(b => b.style.display = 'inline-block'); specialDecreeForm.reset(); };

        decreeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await db.collection('observatory_decrees').add({
                title: document.getElementById('decree-title').value,
                category: document.getElementById('decree-category').value,
                content: document.getElementById('decree-content').value,
                author: userDoc.data().herniNick || user.email,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(error => {
                console.error("Chyba při vytesávání dekretu: ", error);
                showAstralWindow({ title: 'Chyba', content: `<p>Při vytesávání runy došlo k chybě: ${error.message}</p>` });
            });
            cancelBtn.onclick();
        });

        specialDecreeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const category = document.getElementById('special-decree-category').value;
            const specialDecreeData = {
                title: document.getElementById('special-decree-title').value,
                category: category,
                content: document.getElementById('special-decree-content').value,
                author: userDoc.data().herniNick || user.email,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                updates: [],
                status: 'active'
            };

            await db.collection('special_decrees').add(specialDecreeData).catch(error => {
                console.error("Chyba při vytesávání speciálního dekretu: ", error);
                showAstralWindow({ title: 'Chyba', content: `<p>Při vytesávání speciální runy došlo k chybě: ${error.message}</p>` });
            });
            cancelSpecialBtn.onclick();
        });
    }

    // --- Hlavní Spouštěcí Logika ---
    auth.onAuthStateChanged(async (user) => {
        const archonToolsContainer = document.getElementById('archon-tools');
        
        if (user) {
            try {
                const userDoc = await db.collection('hraci').doc(user.uid).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    currentUserIsAdmin = userData.role === 'admin';
                    
                    if (userNameSpan) {
                        userNameSpan.textContent = userData.herniNick || user.email;
                    }
                    if (userProfileWidget) {
                        userProfileWidget.style.display = 'flex';
                    }

                    if (currentUserIsAdmin) {
                        if (archonToolsContainer) archonToolsContainer.style.display = 'block';
                        setupArchonTools(user, userDoc);
                    } else {
                        if (archonToolsContainer) archonToolsContainer.style.display = 'none';
                    }
                } else {
                    currentUserIsAdmin = false;
                    if (userNameSpan) userNameSpan.textContent = user.email;
                    if (userProfileWidget) userProfileWidget.style.display = 'flex';
                    if (archonToolsContainer) archonToolsContainer.style.display = 'none';
                }
            } catch (error) {
                console.error("Nepodařilo se načíst data uživatele:", error);
                currentUserIsAdmin = false;
                if (userProfileWidget) userProfileWidget.style.display = 'none';
                if (archonToolsContainer) archonToolsContainer.style.display = 'none';
            }
        } else {
            currentUserIsAdmin = false;
            if (userProfileWidget) userProfileWidget.style.display = 'none';
            if (archonToolsContainer) archonToolsContainer.style.display = 'none';
        }
        
        loadDecrees(currentUserIsAdmin);
        loadSpecialDecrees(currentUserIsAdmin);
    });

    console.log('Observatoř Osudu byla probuzena a naslouchá.');
});