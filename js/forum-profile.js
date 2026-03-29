document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const profilePanel = document.getElementById('forum-profile-panel');
    const createIdentityBtn = document.getElementById('create-identity-btn');
    const notificationBell = document.getElementById('notification-bell');
    const notificationCount = document.getElementById('notification-count');
    const privateMessagesLink = document.getElementById('private-messages-link'); // Přidáno

    let notificationsListener = null;

    async function listenForNotifications(user) {
        if (notificationsListener) notificationsListener();

        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) return;
        const userData = userDoc.data();
        const userForumIdentity = userData.identitaNaForu;

        if (!userForumIdentity) return;

        const notificationsRef = db.collection('upozorneniNaForu')
            .where('prijemceUpozorneniNaForu', '==', userForumIdentity)
            .where('precteno', '==', false);

        notificationsListener = notificationsRef.onSnapshot(snapshot => {
            const unreadCount = snapshot.size;
            notificationCount.textContent = unreadCount;
            notificationCount.style.display = unreadCount > 0 ? 'block' : 'none';
            
            // Zobrazíme obě ikony, pokud má uživatel identitu
            notificationBell.style.display = 'inline-block';
            privateMessagesLink.style.display = 'inline-block'; // Přidáno

        }, error => {
            console.error("Chyba při sledování upozornění: ", error);
        });
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            listenForNotifications(user);

            const userRef = db.collection('users').doc(user.uid);
            userRef.onSnapshot((doc) => { 
                if (doc.exists && doc.data().identitaNaForu) {
                    profilePanel.style.display = 'block';
                    createIdentityBtn.style.display = 'none';

                    const userData = doc.data();
                    const profileHeader = profilePanel.querySelector('#profile-name');
                    const profileAvatar = document.getElementById('profile-avatar');
                    const profileTopics = document.getElementById('profile-threads');
                    const profilePosts = document.getElementById('profile-posts');
                    const profileReplies = document.getElementById('profile-replies');
                    const profileSignature = document.getElementById('profile-signature');

                    profileHeader.textContent = userData.identitaNaForu;
                    profileAvatar.src = userData.avatarNaForu || 'images/silhouettes/placeholder.png';
                    profileSignature.textContent = userData.podpisNaForu || 'Uživatel nemá nastavený podpis.';
                    
                    const stats = userData.forumStats || {};
                    const topicCount = stats.pocetTemat || 0;
                    const replyCount = stats.pocetOdpovedi || 0;
                    const postCount = topicCount + replyCount;

                    profileTopics.textContent = topicCount;
                    profilePosts.textContent = postCount;
                    profileReplies.textContent = replyCount;

                    // --- LOGIKA PRO ZOBRAZENÍ VÍCE ROLÍ ---
                    const roleContainer = document.getElementById('profile-role-container');
                    const roleSpan = document.getElementById('profile-role');

                    const displayUserRoles = async () => {
                        const roleIds = userData.roleNaForu;
                        if (Array.isArray(roleIds) && roleIds.length > 0) {
                            const rolePromises = roleIds.map(roleId => ForumUtils.getRoleName(db, roleId));
                            const roleNames = await Promise.all(rolePromises);
                            
                            const validRoleNames = roleNames.filter(name => name !== null);

                            if (validRoleNames.length > 0) {
                                // KAŽDÁ ROLE BUDE V DIVU, ABY SE ZOBRAZILA POD SEBOU
                                roleSpan.innerHTML = validRoleNames.map(name => `<div><span class="role-badge">${name}</span></div>`).join('');
                                roleContainer.style.display = 'block';
                            } else {
                                roleContainer.style.display = 'none';
                            }
                        } else {
                            roleContainer.style.display = 'none';
                        }
                    };
                    displayUserRoles();
                    // --- KONEC LOGIKY PRO VÍCE ROLÍ ---

                } else {
                    profilePanel.style.display = 'none';
                    createIdentityBtn.style.display = 'block';
                }
            }, error => {
                console.error("Chyba při naslouchání změn identity uživatele: ", error);
            });
        } else {
            profilePanel.style.display = 'none';
            createIdentityBtn.style.display = 'none';
            notificationBell.style.display = 'none';
            privateMessagesLink.style.display = 'none'; // Přidáno pro skrytí při odhlášení
            if (notificationsListener) notificationsListener();
        }
    });

    createIdentityBtn.addEventListener('click', () => {
        window.location.href = 'vytvorit-identitu.html';
    });
});