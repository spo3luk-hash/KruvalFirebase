
document.addEventListener('DOMContentLoaded', () => {
    // Zkontrolujeme, zda jsme na stránce, kde se správa nástěnky reálně nachází
    const nastenkaSection = document.getElementById('sprava-nastenky');
    if (!nastenkaSection) {
        return; // Pokud ne, skript se nespustí
    }

    const db = firebase.firestore();
    const auth = firebase.auth();

    let currentAdminNick = 'Admin';
    let editPostId = null;

    // Odkazy na DOM elementy formuláře
    const addPostBtn = document.getElementById('add-post-btn');
    const postFormContainer = document.getElementById('post-form-container');
    const postForm = document.getElementById('post-form');
    const postFormTitle = document.getElementById('post-form-title');
    const cancelPostEditBtn = document.getElementById('cancel-post-edit');
    const nastenkaPostsList = document.getElementById('nastenka-posts-list');
    const postTitleInput = document.getElementById('post-title');
    const postContentInput = document.getElementById('post-content');
    const postCategoryInput = document.getElementById('post-category');

    // Inicializace po ověření uživatele
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('hraci').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    currentAdminNick = doc.data().herniNick || 'Admin';
                }
                initializeNastenkaManager();
            }).catch(error => {
                console.error("Chyba při načítání jména admina: ", error);
                initializeNastenkaManager(); // Pokračujeme i v případě chyby s defaultním jménem
            });
        }
    });

    function initializeNastenkaManager() {
        setupHandlers();
        loadPosts();
    }

    function setupHandlers() {
        addPostBtn.addEventListener('click', () => showForm(null));
        cancelPostEditBtn.addEventListener('click', () => hideForm());
        postForm.addEventListener('submit', handleFormSubmit);
    }

    function showForm(post) {
        editPostId = post ? post.id : null;
        postFormTitle.textContent = post ? 'Upravit příspěvek' : 'Nový příspěvek';
        postForm.reset();
        if (post) {
            postTitleInput.value = post.title;
            postContentInput.value = post.content;
            postCategoryInput.value = post.category;
        }
        postFormContainer.classList.remove('hidden');
        addPostBtn.classList.add('hidden');
    }

    function hideForm() {
        postFormContainer.classList.add('hidden');
        addPostBtn.classList.remove('hidden');
        editPostId = null;
        postForm.reset();
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const title = postTitleInput.value.trim();
        const content = postContentInput.value.trim();
        const category = postCategoryInput.value;

        if (!title || !content) {
            alert('Titulek a obsah nesmí být prázdné.');
            return;
        }

        const postData = {
            title,
            content,
            category,
            author: currentAdminNick,
        };

        try {
            if (editPostId) {
                postData.lastUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('nastenka').doc(editPostId).update(postData);
                alert('Příspěvek byl úspěšně aktualizován.');
            } else {
                postData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('nastenka').add(postData);
                alert('Příspěvek byl úspěšně přidán.');
            }
            hideForm();
            loadPosts();
        } catch (error) {
            console.error("Chyba při ukládání příspěvku: ", error);
            alert('Při ukládání příspěvku došlo k chybě.');
        }
    }

    async function loadPosts() {
        nastenkaPostsList.innerHTML = '<p>Načítám příspěvky...</p>';
        try {
            const snapshot = await db.collection('nastenka').orderBy('createdAt', 'desc').get();
            if (snapshot.empty) {
                nastenkaPostsList.innerHTML = '<div class="placeholder-content"><p>Zatím nebyly vytvořeny žádné příspěvky.</p></div>';
                return;
            }
            renderList(snapshot.docs);
        } catch (error) {
            console.error("Chyba při načítání příspěvků z nástěnky: ", error);
            nastenkaPostsList.innerHTML = '<p class="error-text">Chyba při načítání příspěvků.</p>';
        }
    }

    function renderList(docs) {
        const formatTimestamp = (ts) => {
            if (!ts) return 'Neznámo';
            const date = ts.toDate ? ts.toDate() : new Date(ts);
            return date.toLocaleString('cs-CZ');
        };

        const postsHtml = docs.map(doc => {
            const post = { id: doc.id, ...doc.data() };
            const categoryText = post.category === 'novinky' ? 'Novinky (RP)' : 'Non-RP Informace';
            return `
                <div class="post-item-admin" data-id="${post.id}">
                    <div class="post-details">
                        <h4>${post.title}</h4>
                        <p>${post.content.substring(0, 100)}...</p>
                        <div class="post-meta-admin">
                            <span class="category ${post.category}">${categoryText}</span>
                            <span><strong>Autor:</strong> ${post.author}</span>
                            <span><strong>Vytvořeno:</strong> ${formatTimestamp(post.createdAt)}</span>
                        </div>
                    </div>
                    <div class="post-actions">
                        <button class="edit-btn small-btn" title="Upravit"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn small-btn danger" title="Smazat"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');
        nastenkaPostsList.innerHTML = postsHtml;
        addListActionListeners();
    }

    function addListActionListeners() {
        nastenkaPostsList.querySelectorAll('.post-item-admin').forEach(item => {
            const postId = item.dataset.id;
            const editBtn = item.querySelector('.edit-btn');
            const deleteBtn = item.querySelector('.delete-btn');

            if (editBtn) {
                editBtn.addEventListener('click', async () => {
                    try {
                        const doc = await db.collection('nastenka').doc(postId).get();
                        if (doc.exists) {
                            showForm({ id: doc.id, ...doc.data() });
                        } else {
                            alert('Příspěvek nebyl nalezen.');
                        }
                    } catch (error) {
                        console.error("Chyba při načítání příspěvku pro úpravu: ", error);
                        alert('Při načítání příspěvku došlo k chybě.');
                    }
                });
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    // Globální funkce openConfirmationModal je definovaná v admin-centrum.js
                    if (window.openConfirmationModal) {
                        window.openConfirmationModal('Opravdu smazat tento příspěvek?', () => deletePost(postId));
                    } else {
                        if (confirm('Opravdu smazat tento příspěvek?')) {
                            deletePost(postId);
                        }
                    }
                });
            }
        });
    }

    async function deletePost(postId) {
        try {
            await db.collection('nastenka').doc(postId).delete();
            alert('Příspěvek byl smazán.');
            loadPosts();
        } catch (error) {
            console.error("Chyba při mazání příspěvku: ", error);
            alert('Při mazání příspěvku došlo k chybě.');
        }
    }
});
