document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const newNotificationForm = document.getElementById('new-notification-form');
    const notificationList = document.getElementById('notification-list');

    // Vytvoření nového upozornění
    newNotificationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('notification-title').value;
        const content = document.getElementById('notification-content').value;

        db.collection('notifications').add({
            nazevUpozorneni: title,
            obsahUpozorneni: content,
            casVytvoreni: firebase.firestore.FieldValue.serverTimestamp(),
            typ: 'globalni' // Explicitní označení typu
        })
        .then(() => {
            newNotificationForm.reset();
            alert('Upozornění bylo úspěšně odesláno!');
            loadNotifications();
        })
        .catch(error => {
            console.error('Chyba při odesílání upozornění: ', error);
        });
    });

    // Načtení a zobrazení upozornění
    function loadNotifications() {
        notificationList.innerHTML = '<p>Načítám upozornění...</p>';
        // Načítáme pouze globální upozornění pro správu
        db.collection('notifications').where('typ', 'in', ['globalni', null]).orderBy('casVytvoreni', 'desc').get()
            .then(querySnapshot => {
                if (querySnapshot.empty) {
                    notificationList.innerHTML = '<p>Zatím zde nejsou žádná globální upozornění.</p>';
                    return;
                }

                let tableHtml = '<div class="notification-table">\
                                    <div class="notification-header">\
                                        <div class="notification-cell">Titulek</div>\
                                        <div class="notification-cell">Obsah</div>\
                                        <div class="notification-cell">Datum</div>\
                                        <div class="notification-cell">Akce</div>\
                                    </div>';
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    tableHtml += `
                        <div class="notification-row">
                            <div class="notification-cell" data-label="Titulek">${data.nazevUpozorneni}</div>
                            <div class="notification-cell" data-label="Obsah">${data.obsahUpozorneni}</div>
                            <div class="notification-cell" data-label="Datum">${data.casVytvoreni ? new Date(data.casVytvoreni.seconds * 1000).toLocaleString() : 'N/A'}</div>
                            <div class="notification-cell" data-label="Akce"><button class="delete-btn" data-id="${doc.id}">Smazat</button></div>
                        </div>
                    `;
                });
                tableHtml += '</div>';
                notificationList.innerHTML = tableHtml;
            })
            .catch(error => {
                console.error('Chyba při načítání upozornění: ', error);
                notificationList.innerHTML = '<p>Nepodařilo se načíst upozornění.</p>';
            });
    }

    // Smazání upozornění
    notificationList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            if (confirm('Opravdu chcete smazat toto upozornění?')) {
                db.collection('notifications').doc(id).delete()
                    .then(() => {
                        alert('Upozornění bylo smazáno.');
                        loadNotifications();
                    })
                    .catch(error => {
                        console.error('Chyba při mazání upozornění: ', error);
                    });
            }
        }
    });

    loadNotifications();
});
