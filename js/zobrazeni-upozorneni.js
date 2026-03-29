document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();
    let currentUser = null;

    const globalContainer = document.getElementById('global-notifications-container');
    const privateContainer = document.getElementById('private-notifications-container');
    const trashContainer = document.getElementById('trash-notifications-container');

    const tabs = {
        inbox: document.getElementById('inbox'),
        trash: document.getElementById('trash')
    };
    const tabButtons = document.querySelectorAll('.tab-button');

    const trashInfo = document.getElementById('trash-info');
    const emptyTrashBtn = document.getElementById('empty-trash-btn');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            for (const content of Object.values(tabs)) {
                content.style.display = 'none';
            }
            if (tabs[tabId]) {
                tabs[tabId].style.display = 'block';
            }
        });
    });

    function render(container, notifications, type) {
        if (!container) return;
        if (!notifications || notifications.length === 0) {
            container.innerHTML = `<div class="notification"><p>Nebyly nalezeny žádné zprávy.</p></div>`;
            return;
        }

        notifications.sort((a, b) => b.casVytvoreni.seconds - a.casVytvoreni.seconds);
        let html = '';
        notifications.forEach(data => {
            html += createNotificationHTML(data, type);
        });
        container.innerHTML = html;
    }

    function createNotificationHTML(data, type) {
        let content = data.obsahUpozorneni;
        if (data.link) {
            content += `<br><a href="${data.link}" class="notification-link">Zobrazit</a>`;
        }

        const deleteButton = type !== 'globalni' 
            ? `<button class="delete-notification-btn" data-id="${data.id}" title="Smazat zprávu"><i class="fas fa-trash-alt"></i></button>`
            : '';

        return `
            <div class="notification" id="notification-${data.id}">
                ${deleteButton}
                <h2>${data.nazevUpozorneni}</h2>
                <p>${content}</p>
                <span>${new Date(data.casVytvoreni.seconds * 1000).toLocaleString('cs-CZ')}</span>
            </div>
        `;
    }

    async function loadNotifications() {
        if (!currentUser) return;

        // Globální
        if (globalContainer) {
            globalContainer.innerHTML = '<p>Načítám...</p>';
            const globalSnapshot = await db.collection('notifications').where('typ', '==', 'globalni').get();
            const globalNotifications = globalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            render(globalContainer, globalNotifications, 'globalni');
        }

        // Soukromé a Koš (načteno najednou a roztříděno lokálně)
        if (privateContainer && trashContainer) {
            privateContainer.innerHTML = '<p>Načítám...</p>';
            trashContainer.innerHTML = '<p>Načítám...</p>';

            // OPRAVA: Načteme všechny zprávy pro hráče, bez ohledu na 'typ'.
            const allPrivateSnapshot = await db.collection('notifications')
                .where('hracId', '==', currentUser.uid)
                .get();

            const allPrivateNotifications = allPrivateSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const inboxNotifications = allPrivateNotifications.filter(n => n.stav !== 'smazano');
            const trashNotifications = allPrivateNotifications.filter(n => n.stav === 'smazano');
            
            render(privateContainer, inboxNotifications, 'soukrome');
            render(trashContainer, trashNotifications, 'smazane');
            updateTrashUI(trashNotifications.length);
        }
    }

    function updateTrashUI(count) {
        if (!trashInfo || !emptyTrashBtn) return;
        if (count > 0) {
            trashInfo.textContent = `V koši je ${count} zpráv${count === 1 ? 'a' : (count > 1 && count < 5 ? 'y' : '')}.`;
            emptyTrashBtn.disabled = false;
        } else {
            trashInfo.textContent = 'Koš je prázdný.';
            emptyTrashBtn.disabled = true;
        }
    }

    async function moveNotificationToTrash(id) {
        try {
            await db.collection('notifications').doc(id).update({ stav: 'smazano' });
            loadNotifications();
        } catch (error) {
            console.error("Chyba při přesouvání do koše: ", error);
        }
    }
    
    if (emptyTrashBtn) {
        emptyTrashBtn.addEventListener('click', async () => {
            if (!currentUser || !confirm('Opravdu chcete trvale smazat všechny zprávy v koši?')) return;
    
            const batch = db.batch();
            const snapshot = await db.collection('notifications')
                .where('hracId', '==', currentUser.uid)
                .where('stav', '==', 'smazano').get();
            
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
    
            try {
                await batch.commit();
                loadNotifications();
            } catch (error) {
                console.error("Chyba při vysypávání koše: ", error);
            }
        });
    }

    document.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-notification-btn');
        if (deleteBtn) {
            const notificationId = deleteBtn.dataset.id;
            moveNotificationToTrash(notificationId);
        }
    });

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadNotifications();
        } else {
            currentUser = null;
            if (globalContainer) globalContainer.innerHTML = ''; 
            if (privateContainer) privateContainer.innerHTML = '<div class="notification"><p>Pro zobrazení soukromých zpráv se musíte přihlásit.</p></div>';
            if (trashContainer) trashContainer.innerHTML = '';
        }
    });
});
