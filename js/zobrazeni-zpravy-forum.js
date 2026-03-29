document.addEventListener('DOMContentLoaded', () => {
    // --- REFERENCE NA ELEMENTY ---
    const recipientNameEl = document.getElementById('recipient-name');
    const messagesContainer = document.getElementById('messages-container');
    const replyForm = document.getElementById('message-reply-form');
    const replyContentEl = document.getElementById('reply-content');
    const pinnedMessageBar = document.getElementById('pinned-message-bar');
    const pinnedMessageContentEl = document.getElementById('pinned-message-content');
    const unpinBtn = pinnedMessageBar.querySelector('.unpin-button');

    // --- FIREBASE A STAVOVÉ PROMĚNNÉ ---
    const db = firebase.firestore();
    let currentUser = null;
    let conversationId = null;
    let conversationData = null;
    let messagesListener = null; 

    const Kruval = window.Kruval;
    if (typeof initializeEditor === "function") initializeEditor('reply-content');

    // --- INICIALIZACE ---
    const params = new URLSearchParams(window.location.search);
    conversationId = params.get('id');

    if (!conversationId) {
        messagesContainer.innerHTML = '<p class="error-message">Chybí ID konverzace.</p>';
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
    
    // --- FORMÁTOVÁNÍ DATA A ČASU ---
    function formatMessageTimestamp(date) {
        if (!date) return '';
        return date.toLocaleDateString('cs-CZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(/,(?=\s)/g, '');
    }

    function formatDateSeparator(date) {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === today.toDateString()) return 'Dnes';
        if (date.toDateString() === yesterday.toDateString()) return 'Včera';
        return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // --- HLAVNÍ FUNKCE ---

    function setupConversationListener() {
        db.collection('soukromeZpravyForum').doc(conversationId).onSnapshot(doc => {
            if (doc.exists) {
                const isFirstLoad = !conversationData;
                conversationData = doc.data();
                
                if (!conversationData.ucastnici.includes(currentUser.uid)) {
                    document.body.innerHTML = '<h1>Přístup odepřen</h1><p>Tuto konverzaci nemáte oprávnění zobrazit.</p>';
                    return;
                }

                const otherId = conversationData.ucastnici.find(uid => uid !== currentUser.uid);
                const otherInfo = conversationData.infoUcastniku[otherId];
                recipientNameEl.textContent = otherInfo ? otherInfo.identitaNaForu : 'Neznámý uživatel';
                document.title = `Konverzace s ${recipientNameEl.textContent} - Svět Durmstrangu`;
                
                updatePinnedMessageBar();

                if (isFirstLoad) {
                    loadAndMarkMessagesAsRead();
                }

            }
        }, error => console.error("Chyba při naslouchání konverzaci: ", error));
    }

    function loadAndMarkMessagesAsRead() {
        if (messagesListener) messagesListener();

        messagesListener = db.collection('soukromeZpravyForum').doc(conversationId)
          .collection('zpravy').orderBy('casOdeslani', 'asc')
          .onSnapshot(querySnapshot => {
              renderMessages(querySnapshot);
              scrollToBottom();

              // Po načtení označíme nepřečtené zprávy jako přečtené
              const batch = db.batch();
              querySnapshot.forEach(doc => {
                  const message = doc.data();
                  if (message.odesilatelId !== currentUser.uid && message.stav !== 'precteno') {
                      batch.update(doc.ref, { stav: 'precteno' });
                  }
              });
              batch.commit().catch(err => console.error("Chyba při aktualizaci stavu zpráv: ", err));
              
              // Také označíme celou konverzaci jako přečtenou pro aktuálního uživatele
               db.collection('soukromeZpravyForum').doc(conversationId).update({
                    neprectenoPro: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                }).catch(err => console.error("Chyba při označování konverzace jako přečtené: ", err));

          }, error => console.error("Chyba při načítání zpráv: ", error));
    }

    function renderMessages(querySnapshot) {
        messagesContainer.innerHTML = '';
        let lastMessageDate = null;
        querySnapshot.forEach(doc => {
            const msg = { ...doc.data(), id: doc.id };
            const msgDate = msg.casOdeslani ? msg.casOdeslani.toDate() : null;
            if (msgDate) {
                const msgDay = msgDate.toDateString();
                if (msgDay !== lastMessageDate) {
                    const separator = document.createElement('div');
                    separator.className = 'date-separator';
                    separator.textContent = formatDateSeparator(msgDate);
                    messagesContainer.appendChild(separator);
                    lastMessageDate = msgDay;
                }
            }
            messagesContainer.appendChild(createMessageBubble(msg));
        });
    }

    // --- PŘIPNUTÁ ZPRÁVA ---

    function updatePinnedMessageBar() {
        if (!conversationData) return;
        const pinnedMsg = conversationData.pripnutaZprava;
        if (pinnedMsg && pinnedMsg.text) {
            pinnedMessageContentEl.innerHTML = `<strong>${pinnedMsg.autor}</strong>: ${pinnedMsg.text.replace(/<[^>]+>/g, '')}`;
            pinnedMessageBar.classList.add('visible');
            pinnedMessageBar.style.display = 'flex';
            pinnedMessageBar.onclick = (e) => {
                if (e.target.closest('.unpin-button')) return;
                scrollToMessage(pinnedMsg.id);
            };
            unpinBtn.onclick = handleUnpinClick;
        } else {
            pinnedMessageBar.classList.remove('visible');
            pinnedMessageBar.style.display = 'none';
        }
    }

    function scrollToMessage(messageId) {
        const messageElement = document.querySelector(`.message-bubble-wrapper[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageElement.classList.add('highlight');
            setTimeout(() => messageElement.classList.remove('highlight'), 2000);
        }
    }

    // --- VYTVÁŘENÍ BUBLINY ZPRÁVY ---

    function createMessageBubble(message) {
        if (!conversationData || !conversationData.infoUcastniku) {
            const placeholder = document.createElement('div');
            placeholder.textContent = 'Načítání...';
            return placeholder;
        }

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

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';

        if (message.smazano) {
            bubble.classList.add('deleted-message');
            bubble.innerHTML = '<div class="message-content"><em>Tato zpráva byla smazána.</em></div>';
        } else {
            const content = document.createElement('div');
            content.className = 'message-content';
            content.innerHTML = message.text;

            const footer = createMessageFooter(message, isSender);

            bubble.appendChild(content);
            bubble.appendChild(footer);
        }
        
        bubbleContainer.appendChild(name);
        bubbleContainer.appendChild(bubble);
        
        wrapper.appendChild(avatar);
        wrapper.appendChild(bubbleContainer);

        return wrapper;
    }

    function createMessageFooter(message, isSender) {
        const footer = document.createElement('div');
        footer.className = 'message-footer';

        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        const formattedTimestamp = formatMessageTimestamp(message.casOdeslani?.toDate());
        const editedIndicator = message.casUpravy ? '<span class="edited-indicator">(upraveno)</span>' : '';
        
        let statusIndicator = '';
        if (isSender) {
            if (message.stav === 'precteno') {
                statusIndicator = '<span class="message-status-indicator read" title="Přečteno">✓✓</span>';
            } else {
                statusIndicator = '<span class="message-status-indicator sent" title="Odesláno">✓</span>';
            }
        }

        timestamp.innerHTML = `${formattedTimestamp} ${editedIndicator} ${statusIndicator}`;
        
        const controls = document.createElement('div');
        controls.className = 'message-controls';

        const pinBtn = createControlButton('pin', 'Připnout zprávu', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>');
        pinBtn.addEventListener('click', handlePinClick);
        controls.appendChild(pinBtn);

        if (isSender) {
            const editBtn = createControlButton('edit', 'Upravit zprávu', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>');
            const deleteBtn = createControlButton('delete', 'Smazat zprávu', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>');
            
            editBtn.addEventListener('click', handleEditClick);
            deleteBtn.addEventListener('click', handleDeleteClick);

            controls.appendChild(editBtn);
            controls.appendChild(deleteBtn);
        }
        
        footer.appendChild(timestamp);
        footer.appendChild(controls);
        return footer;
    }

    function createControlButton(action, title, svg) {
        const btn = document.createElement('button');
        btn.className = 'message-control-btn';
        btn.dataset.action = action;
        btn.title = title;
        btn.innerHTML = svg;
        return btn;
    }

    // --- OBSLUHA AKCÍ TLAČÍTEK ---

    async function handlePinClick(event) {
        const messageWrapper = event.currentTarget.closest('.message-bubble-wrapper');
        const messageId = messageWrapper.dataset.messageId;
        const messageRef = db.collection('soukromeZpravyForum').doc(conversationId).collection('zpravy').doc(messageId);
        
        const messageDoc = await messageRef.get();
        if (!messageDoc.exists) return;
        const message = messageDoc.data();

        const senderInfo = conversationData.infoUcastniku[message.odesilatelId];
        const authorName = senderInfo ? senderInfo.identitaNaForu : 'Neznámý';

        const pinnedData = {
            id: messageId,
            text: message.text,
            autor: authorName,
            cas: message.casOdeslani
        };

        await db.collection('soukromeZpravyForum').doc(conversationId).update({ pripnutaZprava: pinnedData });
    }

    function handleUnpinClick() {
        db.collection('soukromeZpravyForum').doc(conversationId).update({ 
            pripnutaZprava: firebase.firestore.FieldValue.delete()
        });
    }

    function handleEditClick(event) {
        const messageWrapper = event.currentTarget.closest('.message-bubble-wrapper');
        const messageBubble = messageWrapper.querySelector('.message-bubble');
        toggleEditMode(messageWrapper, messageBubble);
    }

    function handleDeleteClick(event) {
        const messageWrapper = event.currentTarget.closest('.message-bubble-wrapper');
        const messageId = messageWrapper.dataset.messageId;
    
        Kruval.forumAdmin.showConfirmation({
            title: 'Smazat zprávu?',
            text: 'Opravdu si přejete smazat tuto zprávu? Akce je nevratná.',
            confirmText: 'Smazat'
        }).then(() => {
            return db.collection('soukromeZpravyForum').doc(conversationId)
                     .collection('zpravy').doc(messageId).update({
                        text: "",
                        smazano: true,
                        casUpravy: firebase.firestore.FieldValue.serverTimestamp()
                     });
        }).catch(err => {
            if (err !== 'Uživatel zrušil akci') Kruval.forumAdmin.showAlert('Při mazání zprávy došlo k chybě.', 'error');
        });
    }
    
    function toggleEditMode(messageWrapper, messageBubble) {
        const footer = messageBubble.querySelector('.message-footer');
        const content = messageBubble.querySelector('.message-content');
        const existingEditContainer = messageBubble.querySelector('.message-edit-container');

        if (existingEditContainer) { // Zrušení úprav
            content.style.display = 'block';
            footer.style.display = 'flex';
            existingEditContainer.remove();
        } else { // Aktivace úprav
            content.style.display = 'none';
            footer.style.display = 'none';

            const editContainer = document.createElement('div');
            editContainer.className = 'message-edit-container';

            const editArea = document.createElement('div');
            editArea.className = 'message-edit-area';
            editArea.contentEditable = true;
            editArea.innerHTML = content.innerHTML;

            const editControls = document.createElement('div');
            editControls.className = 'message-edit-controls';
            const saveBtn = document.createElement('button');
            saveBtn.className = 'message-edit-save';
            saveBtn.textContent = 'Uložit';
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'message-edit-cancel';
            cancelBtn.textContent = 'Zrušit';

            saveBtn.onclick = () => saveMessageEdit(messageWrapper, editArea.innerHTML);
            cancelBtn.onclick = () => toggleEditMode(messageWrapper, messageBubble);

            editControls.appendChild(saveBtn);
            editControls.appendChild(cancelBtn);
            editContainer.appendChild(editArea);
            editContainer.appendChild(editControls);
            messageBubble.appendChild(editContainer);
            editArea.focus();
        }
    }

    function saveMessageEdit(messageWrapper, newContent) {
        const messageId = messageWrapper.dataset.messageId;
        if (!newContent.trim()) {
            Kruval.forumAdmin.showAlert('Zpráva nemůže být prázdná.', 'error');
            return;
        }
        db.collection('soukromeZpravyForum').doc(conversationId)
          .collection('zpravy').doc(messageId).update({
              text: newContent,
              casUpravy: firebase.firestore.FieldValue.serverTimestamp()
          })
          .catch(error => Kruval.forumAdmin.showAlert('Při ukládání úpravy došlo k chybě.', 'error'));
    }

    // --- ODESLÁNÍ ODPOVĚDI ---
    replyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const messageText = replyContentEl.innerHTML.trim();
        if (!messageText) return;

        const conversationRef = db.collection('soukromeZpravyForum').doc(conversationId);

        db.runTransaction(async (transaction) => {
            const convDoc = await transaction.get(conversationRef);
            if (!convDoc.exists) throw "Konverzace nenalezena!";

            const convData = convDoc.data();
            const otherId = convData.ucastnici.find(uid => uid !== currentUser.uid);

            transaction.set(conversationRef.collection('zpravy').doc(), {
                odesilatelId: currentUser.uid,
                text: messageText,
                casOdeslani: firebase.firestore.FieldValue.serverTimestamp(),
                stav: 'odeslano' // Přidán výchozí stav
            });

            transaction.update(conversationRef, {
                posledniZpravaText: messageText.replace(/<[^>]+>/g, '').substring(0, 50) + '...',
                casPosledniZpravy: firebase.firestore.FieldValue.serverTimestamp(),
                neprectenoPro: firebase.firestore.FieldValue.arrayUnion(otherId)
            });
        }).then(() => {
            replyContentEl.innerHTML = '';
        }).catch(error => Kruval.forumAdmin.showAlert("Při odesílání zprávy došlo k chybě.", "error"));
    });

    let userHasScrolled = false;
    messagesContainer.addEventListener('scroll', () => {
        if (messagesContainer.scrollTop + messagesContainer.clientHeight < messagesContainer.scrollHeight - 20) {
            userHasScrolled = true;
        } else {
            userHasScrolled = false;
        }
    });

    function scrollToBottom() {
        if (!userHasScrolled) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
});
