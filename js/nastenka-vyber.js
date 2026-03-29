
document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const openNastenkaBtn = document.getElementById('open-nastenka-btn');
    const nastenkaModal = document.getElementById('nastenka-modal');
    const closeNastenkaBtn = document.getElementById('close-nastenka-btn');
    const nastenkaContent = document.getElementById('nastenka-content');
    const newsNotificationBadge = document.getElementById('news-notification-badge');

    let currentUser = null;

    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
            checkForUnreadNews();
        } else {
            if(newsNotificationBadge) newsNotificationBadge.classList.add('hidden');
        }
    });

    if (openNastenkaBtn) {
        openNastenkaBtn.addEventListener('click', renderBulletinBoard);
    }
    if (closeNastenkaBtn) {
        closeNastenkaBtn.addEventListener('click', () => nastenkaModal.classList.add('hidden'));
    }
    window.addEventListener('click', (event) => {
        if (event.target === nastenkaModal) {
            nastenkaModal.classList.add('hidden');
        }
    });

    async function checkForUnreadNews() {
        if (!currentUser || !newsNotificationBadge) return;

        try {
            const snapshot = await db.collection('nastenka').where('category', '==', 'novinky').get();
            const unreadCount = snapshot.docs.filter(doc => {
                const post = doc.data();
                return !post.readBy || !post.readBy.includes(currentUser.uid);
            }).length;

            if (unreadCount > 0) {
                newsNotificationBadge.textContent = unreadCount;
                newsNotificationBadge.classList.remove('hidden');
            } else {
                newsNotificationBadge.classList.add('hidden');
            }
        } catch (error) {
            console.error("Chyba při kontrole nepřečtených novinek: ", error);
        }
    }

    async function renderBulletinBoard() {
        nastenkaModal.classList.remove('hidden');
        nastenkaContent.innerHTML = `<div class="loading-spinner">Načítám příspěvky...</div>`;

        if (!currentUser) {
            nastenkaContent.innerHTML = '<p class="error-text">Pro zobrazení nástěnky se musíš přihlásit.</p>';
            return;
        }

        try {
            const snapshot = await db.collection('nastenka').orderBy('createdAt', 'desc').get();
            const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const boardContainer = document.createElement('div');
            boardContainer.className = 'bulletin-board';
            boardContainer.innerHTML = `
                <div class="bulletin-board-nav">
                    <button class="tab-btn active" data-tab="novinky">Seznam novinek</button>
                    <button class="tab-btn" data-tab="nonrp">Non-RP Informace</button>
                </div>
                <div class="bulletin-board-content">
                    <div id="tab-novinky" class="tab-pane active"></div>
                    <div id="tab-nonrp" class="tab-pane"></div>
                </div>
            `;

            nastenkaContent.innerHTML = ''; 
            nastenkaContent.appendChild(boardContainer);

            const novinkyContainer = boardContainer.querySelector('#tab-novinky');
            const nonrpContainer = boardContainer.querySelector('#tab-nonrp');
            const formatTimestamp = ts => ts ? ts.toDate().toLocaleDateString('cs-CZ') : 'Neznámo';

            const novinkyPosts = posts.filter(p => p.category === 'novinky');
            const nonrpPosts = posts.filter(p => p.category === 'nonrp');

            let unreadCount = 0;

            novinkyContainer.innerHTML = novinkyPosts.length > 0 ? novinkyPosts.map(post => {
                const isUnread = !post.readBy || !post.readBy.includes(currentUser.uid);
                if (isUnread) unreadCount++;

                return `
                <div class="post-item" data-post-id="${post.id}">
                    <div class="post-item-header">
                        <h3>${post.title}</h3>
                        <div style="display: flex; align-items: center;">
                            ${isUnread ? '<span class="new-post-badge">Nové</span>' : ''}
                            ${isUnread ? `<button class="mark-as-read-btn" title="Označit jako přečtené" data-post-id="${post.id}"><i class="fas fa-eye"></i></button>` : ''}
                        </div>
                    </div>
                    <p>${post.content.replace(/\n/g, '<br>')}</p>
                    <span class="post-meta">Vydal: ${post.author} | ${formatTimestamp(post.createdAt)}</span>
                </div>
            `;
            }).join('') : '<p class="placeholder-text">Žádné novinky k zobrazení.</p>';
            
            if (newsNotificationBadge) {
                if (unreadCount > 0) {
                    newsNotificationBadge.textContent = unreadCount;
                    newsNotificationBadge.classList.remove('hidden');
                } else {
                    newsNotificationBadge.classList.add('hidden');
                }
            }

            nonrpContainer.innerHTML = nonrpPosts.length > 0 ? nonrpPosts.map(post => `
                <div class="post-item">
                    <h3>${post.title}</h3>
                    <p>${post.content.replace(/\n/g, '<br>')}</p>
                    <span class="post-meta">Vydal: ${post.author} | ${formatTimestamp(post.createdAt)}</span>
                </div>
            `).join('') : '<p class="placeholder-text">Žádné non-RP informace k zobrazení.</p>';

            setupTabSwitching(boardContainer);
            setupMarkAsReadButtons(novinkyContainer);

        } catch (error) {
            console.error("Chyba při načítání nástěnky: ", error);
            nastenkaContent.innerHTML = '<p class="error-text">Nepodařilo se načíst nástěnku. Zkuste to prosím znovu později.</p>';
        }
    }

    function setupTabSwitching(container) {
        const tabButtons = container.querySelectorAll('.tab-btn');
        const tabPanes = container.querySelectorAll('.tab-pane');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const targetTab = button.getAttribute('data-tab');
                tabPanes.forEach(pane => {
                    pane.classList.toggle('active', pane.id === 'tab-' + targetTab);
                });
            });
        });
    }

    function setupMarkAsReadButtons(container) {
        container.querySelectorAll('.mark-as-read-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const postId = button.dataset.postId;
                await markPostAsRead(postId);
            });
        });
    }

    async function markPostAsRead(postId) {
        if (!currentUser) return;

        try {
            const postRef = db.collection('nastenka').doc(postId);
            await postRef.update({
                readBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });

            // Update UI without full reload
            const postElement = nastenkaContent.querySelector(`.post-item[data-post-id="${postId}"]`);
            if (postElement) {
                const badge = postElement.querySelector('.new-post-badge');
                const button = postElement.querySelector('.mark-as-read-btn');
                if (badge) badge.remove();
                if (button) button.remove();
            }

            // Check remaining unread posts and update the main badge
            await checkForUnreadNews();

        } catch (error) {
            console.error("Chyba při označování příspěvku jako přečteného: ", error);
        }
    }
});
