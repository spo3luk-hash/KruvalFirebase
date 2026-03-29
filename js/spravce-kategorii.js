document.addEventListener('DOMContentLoaded', () => {
    const categoryManagerContainer = document.getElementById('category-manager-container');
    if (!categoryManagerContainer) return;

    const db = firebase.firestore();

    // --- DELEGOVANÉ EVENT LISTENERY ---
    categoryManagerContainer.addEventListener('click', (event) => {
        const target = event.target;
        const createBtn = target.closest('.create-forum-btn');
        const editCategoryBtn = target.closest('.edit-category-btn');
        const deleteCategoryBtn = target.closest('.delete-category-btn');
        const editForumBtn = target.closest('.edit-forum-btn');
        const deleteForumBtn = target.closest('.delete-forum-btn');
        const editThreadBtn = target.closest('.edit-thread-btn');
        const deleteThreadBtn = target.closest('.delete-thread-btn');
        const editPostBtn = target.closest('.edit-post-btn');
        const deletePostBtn = target.closest('.delete-post-btn');

        if (createBtn) {
            const categoryId = createBtn.closest('.forums-container').dataset.categoryId;
            if (categoryId) {
                const createForumEvent = new CustomEvent('showCreateForumModalRequest', { bubbles: true, detail: { categoryId } });
                createBtn.dispatchEvent(createForumEvent);
                return;
            }
        } else if (editCategoryBtn) {
            const categoryId = editCategoryBtn.closest('.category-item').dataset.id;
            if (categoryId) {
                const editEvent = new CustomEvent('editCategoryRequest', { bubbles: true, detail: { categoryId } });
                editCategoryBtn.dispatchEvent(editEvent);
            }
        } else if (deleteCategoryBtn) {
            const categoryItem = deleteCategoryBtn.closest('.category-item');
            const categoryId = categoryItem.dataset.id;
            const categoryName = categoryItem.querySelector('.item-title').textContent;
            if (categoryId) {
                const deleteEvent = new CustomEvent('deleteCategoryRequest', {
                    bubbles: true,
                    detail: { categoryId, categoryName }
                });
                deleteCategoryBtn.dispatchEvent(deleteEvent);
            }
        } else if (editForumBtn) {
            const forumItem = editForumBtn.closest('.forum-item');
            const { id: forumId, categoryId } = forumItem.dataset;
            if (forumId && categoryId) {
                const editEvent = new CustomEvent('editForumRequest', { bubbles: true, detail: { categoryId, forumId } });
                editForumBtn.dispatchEvent(editEvent);
            }
        } else if (deleteForumBtn) {
            const forumItem = deleteForumBtn.closest('.forum-item');
            const { id: forumId, categoryId } = forumItem.dataset;
            const forumName = forumItem.querySelector('.item-title').textContent;
            if (forumId && categoryId) {
                const deleteEvent = new CustomEvent('deleteForumRequest', { 
                    bubbles: true, 
                    detail: { categoryId, forumId, forumName } 
                });
                deleteForumBtn.dispatchEvent(deleteEvent);
            }
        } else if (editThreadBtn) {
            const threadItem = editThreadBtn.closest('.thread-item');
            const forumItem = threadItem.closest('.forum-item');
            const { id: threadId } = threadItem.dataset;
            const { categoryId, id: forumId } = forumItem.dataset;
            if (threadId && forumId && categoryId) {
                const editEvent = new CustomEvent('editThreadRequest', { bubbles: true, detail: { categoryId, forumId, threadId } });
                editThreadBtn.dispatchEvent(editEvent);
            }
        } else if (deleteThreadBtn) {
            const threadItem = deleteThreadBtn.closest('.thread-item');
            const forumItem = threadItem.closest('.forum-item');
            const { id: threadId } = threadItem.dataset;
            const { categoryId, id: forumId } = forumItem.dataset;
            const threadName = threadItem.querySelector('.item-title').textContent;
            if (threadId && forumId && categoryId) {
                const deleteEvent = new CustomEvent('deleteThreadRequest', { 
                    bubbles: true, 
                    detail: { categoryId, forumId, threadId, threadName } 
                });
                deleteThreadBtn.dispatchEvent(deleteEvent);
            }
        } else if (editPostBtn) {
            const postItem = editPostBtn.closest('[data-id]');
            const threadItem = postItem.closest('.thread-item');
            const forumItem = threadItem.closest('.forum-item');
            const { id: postId } = postItem.dataset;
            const { id: threadId } = threadItem.dataset;
            const { categoryId, id: forumId } = forumItem.dataset;
            if (postId && threadId && forumId && categoryId) {
                const editEvent = new CustomEvent('editPostRequest', { bubbles: true, detail: { categoryId, forumId, threadId, postId } });
                editPostBtn.dispatchEvent(editEvent);
            }
        } else if (deletePostBtn) {
            const postItem = deletePostBtn.closest('[data-id]');
            const threadItem = postItem.closest('.thread-item');
            const forumItem = threadItem.closest('.forum-item');
            const { id: postId } = postItem.dataset;
            const { id: threadId } = threadItem.dataset;
            const { categoryId, id: forumId } = forumItem.dataset;
            const isInitialPost = postItem.classList.contains('initial-post-item');
            if (postId && threadId && forumId && categoryId) {
                const deleteEvent = new CustomEvent('deletePostRequest', { 
                    bubbles: true, 
                    detail: { categoryId, forumId, threadId, postId, isInitialPost } 
                });
                deletePostBtn.dispatchEvent(deleteEvent);
            }
        }
    });

    // --- LISTENERY PRO ZPĚTNOU VAZBU ---
    document.addEventListener('forumCreated', e => loadForumsForCategory(e.detail.categoryId));
    document.addEventListener('categoryUpdated', e => {
        const { categoryId, newName, newDescription } = e.detail;
        const el = document.querySelector(`.category-item[data-id="${categoryId}"]`);
        if (el) {
            el.querySelector('h3.item-title').textContent = newName;
            el.querySelector('p.item-description').textContent = newDescription;
        }
    });
    document.addEventListener('forumUpdated', e => {
        const { forumId, newName, newDescription } = e.detail;
        const el = document.querySelector(`.forum-item[data-id="${forumId}"]`);
        if (el) {
            el.querySelector('h4.item-title').textContent = newName;
            el.querySelector('p.item-description').textContent = newDescription;
        }
    });
    document.addEventListener('threadUpdated', e => {
        const el = document.querySelector(`.thread-item[data-id="${e.detail.threadId}"] h5.item-title`);
        if (el) el.textContent = e.detail.newName;
    });
    document.addEventListener('postUpdated', e => {
        const el = document.querySelector(`[data-id="${e.detail.postId}"] .post-content`);
        if (el) el.textContent = e.detail.newContent;
    });
    document.addEventListener('postDeleted', e => {
        const { postId, threadId } = e.detail;
        const postElement = document.querySelector(`.reply-item[data-id="${postId}"]`);
        if (postElement) postElement.remove();
        const threadElement = document.querySelector(`.thread-item[data-id="${threadId}"]`);
        if (threadElement) {
            const repliesSpan = threadElement.querySelector('.item-meta span:last-child strong');
            if (repliesSpan) {
                const currentCount = parseInt(repliesSpan.textContent, 10);
                if (!isNaN(currentCount)) repliesSpan.textContent = Math.max(0, currentCount - 1);
            }
        }
    });
    document.addEventListener('threadDeleted', e => {
        const threadElement = document.querySelector(`.thread-item[data-id="${e.detail.threadId}"]`);
        if (threadElement) threadElement.remove();
    });
    document.addEventListener('forumDeleted', e => {
        const forumElement = document.querySelector(`.forum-item[data-id="${e.detail.forumId}"]`);
        if (forumElement) forumElement.remove();
    });
    document.addEventListener('categoryDeleted', e => {
        const categoryElement = document.querySelector(`.category-item[data-id="${e.detail.categoryId}"]`);
        if (categoryElement) categoryElement.remove();
    });

    // ... (zbytek souboru zůstává stejný)
    // --- HLAVNÍ INICIALIZAČNÍ FUNKCE ---
    async function initCategoryManager() {
        categoryManagerContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Načítám správce kategorií...</div>';
        await loadCategories();
    }

    document.addEventListener('showCreateCategoryModalRequest', showCreateCategoryModal);

    // --- NAČÍTÁNÍ DAT ---
    async function loadCategories() {
        try {
            const snapshot = await db.collection('forum_categories').orderBy('poradi').get();
            if (snapshot.empty) {
                categoryManagerContainer.innerHTML = '<p class="empty-state">Žádné kategorie nebyly nalezeny.</p>';
                return;
            }
            const html = snapshot.docs.map(doc => renderCategory(doc.id, doc.data())).join('');
            categoryManagerContainer.innerHTML = html;
            snapshot.docs.forEach(doc => loadForumsForCategory(doc.id));
        } catch (error) {
            console.error("Chyba při načítání kategorií: ", error);
            categoryManagerContainer.innerHTML = '<p class="error-message">Chyba při načítání kategorií.</p>';
        }
    }

    async function loadForumsForCategory(categoryId) {
        const container = document.querySelector(`.forums-container[data-category-id="${categoryId}"]`);
        if (!container) return;
        container.innerHTML = '<div class="loading-spinner-small"><i class="fas fa-spinner fa-spin"></i></div>';
        try {
            const snapshot = await db.collection('forum_categories').doc(categoryId).collection('fora').orderBy('poradi').get();
            let html = snapshot.docs.map(doc => renderForum(doc.id, categoryId, doc.data())).join('');
            if (snapshot.empty) {
                 html = '<button class="admin-button create-forum-btn"><i class="fas fa-plus-circle"></i> Vytvořit fórum</button>';
            } else {
                 html += '<button class="admin-button create-forum-btn" style="margin-top: 10px;"><i class="fas fa-plus-circle"></i> Přidat další fórum</button>';
            }
            container.innerHTML = html;
            snapshot.docs.forEach(doc => loadThreadsForForum(categoryId, doc.id));
        } catch (error) {
            console.error(`Chyba při načítání fór pro kategorii ${categoryId}: `, error);
            container.innerHTML = '<p class="error-message">Chyba při načítání fór.</p>';
        }
    }

    async function loadThreadsForForum(categoryId, forumId) {
        const container = document.querySelector(`.threads-container[data-forum-id="${forumId}"]`);
        if(!container) return;
        container.innerHTML = '<div class="loading-spinner-small"><i class="fas fa-spinner fa-spin"></i></div>';
        try {
            const snapshot = await db.collection('forum_categories').doc(categoryId).collection('fora').doc(forumId).collection('temata').orderBy('posledniPrispevek', 'desc').get();
            if (snapshot.empty) {
                container.innerHTML = '<p class="empty-state">V tomto fóru zatím nejsou žádná témata.</p>';
                return;
            }
            const promises = snapshot.docs.map(doc => renderThread(doc.id, doc.data()));
            const html = (await Promise.all(promises)).join('');
            container.innerHTML = `<div class="thread-list">${html}</div>`;
            snapshot.docs.forEach(doc => loadPostsForThread(categoryId, forumId, doc.id));
        } catch (error) {
            console.error(`Chyba při načítání témat pro fórum ${forumId}: `, error);
            container.innerHTML = '<p class="error-message">Chyba při načítání témat.</p>';
        }
    }

    async function loadPostsForThread(categoryId, forumId, threadId) {
        const container = document.querySelector(`.posts-container[data-thread-id="${threadId}"]`);
        if(!container) return;
        container.innerHTML = '<div class="loading-spinner-small"><i class="fas fa-spinner fa-spin"></i></div>';
        try {
            const snapshot = await db.collection('forum_categories').doc(categoryId).collection('fora').doc(forumId).collection('temata').doc(threadId).collection('prispevky').orderBy('cas', 'asc').get();
            if (snapshot.empty) {
                 container.innerHTML = '<p class="empty-state">Žádné příspěvky.</p>';
                 return;
            }
            const allPosts = snapshot.docs;
            const initialPostDoc = allPosts.shift();
            const replies = allPosts;
            let html = '';
            if (initialPostDoc) {
                html += await renderPost(initialPostDoc, true);
            }
            if (replies.length > 0) {
                 html += `<h6 class="replies-title">Odpovědi (${replies.length})</h6>`;
                 const promises = replies.map(doc => renderPost(doc, false));
                 html += `<div class="reply-list">${(await Promise.all(promises)).join('')}</div>`;
            }
            container.innerHTML = html;
        } catch (error) {
            console.error(`Chyba při načítání příspěvků pro téma ${threadId}: `, error);
            container.innerHTML = '<p class="error-message">Chyba při načítání.</p>';
        }
    }

    // --- RENDEROVACÍ FUNKce ---
    function renderCategory(id, data) {
        return `
            <div class="category-item" data-id="${id}">
                <div class="item-header category-header">
                    <div>
                        <h3 class="item-title">${data.nazev}</h3>
                        <p class="item-description">${data.popis || ''}</p>
                    </div>
                    <div class="item-actions">
                        <button class="action-btn edit-category-btn" title="Upravit kategorii"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete-category-btn" title="Smazat kategorii"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
                <div class="forums-container" data-category-id="${id}"></div>
            </div>
        `;
    }

    function renderForum(id, categoryId, data) {
        return `
            <div class="forum-item" data-id="${id}" data-category-id="${categoryId}">
                <div class="item-header forum-header">
                    <div>
                        <h4 class="item-title">${data.nazev}</h4>
                        <p class="item-description">${data.popis || ''}</p>
                    </div>
                    <div class="item-actions">
                        <button class="action-btn edit-forum-btn" title="Upravit fórum"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete-forum-btn" title="Smazat fórum"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
                <div class="threads-container" data-forum-id="${id}"></div>
            </div>
        `;
    }

    async function renderThread(id, data) {
        const authorName = await getAuthorName(data.autorId);
        const createdAt = data.posledniPrispevek ? data.posledniPrispevek.toDate().toLocaleString('cs-CZ') : 'N/A';
        return `
            <div class="thread-item" data-id="${id}">
                <div class="item-header thread-header">
                    <div>
                        <h5 class="item-title">${data.nazev}</h5>
                        <div class="item-meta">
                            <span>Založil: <strong>${authorName}</strong>, ${createdAt}</span>
                            <span>Počet odpovědí: <strong>${data.odpovedi || 0}</strong></span>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="action-btn edit-thread-btn" title="Upravit téma"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete-thread-btn" title="Smazat téma"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
                <div class="posts-container" data-thread-id="${id}"></div>
            </div>
        `;
    }

    async function renderPost(doc, isInitial) {
        const post = doc.data();
        const authorName = await getAuthorName(post.autorId);
        const postClass = isInitial ? 'initial-post-item' : 'reply-item';
        const title = isInitial ? `<h6>Úvodní příspěvek (Autor: <strong>${authorName}</strong>)</h6>` : `<div class="reply-meta"><strong>${authorName}</strong> odpověděl:</div>`;
        return `
            <div class="${postClass}" data-id="${doc.id}">
                ${title}
                <div class="post-content">${post.obsah}</div>
                <div class="item-actions">
                    <button class="action-btn edit-post-btn" title="Upravit příspěvek"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-post-btn" title="Smazat příspěvek"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
    }

    // --- POMOCNÉ FUNKCE ---
    const authorNamesCache = {};
    async function getAuthorName(authorId) {
        if (!authorId) return 'Neznámý autor';
        if (authorNamesCache[authorId]) return authorNamesCache[authorId];
        try {
            const userDoc = await db.collection('users').doc(authorId).get();
            if (userDoc.exists) {
                const userName = userDoc.data().identitaNaForu || 'Anonym';
                authorNamesCache[authorId] = userName;
                return userName;
            }
             const hracDoc = await db.collection('hraci').doc(authorId).get();
            if (hracDoc.exists) {
                const userName = hracDoc.data().identitaNaForu || 'Anonym';
                authorNamesCache[authorId] = userName;
                return userName;
            }
        } catch (error) {
            console.error("Chyba při načítání jména autora: ", error);
        }
        return 'Neznámý autor';
    }

    function showCreateCategoryModal() {
        const modalContent = `<h2>Vytvořit novou kategorii</h2><form id="create-category-form"><div class="form-group"><label for="category-name">Název kategorie</label><input type="text" id="category-name" required></div><div class="form-group"><label for="category-description">Popis</label><textarea id="category-description" rows="3"></textarea></div><div class="form-actions"><button type="submit" class="admin-button">Vytvořit</button><button type="button" class="admin-button secondary-button" id="cancel-category-creation">Zrušit</button></div></form>`;
        Kruval.forumAdmin.showModal(modalContent);
        document.getElementById('create-category-form').addEventListener('submit', handleCreateCategorySubmit);
        document.getElementById('cancel-category-creation').addEventListener('click', () => Kruval.forumAdmin.closeModal());
    }

    async function handleCreateCategorySubmit(event) {
        event.preventDefault();
        const name = document.getElementById('category-name').value;
        const description = document.getElementById('category-description').value;
        if (!name.trim()) {
            Kruval.forumAdmin.showAlert('Název kategorie nesmí být prázdný.', 'error');
            return;
        }
        try {
            const ref = db.collection('forum_categories');
            const snapshot = await ref.orderBy('poradi', 'desc').limit(1).get();
            const nextOrder = snapshot.empty ? 1 : snapshot.docs[0].data().poradi + 1;
            await ref.add({ nazev: name, popis: description, poradi: nextOrder });
            Kruval.forumAdmin.closeModal();
            Kruval.forumAdmin.showAlert('Kategorie byla úspěšně vytvořena.', 'success');
            await loadCategories();
        } catch (error) {
            console.error("Chyba při vytváření kategorie: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při vytváření kategorie.', 'error');
        }
    }
    
    // --- SPUŠTĚNÍ ---
    initCategoryManager();
});