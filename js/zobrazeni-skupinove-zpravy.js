document.addEventListener('DOMContentLoaded', () => {
    // --- REFERENCE NA ELEMENTY ---
    const groupNameEl = document.getElementById('recipient-name');
    const groupMembersCountEl = document.getElementById('group-members-count-display');
    const messagesContainer = document.getElementById('messages-container');
    const replyForm = document.getElementById('message-reply-form');
    const replyContentEl = document.getElementById('reply-content');
    const manageGroupBtn = document.getElementById('manage-group-btn');

    // --- FIREBASE A STAVOVÉ PROMĚNNÉ ---
    const db = firebase.firestore();
    let currentUser = null;
    let conversationId = null;
    let conversationData = null;
    const KruvalModal = window.Kruval && window.Kruval.forumAdmin ? window.Kruval.forumAdmin : null;
    let messagesHaveBeenLoaded = false;

    // --- INICIALIZACE ---
    if (typeof initializeEditor === "function") {
        initializeEditor('reply-content', { enableMentions: true });
    }
    const params = new URLSearchParams(window.location.search);
    conversationId = params.get('id');

    if (!conversationId) {
        document.body.innerHTML = '<p class="error-message">Chybí ID skupinové konverzace.</p>';
        return;
    }

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            setupConversationListener();
        } else {
            window.location.href = 'index.html';
        }
    });

    // --- HLAVNÍ POSLUCHAČ ZMĚN V KONVERZACI ---
    function setupConversationListener() {
        const docRef = db.collection('soukromeZpravyForum').doc(conversationId);
        let conversationListener = docRef.onSnapshot(doc => {
            if (doc.exists) {
                const isFirstLoad = !conversationData;
                conversationData = doc.data();
                if (!conversationData.ucastnici.includes(currentUser.uid)) {
                    document.body.innerHTML = '<h1>Přístup odepřen</h1><p>Nejste členem této skupiny.</p>';
                    if (conversationListener) conversationListener();
                    return;
                }
                updateUIWithConversationData();
                checkAdminStatusAndSetupUI();

                if (!messagesHaveBeenLoaded) {
                    loadAndMarkMessagesAsRead();
                }
                
                // OPRAVA: Zkontrolovat, zda je modální okno otevřené, pomocí DOM
                const modalOverlay = document.getElementById('kruval-modal-overlay');
                if (modalOverlay && modalOverlay.style.display === 'flex') {
                    const membersListContainer = document.getElementById('group-members-list-container');
                    if (membersListContainer) {
                        membersListContainer.innerHTML = generateGroupMembersHtml();
                    }
                }
            } else {
                document.body.innerHTML = '<h1>Skupina nenalezena</h1><p>Tato skupinová konverzace pravděpodobně neexistuje.</p>';
            }
        }, error => console.error("Chyba při naslouchání skupině: ", error));
    }
    
    // --- NAČTENÍ A OZNAČENÍ ZPRÁV ---
    function loadAndMarkMessagesAsRead() {
        messagesHaveBeenLoaded = true;
        db.collection('soukromeZpravyForum').doc(conversationId)
            .collection('zpravy').orderBy('casOdeslani', 'asc')
            .onSnapshot(querySnapshot => {
                renderMessages(querySnapshot);
                scrollToBottom(true);
                const unreadUpdate = {};
                unreadUpdate[`neprectenoInfo.${currentUser.uid}`] = firebase.firestore.FieldValue.delete();
                db.collection('soukromeZpravyForum').doc(conversationId).update(unreadUpdate).catch(() => {});
            }, error => console.error("Chyba při načítání zpráv skupiny: ", error));
    }

    // --- AKTUALIZACE UI ---
    function updateUIWithConversationData() {
        document.title = `${conversationData.jmenoSkupiny} - Svět Durmstrangu`;
        if (groupNameEl) groupNameEl.textContent = conversationData.jmenoSkupiny;
        if (groupMembersCountEl) groupMembersCountEl.textContent = `${conversationData.ucastnici.length} členů`;
    }

    // --- KONTROLA ADMINA A NASTAVENÍ SPRÁVY ---
    function checkAdminStatusAndSetupUI() {
        if (!conversationData || !currentUser) return;
        const isCurrentUserAdmin = conversationData.administratori.includes(currentUser.uid);
        if (isCurrentUserAdmin) {
            manageGroupBtn.style.display = 'block';
            manageGroupBtn.onclick = openGroupManagementModal;
        } else {
            manageGroupBtn.style.display = 'none';
        }
    }

    // --- SPRÁVA SKUPINY: MODÁLNÍ OKNO ---
    function openGroupManagementModal() {
        if (!KruvalModal) return;
        const modalContent = `
            <div class="modal-header">
                <h2>Správa skupiny</h2>
                <span id="modal-close-btn" class="modal-close">&times;</span>
            </div>
            <div class="modal-body">
                <div class="form-section">
                    <h4>Změnit název skupiny</h4>
                    <div class="form-group">
                        <label for="group-name-input">Název skupiny:</label>
                        <input type="text" id="group-name-input" class="text-input" value="${escapeHTML(conversationData.jmenoSkupiny)}">
                        <button id="save-group-name-btn" class="custom-button">Uložit název</button>
                    </div>
                </div>
                <hr class="modal-divider">
                <div class="form-section">
                    <h4>Přidat člena</h4>
                    <div class="form-group">
                        <label for="add-member-email-input">E-mail uživatele:</label>
                        <input type="email" id="add-member-email-input" class="text-input" placeholder="např. jmeno.prijmeni@email.com">
                        <button id="add-member-btn" class="custom-button">Najít a přidat</button>
                    </div>
                </div>
                <hr class="modal-divider">
                <h3>Členové skupiny</h3>
                <div id="group-members-list-container">
                    ${generateGroupMembersHtml()}
                </div>
            </div>
            <div class="modal-footer">
                 <button id="modal-cancel-btn" class="custom-button secondary">Zavřít</button>
            </div>
        `;
        KruvalModal.showModal(modalContent);
        document.getElementById('modal-close-btn').addEventListener('click', KruvalModal.closeModal);
        document.getElementById('modal-cancel-btn').addEventListener('click', KruvalModal.closeModal);
        document.getElementById('save-group-name-btn').addEventListener('click', handleGroupNameChange);
        document.getElementById('add-member-btn').addEventListener('click', handleAddNewMember);
        
        const membersListContainer = document.getElementById('group-members-list-container');
        membersListContainer.addEventListener('click', handleMemberAction);
    }

    // --- OBSLUHA AKCÍ V SEZNAMU ČLENŮ ---
    function handleMemberAction(e) {
        const target = e.target.closest('.action-button');
        if (!target) return;

        const action = target.dataset.action;
        const memberId = target.dataset.uid;
        if (!action || !memberId) return;

        const isTargetAdmin = conversationData.administratori.includes(memberId);

        if (action === 'remove') {
            handleRemoveMember(memberId);
        } else if (action === 'promote' || action === 'demote') {
            handleToggleAdminStatus(memberId, isTargetAdmin);
        }
    }
    
    // --- FUNKCE PRO ZMĚNU NÁZVU SKUPINY ---
    async function handleGroupNameChange() {
        const newNameInput = document.getElementById('group-name-input');
        const newName = newNameInput.value.trim();
        const oldName = conversationData.jmenoSkupiny;
        if (!newName || newName === oldName) {
            if (!newName) KruvalModal.showAlert("Název skupiny nemůže být prázdný.", "error");
            return;
        }
        const adminName = conversationData.infoUcastniku[currentUser.uid]?.identitaNaForu || 'Administrátor';
        try {
            const batch = db.batch();
            const conversationRef = db.collection('soukromeZpravyForum').doc(conversationId);
            batch.update(conversationRef, { jmenoSkupiny: newName });
            const systemMessageRef = conversationRef.collection('zpravy').doc();
            batch.set(systemMessageRef, {
                typ: 'system',
                text: `${escapeHTML(adminName)} změnil(a) název skupiny z "${escapeHTML(oldName)}" na "${escapeHTML(newName)}".`,
                casOdeslani: firebase.firestore.FieldValue.serverTimestamp()
            });
            await batch.commit();
            KruvalModal.showAlert("Název skupiny byl úspěšně změněn.", "success", 2000);
            document.getElementById('group-name-input').value = newName;
        } catch (error) {
            console.error("Chyba při změně názvu skupiny:", error);
            KruvalModal.showAlert("Při ukládání nového názvu došlo k chybě.", "error");
        }
    }
    
    // --- FUNKCE PRO PŘIDÁNÍ ČLENA ---
    async function handleAddNewMember() {
        const emailInput = document.getElementById('add-member-email-input');
        const email = emailInput.value.trim().toLowerCase();
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            KruvalModal.showAlert("Zadejte prosím platnou e-mailovou adresu.", "error");
            return;
        }
        try {
            const usersRef = db.collection('uzivatele');
            const querySnapshot = await usersRef.where('email', '==', email).limit(1).get();
            if (querySnapshot.empty) {
                KruvalModal.showAlert("Uživatel s tímto e-mailem nebyl nalezen.", "error");
                return;
            }
            const userDoc = querySnapshot.docs[0];
            const newMemberId = userDoc.id;
            if (conversationData.ucastnici.includes(newMemberId)) {
                KruvalModal.showAlert("Tento uživatel již je členem skupiny.", "info");
                emailInput.value = '';
                return;
            }
            const newMemberData = userDoc.data();
            const adminName = conversationData.infoUcastniku[currentUser.uid]?.identitaNaForu || 'Administrátor';
            const newMemberName = (newMemberData.identity && newMemberData.identity.displayName) ? newMemberData.identity.displayName : 'Nový člen';
            const newMemberAvatar = (newMemberData.profile && newMemberData.profile.avatar) ? newMemberData.profile.avatar : 'images/silhouettes/placeholder.png';
            const batch = db.batch();
            const conversationRef = db.collection('soukromeZpravyForum').doc(conversationId);
            batch.update(conversationRef, {
                ucastnici: firebase.firestore.FieldValue.arrayUnion(newMemberId),
                [`infoUcastniku.${newMemberId}`]: { identitaNaForu: newMemberName, avatarNaForu: newMemberAvatar },
                [`neprectenoInfo.${newMemberId}`]: true
            });
            const systemMessageRef = conversationRef.collection('zpravy').doc();
            batch.set(systemMessageRef, {
                typ: 'system',
                text: `${escapeHTML(adminName)} přidal(a) do skupiny uživatele ${escapeHTML(newMemberName)}.`,
                casOdeslani: firebase.firestore.FieldValue.serverTimestamp()
            });
            await batch.commit();
            KruvalModal.showAlert(`${escapeHTML(newMemberName)} byl(a) úspěšně přidán(a) do skupiny.`, "success");
            emailInput.value = '';
        } catch (error) {
            console.error("Chyba při přidávání nového člena:", error);
            KruvalModal.showAlert("Při přidávání člena došlo k neočekávané chybě.", "error");
        }
    }
    
    // --- FUNKCE PRO ODSTRANĚNÍ ČLENA ---
    async function handleRemoveMember(memberId) {
        const memberName = conversationData.infoUcastniku[memberId]?.identitaNaForu || 'Neznámý uživatel';
        const confirmed = await KruvalModal.showConfirm(`Opravdu chcete vyhodit uživatele ${escapeHTML(memberName)} ze skupiny?`);
        if (!confirmed) return;
        
        const adminName = conversationData.infoUcastniku[currentUser.uid]?.identitaNaForu || 'Administrátor';
        try {
            const batch = db.batch();
            const conversationRef = db.collection('soukromeZpravyForum').doc(conversationId);
            
            const updates = {
                ucastnici: firebase.firestore.FieldValue.arrayRemove(memberId),
                administratori: firebase.firestore.FieldValue.arrayRemove(memberId),
                [`infoUcastniku.${memberId}`]: firebase.firestore.FieldValue.delete(),
                [`neprectenoInfo.${memberId}`]: firebase.firestore.FieldValue.delete()
            };

            batch.update(conversationRef, updates);
            
            const systemMessageRef = conversationRef.collection('zpravy').doc();
            batch.set(systemMessageRef, {
                typ: 'system',
                text: `${escapeHTML(adminName)} vyhodil(a) ze skupiny uživatele ${escapeHTML(memberName)}.`,
                casOdeslani: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await batch.commit();
            KruvalModal.showAlert(`${escapeHTML(memberName)} byl(a) úspěšně odstraněn(a).`, "success");
        } catch (error) {
            console.error("Chyba při odstraňování člena:", error);
            KruvalModal.showAlert("Při odstraňování člena došlo k chybě.", "error");
        }
    }

    // --- FUNKCE PRO ZMĚNU STATUSU ADMINA ---
    async function handleToggleAdminStatus(memberId, isTargetAdmin) {
        const memberName = conversationData.infoUcastniku[memberId]?.identitaNaForu || 'Neznámý uživatel';
        const adminName = conversationData.infoUcastniku[currentUser.uid]?.identitaNaForu || 'Administrátor';
        const actionText = isTargetAdmin ? 'odebrat administrátorská práva' : 'jmenovat administrátorem';
        const systemMessageText = isTargetAdmin 
            ? `${escapeHTML(adminName)} odebral(a) administrátorská práva uživateli ${escapeHTML(memberName)}.`
            : `${escapeHTML(adminName)} jmenoval(a) uživatele ${escapeHTML(memberName)} administrátorem.`;

        const confirmed = await KruvalModal.showConfirm(`Opravdu chcete uživateli ${escapeHTML(memberName)} ${actionText}?`);
        if (!confirmed) return;
        
        try {
            const batch = db.batch();
            const conversationRef = db.collection('soukromeZpravyForum').doc(conversationId);
            const updateAction = isTargetAdmin 
                ? firebase.firestore.FieldValue.arrayRemove(memberId) 
                : firebase.firestore.FieldValue.arrayUnion(memberId);
            
            batch.update(conversationRef, { administratori: updateAction });
            
            const systemMessageRef = conversationRef.collection('zpravy').doc();
            batch.set(systemMessageRef, {
                typ: 'system',
                text: systemMessageText,
                casOdeslani: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await batch.commit();
            KruvalModal.showAlert("Stav administrátora byl úspěšně změněn.", "success");
        } catch (error) {
            console.error("Chyba při změně statusu admina:", error);
            KruvalModal.showAlert("Při změně statusu administrátora došlo k chybě.", "error");
        }
    }

    // --- GENERÁTOR HTML PRO SEZNAM ČLENŮ ---
    function generateGroupMembersHtml() {
        if (!conversationData) return '';
        let html = '';
        const sortedUcastnici = [...conversationData.ucastnici].sort((a, b) => {
            const aIsAdmin = conversationData.administratori.includes(a);
            const bIsAdmin = conversationData.administratori.includes(b);
            if (aIsAdmin && !bIsAdmin) return -1;
            if (!aIsAdmin && bIsAdmin) return 1;
            const nameA = (conversationData.infoUcastniku[a] || {}).identitaNaForu || '';
            const nameB = (conversationData.infoUcastniku[b] || {}).identitaNaForu || '';
            return nameA.localeCompare(nameB);
        });
        sortedUcastnici.forEach(memberId => {
            const memberInfo = conversationData.infoUcastniku[memberId] || {};
            const isAdmin = conversationData.administratori.includes(memberId);
            const name = memberInfo.identitaNaForu || 'Neznámý uživatel';
            const avatar = memberInfo.avatarNaForu || 'images/silhouettes/placeholder.png';
            
            let actionsHtml = '';
            if (memberId !== currentUser.uid) {
                const promoteButton = `<button class="action-button promote" data-action="promote" data-uid="${memberId}" title="Jmenovat administrátorem">&#9733;</button>`;
                const demoteButton = `<button class="action-button demote" data-action="demote" data-uid="${memberId}" title="Odebrat práva administrátora">&#9734;</button>`;
                const removeButton = `<button class="action-button remove" data-action="remove" data-uid="${memberId}" title="Vyhodit člena">&times;</button>`;
                
                actionsHtml = (isAdmin ? demoteButton : promoteButton) + removeButton;
            }

            html += `
                <div class="group-member-item">
                    <img src="${escapeHTML(avatar)}" alt="Avatar - ${escapeHTML(name)}" class="member-avatar">
                    <div class="member-info">
                        <div class="member-name">${escapeHTML(name)}</div>
                        <div class="member-role">${isAdmin ? 'Administrátor' : 'Člen'}</div>
                    </div>
                    <div class="member-actions">${actionsHtml}</div>
                </div>
            `;
        });
        return html;
    }

    // --- VYKRESLOVÁNÍ ZPRÁV ---
    function renderMessages(querySnapshot) {
        const messagesFragment = document.createDocumentFragment();
        let lastMessageDate = null;
        querySnapshot.forEach(doc => {
            const msg = { ...doc.data(), id: doc.id };
            const msgDate = msg.casOdeslani ? msg.casOdeslani.toDate() : null;
            if (msg.typ === 'system') {
                messagesFragment.appendChild(createSystemMessage(msg));
                return;
            }
            if (msgDate) {
                const msgDay = msgDate.toDateString();
                if (msgDay !== lastMessageDate) {
                    const separator = document.createElement('div');
                    separator.className = 'date-separator';
                    separator.textContent = formatDateSeparator(msgDate);
                    messagesFragment.appendChild(separator);
                    lastMessageDate = msgDay;
                }
            }
            messagesFragment.appendChild(createMessageBubble(msg));
        });
        messagesContainer.innerHTML = '';
        messagesContainer.appendChild(messagesFragment);
    }
    
    // --- ODESLÁNÍ ODPOVĚDI ---
    replyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const messageText = replyContentEl.innerHTML.trim();
        if (!messageText || replyContentEl.classList.contains('is-placeholder')) return;
        const recipientIds = conversationData.ucastnici.filter(uid => uid !== currentUser.uid);
        db.collection('soukromeZpravyForum').doc(conversationId).collection('zpravy').add({
            odesilatelId: currentUser.uid,
            text: messageText,
            casOdeslani: firebase.firestore.FieldValue.serverTimestamp(),
        });
        db.collection('soukromeZpravyForum').doc(conversationId).update({
            posledniZpravaText: messageText.replace(/<[^>]+>/g, '').substring(0, 80),
            casPosledniZpravy: firebase.firestore.FieldValue.serverTimestamp(),
            ...recipientIds.reduce((acc, uid) => ({ ...acc, [`neprectenoInfo.${uid}`]: true }), {})
        }).then(() => {
            replyContentEl.innerHTML = '';
            if (replyContentEl.classList.contains('editable-content')) {
                replyContentEl.classList.add('is-placeholder');
                replyContentEl.textContent = replyContentEl.dataset.placeholder;
            }
        }).catch(error => KruvalModal.showAlert("Při odesílání zprávy došlo k chybě.", "error"));
    });
    
    // --- POMOCNÉ FUNKCE ---
    function createSystemMessage(message) {
        const systemMessage = document.createElement('div');
        systemMessage.className = 'date-separator';
        systemMessage.innerHTML = message.text;
        systemMessage.style.fontStyle = 'italic';
        return systemMessage;
    }

    function createMessageBubble(message) {
        const isSender = message.odesilatelId === currentUser.uid;
        const senderInfo = conversationData.infoUcastniku[message.odesilatelId] || {};
        const wrapper = document.createElement('div');
        wrapper.className = `message-bubble-wrapper ${isSender ? 'sender' : 'recipient'}`;
        wrapper.dataset.messageId = message.id;
        const avatar = document.createElement('img');
        avatar.className = 'message-avatar';
        avatar.src = senderInfo.avatarNaForu || 'images/silhouettes/placeholder.png';
        avatar.alt = senderInfo.identitaNaForu || 'Uživatel';
        const bubbleContainer = document.createElement('div');
        bubbleContainer.className = 'bubble-and-name-container';
        const name = document.createElement('div');
        name.className = 'message-sender-name';
        name.textContent = senderInfo.identitaNaForu || 'Neznámý uživatel';
        bubbleContainer.appendChild(name);
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${isSender ? 'sender' : 'recipient'}`;
        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = message.smazano ? '<em>Tato zpráva byla smazána.</em>' : (message.text || '');
        bubble.appendChild(content);
        const footer = document.createElement('div');
        footer.className = 'message-footer';
        const timestamp = document.createElement('span');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = message.casOdeslani ? formatMessageTimestamp(message.casOdeslani.toDate()) : '';
        footer.appendChild(timestamp);
        bubble.appendChild(footer);
        bubbleContainer.appendChild(bubble);
        wrapper.appendChild(bubbleContainer);
        wrapper.insertBefore(avatar, isSender ? null : bubbleContainer);
        return wrapper;
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        const p = document.createElement("p");
        p.textContent = str;
        return p.innerHTML;
    }

    function formatMessageTimestamp(date) {
        if (!date) return '';
        return date.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/,(?=\s)/g, '');
    }

    function formatDateSeparator(date) {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === today.toDateString()) return 'Dnes';
        if (date.toDateString() === yesterday.toDateString()) return 'Včera';
        return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function scrollToBottom() {
        setTimeout(() => {
             messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
    }
});
