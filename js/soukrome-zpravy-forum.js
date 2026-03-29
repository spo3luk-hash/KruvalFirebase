document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT REFERENCES (moved inside DOMContentLoaded) ---
    const conversationsListContainer = document.getElementById('conversations-list-container');
    const noConversationsMessage = document.getElementById('no-conversations-message');
    const newMessageModal = document.getElementById('new-message-modal');
    const newMessageBtn = document.getElementById('new-message-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const newMessageForm = document.getElementById('new-message-form');
    const recipientInputContainer = document.getElementById('recipient-input-container');
    const recipientPillsContainer = document.getElementById('recipient-pills-container');
    const recipientSearchInput = document.getElementById('recipient-search');
    const searchResultsContainer = document.getElementById('search-results-container');
    const groupNameInputContainer = document.getElementById('group-name-input-container');
    const newMessageContent = document.getElementById('new-message-content');

    // Check if on the correct page before proceeding
    if (!conversationsListContainer) {
        // This script is not on the main messages page, do nothing.
        return;
    }

    // --- STATE AND FIREBASE ---
    const db = firebase.firestore();
    let currentUser = null;
    let currentUserProfile = null;
    let selectedRecipients = [];

    // --- INITIALIZATION ---
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            db.collection('users').doc(currentUser.uid).get().then(doc => {
                if (doc.exists) currentUserProfile = doc.data();
            });
            loadConversations();
            setupModalListeners(); // Now this is safe
        } else {
            window.location.href = 'index.html'; 
        }
    });

    // --- RENDER CONVERSATIONS ---
    function loadConversations() {
        db.collection('soukromeZpravyForum')
          .where('ucastnici', 'array-contains', currentUser.uid)
          .orderBy('casPosledniZpravy', 'desc')
          .onSnapshot(handleConversationsSnapshot, (err) => {
              console.error("Chyba při načítání konverzací: ", err);
              noConversationsMessage.textContent = 'Při načítání vašich zpráv se vyskytla chyba.';
              noConversationsMessage.style.display = 'block';
          });
    }

    function handleConversationsSnapshot(querySnapshot) {
        conversationsListContainer.innerHTML = '';
        if (querySnapshot.empty) {
            noConversationsMessage.style.display = 'block';
            return;
        }
        noConversationsMessage.style.display = 'none';
        querySnapshot.forEach(doc => {
            conversationsListContainer.appendChild(createConversationElement(doc.data(), doc.id));
        });
    }
    
    function createConversationElement(conversation, conversationId) {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        if (conversation.neprectenoPro && Array.isArray(conversation.neprectenoPro) && conversation.neprectenoPro.includes(currentUser.uid)) {
            item.classList.add('unread');
        }

        let avatarSrc, name, lastMessage;
        const isGroup = conversation.typ === 'skupinova';
        const conversationType = isGroup ? 'Skupinová' : 'Soukromá';

        if (isGroup) {
            avatarSrc = conversation.ikonaSkupiny || 'images/silhouettes/group-placeholder.png';
            name = conversation.jmenoSkupiny || 'Skupinová konverzace';
        } else {
            const otherId = conversation.ucastnici.find(uid => uid !== currentUser.uid);
            const otherInfo = conversation.infoUcastniku[otherId] || { identitaNaForu: 'Neznámý', avatarNaForu: 'images/silhouettes/placeholder.png' };
            avatarSrc = otherInfo.avatarNaForu;
            name = otherInfo.identitaNaForu;
        }

        lastMessage = conversation.posledniZpravaText || '...';
        const timestamp = (window.formatDate && conversation.casPosledniZpravy) ? window.formatDate(conversation.casPosledniZpravy.toDate()) : '';
        const isPinned = conversation.pripnutaZprava && conversation.pripnutaZprava.id;
        const pinnedIndicatorHTML = isPinned ? `<div class="pinned-indicator-list" title="Připnutá zpráva"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>` : '';

        item.innerHTML = `
            <div class="conversation-avatar"><img src="${avatarSrc}" alt="Avatar"></div>
            <div class="conversation-summary">
                <div class="conversation-recipient">${name} <span class="conversation-type">(${conversationType})</span></div>
                <div class="conversation-last-message">${lastMessage}</div>
            </div>
            <div class="conversation-meta">
                ${pinnedIndicatorHTML}
                <div class="conversation-timestamp"><span class="timestamp">${timestamp}</span></div>
            </div>
        `;
        item.onclick = () => {
            const url = isGroup ? `zobrazeni-skupinove-zpravy.html?id=${conversationId}` : `zobrazeni-zpravy-forum.html?id=${conversationId}`;
            window.location.href = url;
        };
        return item;
    }

    // --- MODAL & NEW MESSAGE/GROUP ---
    function setupModalListeners() {
        newMessageBtn.addEventListener('click', openNewMessageModal);
        closeModalBtn.addEventListener('click', closeNewMessageModal);
        window.addEventListener('click', e => {
            if (e.target === newMessageModal) closeNewMessageModal();
        });

        let searchTimeout;
        recipientSearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(searchUsers, 300);
        });

        newMessageForm.addEventListener('submit', handleNewMessageSubmit);
        recipientInputContainer.addEventListener('click', () => recipientSearchInput.focus());
    }

    function openNewMessageModal() {
        resetNewMessageModal();
        newMessageModal.style.display = 'flex';
        recipientSearchInput.focus();
    }

    function closeNewMessageModal() {
        newMessageModal.style.display = 'none';
    }

    function resetNewMessageModal() {
        selectedRecipients = [];
        recipientPillsContainer.innerHTML = '';
        recipientSearchInput.value = '';
        newMessageContent.value = '';
        groupNameInputContainer.style.display = 'none';
        document.getElementById('group-name').value = '';
    }

    async function searchUsers() {
        const query = recipientSearchInput.value.trim();
        searchResultsContainer.innerHTML = '';
        if (query.length < 2) return;

        const snapshot = await db.collection('users').where('identitaNaForu', '>=', query).where('identitaNaForu', '<=', query + 'uf8ff').limit(5).get();
        snapshot.forEach(doc => {
            const isAlreadySelected = selectedRecipients.some(r => r.id === doc.id);
            if (doc.id !== currentUser.uid && !isAlreadySelected) {
                const user = doc.data();
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                resultItem.textContent = user.identitaNaForu;
                resultItem.onclick = () => selectRecipient(user, doc.id);
                searchResultsContainer.appendChild(resultItem);
            }
        });
    }

    function selectRecipient(user, userId) {
        selectedRecipients.push({ id: userId, name: user.identitaNaForu });
        recipientSearchInput.value = '';
        searchResultsContainer.innerHTML = '';
        renderRecipientPills();
        recipientSearchInput.focus();
    }

    function renderRecipientPills() {
        recipientPillsContainer.innerHTML = '';
        selectedRecipients.forEach(recipient => {
            const pill = document.createElement('div');
            pill.className = 'recipient-pill';
            pill.textContent = recipient.name;
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-pill';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeRecipient(recipient.id);
            };
            pill.appendChild(removeBtn);
            recipientPillsContainer.appendChild(pill);
        });
        // Show/hide group name input
        groupNameInputContainer.style.display = selectedRecipients.length > 1 ? 'block' : 'none';
    }

    function removeRecipient(userId) {
        selectedRecipients = selectedRecipients.filter(r => r.id !== userId);
        renderRecipientPills();
    }

    async function handleNewMessageSubmit(e) {
        e.preventDefault();
        const text = newMessageContent.value.trim();
        if (selectedRecipients.length === 0 || !text) {
            if (Kruval && Kruval.forumAdmin) Kruval.forumAdmin.showAlert('Vyberte prosím alespoň jednoho adresáta a napište zprávu.', 'warning');
            return;
        }

        try {
            if (selectedRecipients.length === 1) {
                // --- LOGIKA PRO SOUKROMOU ZPRÁVU (1-on-1) ---
                const recipientId = selectedRecipients[0].id;
                const participants = [currentUser.uid, recipientId].sort();
                const existingConvoQuery = await db.collection('soukromeZpravyForum').where('typ', '==', 'soukroma').where('ucastnici', '==', participants).limit(1).get();
                
                let convoId;
                if (!existingConvoQuery.empty) {
                    convoId = existingConvoQuery.docs[0].id;
                    await updateExistingConversation(convoId, text, recipientId);
                } else {
                    convoId = await createNewPrivateConversation(recipientId, text);
                }
                window.location.href = `zobrazeni-zpravy-forum.html?id=${convoId}`;

            } else {
                // --- LOGIKA PRO SKUPINOVOU ZPRÁVU ---
                const groupName = document.getElementById('group-name').value.trim();
                if (!groupName) {
                    if (Kruval && Kruval.forumAdmin) Kruval.forumAdmin.showAlert('Zadejte prosím název skupiny.', 'warning');
                    return;
                }
                if (typeof createNewGroupConversation === 'function') {
                    const recipientIds = selectedRecipients.map(r => r.id);
                    const newGroupId = await createNewGroupConversation(groupName, recipientIds, text);
                    if(newGroupId) window.location.href = `zobrazeni-skupinove-zpravy.html?id=${newGroupId}`;
                } else {
                    console.error('Funkce pro vytvoření skupiny nebyla nalezena!');
                    if (Kruval && Kruval.forumAdmin) Kruval.forumAdmin.showAlert('Chyba: Funkce pro vytvoření skupiny není k dispozici.', 'error');
                }
            }
        } catch (error) {
            console.error("Chyba při odesílání zprávy: ", error);
            if (Kruval && Kruval.forumAdmin) Kruval.forumAdmin.showAlert('Při odesílání zprávy došlo k chybě.', 'error');
        }
    }

    async function updateExistingConversation(convoId, text, recipientId) {
        const batch = db.batch();
        const convoRef = db.collection('soukromeZpravyForum').doc(convoId);
        const messageRef = convoRef.collection('zpravy').doc();

        batch.set(messageRef, { odesilatelId: currentUser.uid, text, casOdeslani: firebase.firestore.FieldValue.serverTimestamp(), stav: 'odeslano' });
        batch.update(convoRef, { casPosledniZpravy: firebase.firestore.FieldValue.serverTimestamp(), posledniZpravaText: text.substring(0, 50), neprectenoPro: firebase.firestore.FieldValue.arrayUnion(recipientId) });
        
        await batch.commit();
    }

    async function createNewPrivateConversation(recipientId, text) {
        const recipientDoc = await db.collection('users').doc(recipientId).get();
        if (!recipientDoc.exists || !currentUserProfile) throw new Error('Příjemce nebo profil odesílatele nebyl nalezen.');
        const recipientProfile = recipientDoc.data();

        const conversationRef = db.collection('soukromeZpravyForum').doc();
        const messageRef = conversationRef.collection('zpravy').doc();
        const batch = db.batch();

        batch.set(conversationRef, {
            typ: 'soukroma',
            ucastnici: [currentUser.uid, recipientId].sort(),
            casVytvoreni: firebase.firestore.FieldValue.serverTimestamp(),
            casPosledniZpravy: firebase.firestore.FieldValue.serverTimestamp(),
            posledniZpravaText: text.substring(0, 50),
            infoUcastniku: {
                [currentUser.uid]: { identitaNaForu: currentUserProfile.identitaNaForu, avatarNaForu: currentUserProfile.avatarNaForu || 'images/silhouettes/placeholder.png' },
                [recipientId]: { identitaNaForu: recipientProfile.identitaNaForu, avatarNaforu: recipientProfile.avatarNaForu || 'images/silhouettes/placeholder.png' }
            },
            neprectenoPro: [recipientId]
        });

        batch.set(messageRef, { odesilatelId: currentUser.uid, text, casOdeslani: firebase.firestore.FieldValue.serverTimestamp(), stav: 'odeslano' });
        
        await batch.commit();
        return conversationRef.id;
    }
});