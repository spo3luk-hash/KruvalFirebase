document.addEventListener('DOMContentLoaded', () => {
    const seznamUpozorneni = document.getElementById('seznam-upozorneni');
    const auth = firebase.auth();
    const db = firebase.firestore();

    let currentUser = null;
    let userForumIdentity = null;

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                userForumIdentity = userDoc.data().identitaNaForu;
                if(userForumIdentity) {
                    loadNotifications(userForumIdentity);
                } else {
                     seznamUpozorneni.innerHTML = '<p>Pro zobrazení upozornění si musíte nejprve <a href="vytvorit-identitu.html">vytvořit identitu</a>.</p>';
                }
            } else {
                 seznamUpozorneni.innerHTML = '<p>Uživatelský profil nenalezen.</p>';
            }
        } else {
            currentUser = null;
            userForumIdentity = null;
            seznamUpozorneni.innerHTML = '<p>Pro zobrazení upozornění se musíte <a href="login.html">přihlásit</a>.</p>';
        }
    });

    function loadNotifications(identity) {
        db.collection('upozorneniNaForu')
          .where('prijemceUpozorneniNaForu', '==', identity)
          .orderBy('casovaZnamka', 'desc')
          .onSnapshot(snapshot => {
              if (snapshot.empty) {
                  seznamUpozorneni.innerHTML = '<p>Žádná nová upozornění.</p>';
                  return;
              }

              let html = '';
              snapshot.forEach(doc => {
                  const upozorneni = doc.data();
                  const jePreceteno = upozorneni.precteno ? 'preceteno' : '';
                  const datum = upozorneni.casovaZnamka ? new Date(upozorneni.casovaZnamka.seconds * 1000).toLocaleString('cs-CZ') : 'neznámé datum';

                  // Správný odkaz na vlákno
                  const threadLink = `thread-view.html?cat=${upozorneni.idKategorie}&forum=${upozorneni.idFora}&thread=${upozorneni.idTematu}`;

                  html += `
                    <div class="notification-item ${jePreceteno}" data-id="${doc.id}">
                        <p><strong>${upozorneni.autorOdpovedi}</strong> odpověděl/a v tématu: <a href="${threadLink}">${upozorneni.nazevTematu}</a></p>
                        <div class="notification-meta">
                             <span class="timestamp">${datum}</span>
                             <button class="delete-notification-btn">Smazat</button>
                        </div>
                    </div>
                  `;
              });

              seznamUpozorneni.innerHTML = html;
              addEventListeners();

          }, error => {
              console.error("Chyba při načítání upozornění: ", error);
              seznamUpozorneni.innerHTML = '<p>Při načítání upozornění se vyskytla chyba.</p>';
          });
    }

    function addEventListeners() {
        document.querySelectorAll('.notification-item a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation(); // Zabráníme prokliknutí na rodičovský prvek
                const docId = e.target.closest('.notification-item').getAttribute('data-id');
                markAsRead(docId);
            });
        });

        document.querySelectorAll('.delete-notification-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const docId = e.target.closest('.notification-item').getAttribute('data-id');
                deleteNotification(docId);
            });
        });
    }

    function markAsRead(docId) {
        if (!docId) return;
        db.collection('upozorneniNaForu').doc(docId).update({ precteno: true });
    }

    function deleteNotification(docId) {
        if (!docId) return;
        db.collection('upozorneniNaForu').doc(docId).delete().catch(error => {
            console.error("Chyba při mazání upozornění: ", error);
        });
    }
});
