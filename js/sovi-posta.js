document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const mailListContainer = document.getElementById('mail-list-container');
    const mailDetailContainer = document.getElementById('mail-detail-container');
    const placeholderMessage = document.getElementById('placeholder-message');
    const mailContent = document.getElementById('mail-content');
    const mailSender = document.getElementById('mail-sender');
    const mailDate = document.getElementById('mail-date');
    const mailBody = document.getElementById('mail-body');

    let activeCharacterRef = null;
    let allMessages = [];
    let mailListenerUnsubscribe = null;

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userDoc = await db.collection('hraci').doc(user.uid).get();
                if (userDoc.exists && userDoc.data().aktivniPostava) {
                    const characterId = userDoc.data().aktivniPostava;
                    activeCharacterRef = db.collection('hraci').doc(user.uid).collection('postavy').doc(characterId);
                    listenForMail();
                } else {
                    window.location.href = 'vyber-postavy.html';
                }
            } catch (error) {
                console.error("Chyba při inicializaci postavy: ", error);
                mailListContainer.innerHTML = '<div class="error-message">Nepodařilo se načíst data postavy.</div>';
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    function listenForMail() {
        if (!activeCharacterRef) return;
        if (mailListenerUnsubscribe) mailListenerUnsubscribe();

        const now = firebase.firestore.Timestamp.now();

        mailListenerUnsubscribe = db.collection('posta')
            .where('prijemcePath', '==', activeCharacterRef.path)
            .where('casDoruceni', '<=', now) 
            .orderBy('casDoruceni', 'desc')
            .onSnapshot(async (snapshot) => {
                const messagePromises = snapshot.docs.map(async doc => {
                    const msg = doc.data();
                    let senderName = 'Neznámý odesílatel';

                    if (msg.typ === 'specialni_svitek') {
                        senderName = msg.odesilatel;
                    } else if (msg.odesilatelPath) {
                        const senderDoc = await db.doc(msg.odesilatelPath).get();
                        if (senderDoc.exists) {
                            senderName = senderDoc.data().jmeno;
                        }
                    }

                    return {
                        id: doc.id,
                        ...msg,
                        senderName: senderName,
                        messageType: msg.typ === 'specialni_svitek' ? 'special_scroll' : 'regular'
                    };
                });

                allMessages = await Promise.all(messagePromises);
                renderMailList();

            }, (error) => {
                console.error("Chyba při načítání pošty: ", error);
                mailListContainer.innerHTML = '<div class="error-message">Chyba při komunikaci se sovincem.</div>';
            });
    }

    function renderMailList() {
        const selectedId = document.querySelector('.mail-item.selected')?.dataset.id;

        if (allMessages.length === 0) {
            mailListContainer.innerHTML = '<div class="no-mail">Žádné zprávy nebyly nalezeny.</div>';
            placeholderMessage.style.display = 'block';
            mailContent.style.display = 'none';
            return;
        }

        mailListContainer.innerHTML = allMessages.map(msg => `
            <div class="mail-item ${!msg.precteno ? 'unread' : ''} ${msg.messageType === 'special_scroll' ? 'special-scroll' : ''}" data-id="${msg.id}">
                <div class="mail-item-sender">
                    ${msg.messageType === 'special_scroll' ? `<i class="fas fa-scroll special-icon"></i>` : ''}
                    ${msg.senderName}
                </div>
                <div class="mail-item-date">${formatDate(msg.casDoruceni)}</div>
                 ${msg.predmet ? `<div class="mail-item-subject">${msg.predmet}</div>` : ''} 
            </div>
        `).join('');

        document.querySelectorAll('.mail-item').forEach(item => {
            item.addEventListener('click', () => showMailDetail(item.dataset.id));
        });

        if (selectedId && allMessages.some(m => m.id === selectedId)) {
             document.querySelector(`.mail-item[data-id="${selectedId}"]`).classList.add('selected');
        } else {
             placeholderMessage.style.display = 'block';
             mailContent.style.display = 'none';
        }
    }

    async function showMailDetail(messageId) {
        document.querySelectorAll('.mail-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.id === messageId);
        });

        const message = allMessages.find(m => m.id === messageId);
        if (!message) return;

        placeholderMessage.style.display = 'none';
        mailContent.style.display = 'block';
        
        mailContent.className = message.messageType === 'special_scroll' ? 'special-scroll-content' : '';

        mailSender.textContent = message.senderName;
        mailDate.textContent = `Doručeno: ${formatDate(message.casDoruceni, true)}`;
        
        let bodyHtml = message.predmet ? `<h3>${message.predmet}</h3>` : '';
        bodyHtml += message.obsah.replace(/\n/g, '<br>');

        // Přidání podpisu a pečetě
        if (message.podpis || message.pecet) {
            bodyHtml += '<div class="signature-section">';
            if (message.podpis) {
                bodyHtml += `<div class="signature">${message.podpis}</div>`;
            }
            if (message.pecet) {
                bodyHtml += `<div class="seal-icon" data-seal="${message.pecet}"></div>`;
            }
            bodyHtml += '</div>';
        }

        mailBody.innerHTML = bodyHtml;
        
        if (!message.precteno) {
            try {
                await db.collection('posta').doc(messageId).update({ precteno: true });
            } catch (error) {
                console.error("Chyba při označování zprávy jako přečtené: ", error);
            }
        }
    }

    function formatDate(timestamp, full = false) {
        if (!timestamp || !timestamp.toDate) return 'Neznámé datum';
        const date = timestamp.toDate();
        return full
            ? date.toLocaleString('cs-CZ', { dateStyle: 'long', timeStyle: 'short' })
            : date.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
});