document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const hraciList = document.getElementById('hraci-list');
    const postavyList = document.getElementById('postavy-list');

    let currentUserId = null;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            loadHraci();
            loadPostavy();
        } else {
            window.location.href = 'index.html';
        }
    });

    async function addFriend(friendId, friendName) {
        if (!currentUserId || !friendId) return;

        const currentUserRef = db.collection('hraci').doc(currentUserId);
        const friendRef = db.collection('hraci').doc(friendId);

        try {
            await db.runTransaction(async (transaction) => {
                const currentUserDoc = await transaction.get(currentUserRef);
                if (!currentUserDoc.exists) {
                    throw "Current user not found!";
                }

                const friends = currentUserDoc.data().friends || [];
                if (!friends.includes(friendId)) {
                    friends.push(friendId);
                    transaction.update(currentUserRef, { friends: friends });

                    // Create a notification for the user who was added as a friend
                    const currentUserData = currentUserDoc.data();
                    const notification = {
                        type: 'new_friend',
                        fromUserId: currentUserId,
                        fromUserName: currentUserData.herniNick || 'Neznámý hráč',
                        message: `Hráč ${currentUserData.herniNick || 'Neznámý hráč'} si vás přidal do přátel.`,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        isRead: false,
                        link: `profil-hrace.html?id=${currentUserId}`
                    };
                    
                    await db.collection('hraci').doc(friendId).collection('notifications').add(notification);

                    alert(`Hráč ${friendName} byl přidán do vašich přátel.`);
                } else {
                    alert(`Hráč ${friendName} je již ve vašem seznamu přátel.`);
                }
            });
        } catch (error) {
            console.error("Error adding friend: ", error);
            alert("Nepodařilo se přidat přítele.");
        }
    }

    function loadHraci() {
        db.collection('hraci').get().then(snapshot => {
            if (snapshot.empty) {
                hraciList.innerHTML = '<p>Nenalezeni žádní hráči.</p>';
                return;
            }
            hraciList.innerHTML = '';
            snapshot.forEach(doc => {
                const hrac = doc.data();
                const hracId = doc.id;
                if(hracId === currentUserId) return; // Don't show the current user in the list

                const hracElement = document.createElement('div');
                hracElement.classList.add('list-item');
                hracElement.innerHTML = `
                    <h3>
                        ${hrac.herniNick || 'Uživatel'}
                        <a href="profil-hrace.html?id=${hracId}" class="profile-link" title="Zobrazit profil">
                            <i class="fas fa-eye"></i>
                        </a>
                        <a href="#" class="add-friend-link" data-id="${hracId}" data-name="${hrac.herniNick}" title="Přidat do přátel">
                            <i class="fas fa-user-plus"></i>
                        </a>
                    </h3>
                    <p><strong>Role:</strong> ${hrac.role || 'Nováček'}</p>
                `;
                hraciList.appendChild(hracElement);
            });

            // Add event listeners for the add friend links
            document.querySelectorAll('.add-friend-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const friendId = e.currentTarget.dataset.id;
                    const friendName = e.currentTarget.dataset.name;
                    addFriend(friendId, friendName);
                });
            });
        }).catch(err => {
            console.error("Chyba při načítání hráčů: ", err);
            hraciList.innerHTML = '<p>Došlo k chybě při načítání hráčů.</p>';
        });
    }

    function loadPostavy() {
        db.collectionGroup('postavy').get().then(snapshot => {
            if (snapshot.empty) {
                postavyList.innerHTML = '<p>Nenalezeny žádné postavy.</p>';
                return;
            }
            postavyList.innerHTML = '';
            snapshot.forEach(doc => {
                const postava = doc.data();
                const postavaId = postava.id;
                const postavaElement = document.createElement('div');
                postavaElement.classList.add('list-item');
                postavaElement.innerHTML = `
                    <h3>
                        ${postava.jmeno || 'Bezejmenná postava'}
                        <a href="profil-postavy.html?id=${postavaId}" class="profile-link" title="Zobrazit profil">
                            <i class="fas fa-eye"></i>
                        </a>
                    </h3>
                    <p><strong>Herní role:</strong> ${postava.herniRole || 'Nováček'}</p>
                    <p><strong>Původ:</strong> ${postava.puvod ? (postava.puvod.charAt(0).toUpperCase() + postava.puvod.slice(1)) : 'Neznámý'}</p>
                `;
                postavyList.appendChild(postavaElement);
            });
        }).catch(err => {
            console.error("Chyba při načítání postav: ", err);
            postavyList.innerHTML = '<p>Došlo k chybě při načítání postav.</p>';
        });
    }
});
