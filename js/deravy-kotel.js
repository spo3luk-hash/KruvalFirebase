document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();
    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();

    // --- Elementy UI ---
    const chatContainer = document.getElementById('chat-container');
    const enterFocusModeBtn = document.getElementById('enter-focus-mode-btn');
    const leaveFocusModeBtn = document.getElementById('leave-focus-mode-btn');
    const focusModeEntry = document.getElementById('focus-mode-entry');
    const chatPreviewOverlay = document.getElementById('chat-preview-overlay');
    const activeUsersListEl = document.getElementById('active-users-list');
    const leaveButton = document.getElementById('leave-button');
    const chatWindow = document.getElementById('chat-window');
    const messageInput = document.getElementById('chat-message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const chatInputArea = document.getElementById('chat-input-area');
    const wandBtn = document.getElementById('wand-btn');
    const inventoryBtn = document.getElementById('inventory-btn');
    const locationDescriptionText = document.getElementById('location-description-text');
    const editDescBtn = document.getElementById('edit-desc-btn');

    // --- Inventář Modal ---
    const inventoryModal = document.getElementById('inventory-modal');
    const modalInventoryList = document.getElementById('modal-inventory-list');
    const closeInventoryBtn = document.getElementById('close-inventory-btn');

    // --- Admin Tlačítka a Modální Okna ---
    const narratorBtn = document.getElementById('narrator-btn');
    const npcBtn = document.getElementById('npc-btn');
    const alertBtn = document.getElementById('alert-btn');
    const adminChatBtn = document.getElementById('admin-chat-btn');
    const narratorModal = document.getElementById('narrator-modal');
    const npcModal = document.getElementById('npc-modal');
    const alertModal = document.getElementById('alert-modal');
    const adminChatModal = document.getElementById('admin-chat-modal');
    const closeNarratorModalBtn = document.getElementById('close-narrator-modal-btn');
    const closeNpcModalBtn = document.getElementById('close-npc-modal-btn');
    const closeAlertModalBtn = document.getElementById('close-alert-modal-btn');
    const closeAdminChatModalBtn = document.getElementById('close-admin-chat-modal-btn');
    const narratorMessageInput = document.getElementById('narrator-message-input');
    const sendNarratorMessageBtn = document.getElementById('send-narrator-message-btn');
    const npcNameInput = document.getElementById('npc-name-input');
    const npcMessageInput = document.getElementById('npc-message-input');
    const sendNpcMessageBtn = document.getElementById('send-npc-message-btn');
    const alertMessageInput = document.getElementById('alert-message-input');
    const sendAlertMessageBtn = document.getElementById('send-alert-message-btn');
    const locationDescriptionInput = document.getElementById('location-description-input');
    const saveDescBtn = document.getElementById('save-desc-btn');
    const lockChatBtn = document.getElementById('lock-chat-btn');
    const unlockChatBtn = document.getElementById('unlock-chat-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const chatHistoryAdmin = document.getElementById('chat-history-admin');

    // --- Info o postavě (rozšířené) ---
    const currentCharAvatarEl = document.getElementById('current-char-avatar');
    const currentCharStatusEl = document.getElementById('current-char-status');
    const currentCharNameEl = document.getElementById('current-char-name');
    const currentCharHealthBar = document.getElementById('current-char-health-bar');
    const currentCharManaBar = document.getElementById('current-char-mana-bar');
    const charIllnessStatusEl = document.getElementById('char-illness-status');
    const currentCharLevelEl = document.getElementById('current-char-level');
    const currentCharXpBar = document.getElementById('current-char-xp-bar');
    const currentCharXpText = document.getElementById('current-char-xp-text');
    const currentCharRoleEl = document.getElementById('current-char-role');
    const currentCharMoodEl = document.getElementById('current-char-mood');
    const currentCharHungerBar = document.getElementById('current-char-hunger-bar');
    const currentCharThirstBar = document.getElementById('current-char-thirst-bar');

    // --- Globální proměnné ---
    const locationId = 'deravy_kotel';
    let currentUser = null;
    let userData = null;
    let characterId = null;
    let characterData = null;
    let unsubscribeChat = null;
    let unsubscribeCharacter = null;
    let unsubscribeActiveUsers = null;
    let unsubscribeChatInfo = null;
    let manaRegenInterval = null;
    let needsInterval = null;

    // --- INICIALIZACE ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            characterId = sessionStorage.getItem('selectedCharacterId');
            if (characterId) {
                db.collection('hraci').doc(user.uid).get().then(doc => {
                    if (doc.exists) {
                        userData = doc.data();
                        if (userData.admin === true) {
                            document.querySelectorAll('.admin-only-btn').forEach(btn => btn.classList.remove('hidden'));
                        }
                    }
                    joinLocation();
                }).catch(error => {
                    console.error("Chyba při načítání dat uživatele pro kontrolu role: ", error);
                    joinLocation();
                });
            } else {
                window.location.href = '/vyber-postavy.html';
            }
        } else {
            window.location.href = '/index.html';
        }
    });

    // --- Vstup a odchod z lokace ---
    async function joinLocation() {
        const charRef = db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(characterId);
        try {
            await charRef.update({ aktualniLokace: locationId, lastOnline: serverTimestamp });
            attachCharacterListener(charRef);
            attachChatListener();
            attachActiveUsersListener();
            attachChatInfoListener();
            startManaRegeneration();
            startNeedsDegradation();
        } catch (error) {
            console.error("Nepodařilo se vstoupit do lokace: ", error);
        }
    }

    async function leaveLocation() {
        if (unsubscribeChat) unsubscribeChat();
        if (unsubscribeCharacter) unsubscribeCharacter();
        if (unsubscribeActiveUsers) unsubscribeActiveUsers();
        if (unsubscribeChatInfo) unsubscribeChatInfo();
        if (manaRegenInterval) clearInterval(manaRegenInterval);
        if (needsInterval) clearInterval(needsInterval);

        await removeCharacterFromActiveList();

        const charRef = db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(characterId);
        try {
            await charRef.update({ aktualniLokace: 'pricna-ulice' });
            window.location.href = '/pricna-ulice.html';
        } catch (error) {
            console.error("Nepodařilo se opustit lokaci: ", error);
        }
    }

    // --- LISTENERY DATABÁZE ---
    function attachCharacterListener(charRef) {
        unsubscribeCharacter = charRef.onSnapshot(async (doc) => {
            if (doc.exists) {
                let charData = { id: doc.id, ...doc.data() };
                const updates = {};

                if (typeof charData.zdravi === 'undefined') updates.zdravi = 100;
                if (typeof charData.maxZdravi === 'undefined') updates.maxZdravi = 100;
                if (typeof charData.mana === 'undefined') updates.mana = 100;
                if (typeof charData.maxMana === 'undefined') updates.maxMana = 100;
                if (typeof charData.xp === 'undefined') updates.xp = 0;
                if (typeof charData.level === 'undefined') updates.level = 1;
                if (typeof charData.nemoc === 'undefined') updates.nemoc = null;
                if (typeof charData.nalada === 'undefined') updates.nalada = 'Neutrální';
                if (typeof charData.herniRole === 'undefined') updates.herniRole = 'Student';
                if (typeof charData.hlad === 'undefined') updates.hlad = 100;
                if (typeof charData.zizen === 'undefined') updates.zizen = 100;

                if (Object.keys(updates).length > 0) {
                    await charRef.update(updates);
                    charData = { ...charData, ...updates };
                }
                
                characterData = charData;
                displayCharacterInfo(characterData);
            }
        });
    }

    function attachChatListener() {
        const chatRef = db.collection('chat_mistnosti').doc(locationId).collection('zpravy').orderBy('casovaZnamka', 'desc').limit(150);
        unsubscribeChat = chatRef.onSnapshot(snapshot => {
            const chatMessages = [];
            snapshot.forEach(doc => {
                chatMessages.push({ id: doc.id, ...doc.data() });
            });
            renderChatMessages(chatMessages.reverse());
        }, error => console.error("Chyba při načítání chatu: ", error));
    }

    function attachActiveUsersListener() {
        const activePresenceRef = db.collection('location_active_presence').doc(locationId).collection('characters');
        unsubscribeActiveUsers = activePresenceRef.onSnapshot(snapshot => {
            const activeUsers = [];
            snapshot.forEach(doc => {
                activeUsers.push({ id: doc.id, ...doc.data() });
            });
            displayActiveUsers(activeUsers);
        }, error => console.error("Chyba při načítání aktivních postav: ", error));
    }

    function attachChatInfoListener() {
        const chatInfoRef = db.collection('chat_mistnosti').doc(locationId);
        unsubscribeChatInfo = chatInfoRef.onSnapshot(doc => {
            if (doc.exists) {
                const chatInfo = doc.data();
                locationDescriptionText.textContent = chatInfo.description || 'Stará, zakouřená místnost plná tlumených rozhovorů a cinkání sklenic.';
                locationDescriptionInput.value = chatInfo.description || '';

                const isLocked = chatInfo.isLocked === true;
                const canWrite = !isLocked || userData?.admin === true;

                messageInput.disabled = !canWrite;
                sendMessageBtn.disabled = !canWrite;
                messageInput.placeholder = canWrite ? 'Napiš zprávu...' : 'Chat je uzamčen administrátorem.';

                if (userData?.admin === true) {
                    if (isLocked) {
                        lockChatBtn.style.display = 'none';
                        unlockChatBtn.style.display = 'inline-flex';
                    } else {
                        lockChatBtn.style.display = 'inline-flex';
                        unlockChatBtn.style.display = 'none';
                    }
                }
            }
        });
    }

    // --- ZOBRAZOVACÍ A RENDERUJÍCÍ FUNKCE ---
    function renderChatMessages(messages) {
        chatWindow.innerHTML = '';
        messages.forEach(msg => displayMessage(msg));
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function displayCharacterInfo(char) {
        const placeholderAvatar = '/img/avatars/char_placeholder.png';
        currentCharAvatarEl.src = char.avatar || placeholderAvatar;
        currentCharNameEl.textContent = char.jmeno;
        currentCharStatusEl.textContent = char.status || '';
        currentCharStatusEl.style.display = char.status ? 'block' : 'none';

        const healthPercent = Math.max(0, (char.zdravi / char.maxZdravi) * 100);
        currentCharHealthBar.style.width = `${healthPercent}%`;
        currentCharHealthBar.parentElement.title = `Zdraví: ${char.zdravi} / ${char.maxZdravi}`;
        if (char.nemoc) {
            currentCharHealthBar.classList.add('ill');
            charIllnessStatusEl.textContent = `Nemoc: ${char.nemoc}`;
            charIllnessStatusEl.classList.remove('hidden');
        } else {
            currentCharHealthBar.classList.remove('ill');
            charIllnessStatusEl.classList.add('hidden');
        }

        const manaPercent = Math.max(0, (char.mana / char.maxMana) * 100);
        currentCharManaBar.style.width = `${manaPercent}%`;
        currentCharManaBar.parentElement.title = `Mana: ${char.mana} / ${char.maxMana}`;

        const xpForNextLevel = 100 * Math.pow(1.5, char.level - 1);
        const xpPercent = Math.max(0, (char.xp / xpForNextLevel) * 100);
        currentCharLevelEl.textContent = char.level;
        currentCharXpBar.style.width = `${xpPercent}%`;
        currentCharXpText.textContent = `${Math.floor(char.xp)} / ${Math.floor(xpForNextLevel)}`;

        currentCharRoleEl.textContent = char.herniRole || 'Neznámá';
        currentCharMoodEl.textContent = char.nalada || 'Neznámá';

        const hungerPercent = Math.max(0, char.hlad);
        const thirstPercent = Math.max(0, char.zizen);
        currentCharHungerBar.style.width = `${hungerPercent}%`;
        currentCharThirstBar.style.width = `${thirstPercent}%`;
        document.getElementById('hunger-indicator').title = `Hlad: ${hungerPercent}%`;
        document.getElementById('thirst-indicator').title = `Žízeň: ${thirstPercent}%`;
    }

    function displayActiveUsers(users) {
        activeUsersListEl.innerHTML = '';
        const placeholderAvatar = '/img/avatars/char_placeholder.png';
        users.forEach(user => {
            const li = document.createElement('li');
            li.className = 'user-list-item';
            li.dataset.characterId = user.id;
            li.innerHTML = `
                <div class="chat-avatar-container">
                    <img src="${user.avatar || placeholderAvatar}" alt="${user.jmeno}" class="chat-avatar">
                </div>
                <span class="online-user-name">${user.jmeno}</span>
            `;
            activeUsersListEl.appendChild(li);
        });
    }

    function displayMessage(msg) {
        const msgDiv = document.createElement('div');
        const time = msg.casovaZnamka?.toDate().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) || '';
        const placeholderAvatar = '/img/avatars/char_placeholder.png';

        msgDiv.className = `message type-${msg.typ || 'standard'}`;
        msgDiv.dataset.id = msg.id;

        switch (msg.typ) {
            case 'emote':
                msgDiv.innerHTML = `<p class="message-text">* ${msg.postavaJmeno} ${msg.text} *</p>`;
                break;
            case 'narrator':
                msgDiv.className = 'narrator-message';
                msgDiv.innerHTML = `<p>${msg.text}</p>`;
                break;
            case 'npc':
                msgDiv.innerHTML = `
                    <div class="message-content npc-message">
                        <div class="message-sender">${msg.npcName}</div>
                        <p class="message-text">${msg.text}</p>
                    </div>`;
                break;
            case 'system-alert':
                msgDiv.className = 'system-alert-message';
                msgDiv.innerHTML = `<i class="fas fa-bullhorn"></i><p class="message-text">${msg.text}</p>`;
                break;
            default:
                msgDiv.innerHTML = `
                    <div class="chat-avatar-container">
                        <img src="${msg.avatar || placeholderAvatar}" alt="${msg.postavaJmeno}" class="chat-avatar">
                        ${msg.status ? `<div class="status-bubble">${msg.status}</div>` : ''}
                    </div>
                    <div class="message-content">
                        <div class="message-sender">${msg.postavaJmeno} <span class="timestamp">${time}</span></div>
                        <p class="message-text">${msg.text}</p>
                    </div>
                `;
                break;
        }
        chatWindow.appendChild(msgDiv);
    }

    // --- HERNÍ MECHANIKY ---
    function startManaRegeneration() {
        if (manaRegenInterval) clearInterval(manaRegenInterval);
        
        manaRegenInterval = setInterval(() => {
            if (currentUser && characterId && characterData && characterData.mana < characterData.maxMana) {
                const charRef = db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(characterId);
                charRef.update({ mana: firebase.firestore.FieldValue.increment(1) }).catch(error => {
                    console.error("Chyba při regeneraci many: ", error);
                    clearInterval(manaRegenInterval);
                });
            }
        }, 15000);
    }

    function startNeedsDegradation() {
        if (needsInterval) clearInterval(needsInterval);
        needsInterval = setInterval(() => {
            if (currentUser && characterId && characterData) {
                const updates = {};
                if (characterData.hlad > 0) {
                    updates.hlad = firebase.firestore.FieldValue.increment(-1);
                }
                if (characterData.zizen > 0) {
                    updates.zizen = firebase.firestore.FieldValue.increment(-1);
                }
                if (Object.keys(updates).length > 0) {
                    const charRef = db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(characterId);
                    charRef.update(updates).catch(err => {
                        console.error("Chyba při snižování potřeb: ", err);
                        clearInterval(needsInterval);
                    });
                }
            }
        }, 60000); 
    }

    async function addCharacterToActiveList() {
        if (!characterData) return;
        const activePresenceRef = db.collection('location_active_presence').doc(locationId).collection('characters').doc(characterId);
        try {
            await activePresenceRef.set({
                jmeno: characterData.jmeno,
                avatar: characterData.avatar || null,
                status: characterData.status || null,
                last_active: serverTimestamp
            });
        } catch (error) {
            console.error("Chyba při přidávání postavy do aktivních: ", error);
        }
    }

    async function removeCharacterFromActiveList() {
        if (!characterId) return;
        const activePresenceRef = db.collection('location_active_presence').doc(locationId).collection('characters').doc(characterId);
        try {
            await activePresenceRef.delete();
        } catch (error) {
            console.error("Chyba při odstraňování postavy z aktivních: ", error);
        }
    }

    // --- ODESÍLÁNÍ ZPRÁV ---
    async function sendMessage(type, data) {
        if (!characterData && (type === 'standard' || type === 'emote')) return;

        let messageData = {
            typ: type,
            autorId: currentUser.uid,
            casovaZnamka: serverTimestamp,
            ...data
        };

        if (type === 'standard' || type === 'emote') {
            messageData.postavaJmeno = characterData.jmeno;
            messageData.postavaId = characterId;
            messageData.avatar = characterData.avatar || null;
            messageData.status = characterData.status || null;
        }

        try {
            await db.collection('chat_mistnosti').doc(locationId).collection('zpravy').add(messageData);
        } catch (error) {
            console.error("Chyba při odesílání zprávy: ", error);
        }
    }

    // --- FUNKCE PRO SPECIFICKÉ AKCE ---
    function sendRegularMessage() {
        const text = messageInput.value;
        if (!text.trim()) return;
        sendMessage('standard', { text: text.trim() });
        messageInput.value = '';
        messageInput.focus();
    }

    function sendEmote(emoteText) {
        sendMessage('emote', { text: emoteText });
    }

    function sendNarratorMessage() {
        const text = narratorMessageInput.value.trim();
        if (!text) {
            alert('Musíte vyplnit text zprávy vypravěče.');
            return;
        }
        sendMessage('narrator', { text: text });
        narratorMessageInput.value = '';
        narratorModal.classList.add('hidden');
    }

    function sendNpcMessage() {
        const name = npcNameInput.value.trim();
        const text = npcMessageInput.value.trim();
        if (!name || !text) {
            alert('Musíte vyplnit jméno NPC i text zprávy.');
            return;
        }
        sendMessage('npc', { npcName: name, text: text });
        npcMessageInput.value = '';
        npcModal.classList.add('hidden');
    }

    function sendAlertMessage() {
        const text = alertMessageInput.value.trim();
        if (!text) {
            alert('Musíte vyplnit text upozornění.');
            return;
        }
        sendMessage('system-alert', { text: text });
        alertMessageInput.value = '';
        alertModal.classList.add('hidden');
    }

    // --- Inventář ---
    async function renderInventoryModal() {
        modalInventoryList.innerHTML = '<p>Načítám inventář...</p>';
        if (!characterId || !currentUser) {
            modalInventoryList.innerHTML = '<p>Chyba: Uživatel nebo postava nebyla nalezena.</p>';
            return;
        }

        try {
            const charRef = db.collection('hraci').doc(currentUser.uid).collection('postavy').doc(characterId);
            const doc = await charRef.get();
            if (!doc.exists) {
                modalInventoryList.innerHTML = '<p>Postava nenalezena.</p>';
                return;
            }

            const characterData = doc.data();
            let allItems = [];

            if (characterData.inventar && Array.isArray(characterData.inventar)) {
                allItems.push(...characterData.inventar.map(item => ({...item, typ: item.typ || 'předmět' })) );
            }

            const wandsSnapshot = await charRef.collection('hulky').get();
            wandsSnapshot.forEach(wandDoc => {
                const wandData = wandDoc.data();
                allItems.push({ nazev: `Hůlka (${wandData.drevo}, ${wandData.jadro}, ${wandData.delka})`, mnozstvi: 1, typ: 'hůlka' });
            });

            const booksSnapshot = await charRef.collection('knihy').get();
            booksSnapshot.forEach(bookDoc => {
                const bookData = bookDoc.data();
                allItems.push({ nazev: bookData.nazev, mnozstvi: bookData.mnozstvi || 1, typ: 'kniha' });
            });

            const petsSnapshot = await charRef.collection('mazlicci').get();
            petsSnapshot.forEach(petDoc => {
                const petData = petDoc.data();
                allItems.push({ nazev: `${petData.jmeno} (${petData.druh})`, mnozstvi: 1, typ: 'mazlíček' });
            });

            if (allItems.length === 0) {
                modalInventoryList.innerHTML = '<li>Tvůj inventář je prázdný.</li>';
                return;
            }

            modalInventoryList.innerHTML = '';
            allItems.forEach(item => {
                const card = document.createElement('li');
                card.className = 'inventory-card';

                const nameEl = document.createElement('div');
                nameEl.className = 'inventory-card-name';
                nameEl.textContent = item.nazev;
                card.appendChild(nameEl);

                if (item.mnozstvi && item.mnozstvi > 1) {
                    const quantityEl = document.createElement('div');
                    quantityEl.className = 'inventory-card-quantity';
                    quantityEl.textContent = `x${item.mnozstvi}`;
                    card.appendChild(quantityEl);
                }

                const typeEl = document.createElement('div');
                typeEl.className = 'inventory-card-type';
                typeEl.textContent = item.typ;
                card.appendChild(typeEl);

                const useButton = document.createElement('button');
                useButton.className = 'inventory-card-button';
                useButton.innerHTML = '<i class="fas fa-hand-paper"></i> Použít';
                useButton.addEventListener('click', () => {
                    sendEmote(`používá ${item.nazev}.`);
                    inventoryModal.classList.add('hidden');
                });
                card.appendChild(useButton);

                modalInventoryList.appendChild(card);
            });

        } catch (error) {
            console.error("Chyba při načítání komplexního inventáře: ", error);
            modalInventoryList.innerHTML = '<li>Nepodařilo se načíst inventář.</li>';
        }
    }

    // --- ADMIN FUNKCE ---
    async function loadChatHistoryForAdmin() {
        chatHistoryAdmin.innerHTML = '<p>Načítám historii...</p>';
        const chatRef = db.collection('chat_mistnosti').doc(locationId).collection('zpravy').orderBy('casovaZnamka', 'desc').limit(200);
        try {
            const snapshot = await chatRef.get();
            if (snapshot.empty) {
                chatHistoryAdmin.innerHTML = '<p>V chatu zatím nejsou žádné zprávy.</p>';
                return;
            }
            chatHistoryAdmin.innerHTML = '';
            snapshot.forEach(doc => {
                const msg = { id: doc.id, ...doc.data() };
                const msgDiv = document.createElement('div');
                msgDiv.className = 'admin-chat-message';
                const time = msg.casovaZnamka?.toDate().toLocaleString('cs-CZ') || '';
                const sender = msg.postavaJmeno || msg.npcName || (msg.typ === 'narrator' ? 'Vypravěč' : 'Systém');
                msgDiv.innerHTML = `
                    <div class="admin-message-info">
                        <span><strong>${sender}</strong> (${time})</span>
                        <span>${msg.text || ''}</span>
                    </div>
                    <button class="btn-danger btn-small delete-msg-btn" data-id="${msg.id}"><i class="fas fa-times"></i></button>
                `;
                chatHistoryAdmin.appendChild(msgDiv);
            });
        } catch (error) {
            console.error("Chyba při načítání historie chatu pro admina: ", error);
            chatHistoryAdmin.innerHTML = '<p>Nepodařilo se načíst historii chatu.</p>';
        }
    }

    async function deleteMessage(messageId) {
        if (!confirm('Opravdu chcete smazat tuto zprávu?')) return;
        try {
            await db.collection('chat_mistnosti').doc(locationId).collection('zpravy').doc(messageId).delete();
            loadChatHistoryForAdmin();
        } catch (error) {
            console.error('Chyba při mazání zprávy: ', error);
            alert('Nepodařilo se smazat zprávu.');
        }
    }

    async function clearChat() {
        if (!confirm('OPRAVDU chcete smazat VŠECHNY zprávy v tomto chatu? Tato akce je nevratná!')) return;
        const chatRef = db.collection('chat_mistnosti').doc(locationId).collection('zpravy');
        try {
            const snapshot = await chatRef.get();
            if (snapshot.empty) return;
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            await sendMessage('system-alert', { text: 'Chat byl pročištěn administrátorem.' });
            loadChatHistoryForAdmin();
        } catch (error) {
            console.error('Chyba při čištění chatu: ', error);
            alert('Nepodařilo se vyčistit chat.');
        }
    }

    async function setChatLock(isLocked) {
        const chatInfoRef = db.collection('chat_mistnosti').doc(locationId);
        try {
            await chatInfoRef.set({ isLocked: isLocked }, { merge: true });
            const actionText = isLocked ? 'uzamčen' : 'odemčen';
            await sendMessage('system-alert', { text: `Chat byl ${actionText} administrátorem.` });
        } catch (error) {
            console.error(`Chyba při ${isLocked ? 'zamykání' : 'odemykání'} chatu: `, error);
        }
    }

    async function saveDescription() {
        const newDesc = locationDescriptionInput.value.trim();
        if (!newDesc) {
            alert('Popis nemůže být prázdný.');
            return;
        }
        const chatInfoRef = db.collection('chat_mistnosti').doc(locationId);
        try {
            await chatInfoRef.set({ description: newDesc }, { merge: true });
            alert('Popis byl úspěšně uložen.');
        } catch (error) {
            console.error('Chyba při ukládání popisu: ', error);
            alert('Nepodařilo se uložit popis.');
        }
    }

    // --- Event Listeners pro UI ---
    enterFocusModeBtn.addEventListener('click', () => {
        chatContainer.classList.add('focus-mode');
        chatInputArea.classList.remove('hidden');
        leaveFocusModeBtn.classList.remove('hidden');
        focusModeEntry.classList.add('hidden');
        chatPreviewOverlay.classList.add('hidden');
        messageInput.focus();
        chatWindow.scrollTop = chatWindow.scrollHeight;
        addCharacterToActiveList();
    });

    leaveFocusModeBtn.addEventListener('click', () => {
        chatContainer.classList.remove('focus-mode');
        chatInputArea.classList.add('hidden');
        leaveFocusModeBtn.classList.add('hidden');
        focusModeEntry.classList.remove('hidden');
        chatPreviewOverlay.classList.remove('hidden');
        removeCharacterFromActiveList();
    });

    sendMessageBtn.addEventListener('click', sendRegularMessage);
    messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendRegularMessage(); } });
    wandBtn.addEventListener('click', () => { 
        if (characterData) { 
             sendEmote('elegantně mávne svou hůlkou.');
        } 
    });
    inventoryBtn.addEventListener('click', () => { if (characterData) { renderInventoryModal(); inventoryModal.classList.remove('hidden'); } else { alert('Informace o postavě se stále načítají.'); } });
    closeInventoryBtn.addEventListener('click', () => inventoryModal.classList.add('hidden'));
    leaveButton.addEventListener('click', leaveLocation);

    // Admin Listeners
    if (editDescBtn) editDescBtn.addEventListener('click', () => adminChatModal.classList.remove('hidden'));
    if (narratorBtn) narratorBtn.addEventListener('click', () => narratorModal.classList.remove('hidden'));
    if (closeNarratorModalBtn) closeNarratorModalBtn.addEventListener('click', () => narratorModal.classList.add('hidden'));
    if (sendNarratorMessageBtn) sendNarratorMessageBtn.addEventListener('click', sendNarratorMessage);

    if (npcBtn) npcBtn.addEventListener('click', () => npcModal.classList.remove('hidden'));
    if (closeNpcModalBtn) closeNpcModalBtn.addEventListener('click', () => npcModal.classList.add('hidden'));
    if (sendNpcMessageBtn) sendNpcMessageBtn.addEventListener('click', sendNpcMessage);

    if (alertBtn) alertBtn.addEventListener('click', () => alertModal.classList.remove('hidden'));
    if (closeAlertModalBtn) closeAlertModalBtn.addEventListener('click', () => alertModal.classList.add('hidden'));
    if (sendAlertMessageBtn) sendAlertMessageBtn.addEventListener('click', sendAlertMessage);

    if (adminChatBtn) adminChatBtn.addEventListener('click', () => {
        adminChatModal.classList.remove('hidden');
        loadChatHistoryForAdmin();
    });
    if (closeAdminChatModalBtn) closeAdminChatModalBtn.addEventListener('click', () => adminChatModal.classList.add('hidden'));
    if (lockChatBtn) lockChatBtn.addEventListener('click', () => setChatLock(true));
    if (unlockChatBtn) unlockChatBtn.addEventListener('click', () => setChatLock(false));
    if (clearChatBtn) clearChatBtn.addEventListener('click', clearChat);
    if (saveDescBtn) saveDescBtn.addEventListener('click', saveDescription);
    if (chatHistoryAdmin) chatHistoryAdmin.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-msg-btn');
        if (deleteBtn) {
            const messageId = deleteBtn.dataset.id;
            deleteMessage(messageId);
        }
    });
});