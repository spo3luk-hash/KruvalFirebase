document.addEventListener('DOMContentLoaded', async function () {
    const db = firebase.firestore();
    const auth = firebase.auth();
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('cat');
    const forumId = params.get('forum');
    const threadId = params.get('thread');

    const threadTitleElement = document.getElementById('thread-title');
    const initialPostContainer = document.getElementById('initial-post-container');
    const postsContainer = document.getElementById('posts-container');
    const replyContainer = document.getElementById('reply-container');
    const backLink = document.getElementById('back-to-forum-link');
    const controlsContainer = document.getElementById('thread-controls-container');
    const pollContainer = document.getElementById('poll-container'); 

    let currentUser = null;
    let currentUserData = null; 

    if (!categoryId || !forumId || !threadId) {
        threadTitleElement.textContent = 'Chyba';
        postsContainer.innerHTML = '<h2>Chybí potřebné identifikátory (kategorie, fórum nebo téma).</h2>';
        if (backLink) backLink.href = 'forum.html';
        return;
    }

    if (backLink) {
        backLink.href = `forum-view.html?cat=${categoryId}&forum=${forumId}`;
    }

    const threadRef = db.collection('forum_categories').doc(categoryId).collection('fora').doc(forumId).collection('temata').doc(threadId);

    const userCache = {};
    async function getUserData(userId) {
        if (userCache[userId]) {
            return userCache[userId];
        }

        try {
            const userRef = db.collection('users').doc(userId);
            const hraciRef = db.collection('hraci').doc(userId);

            const [userDoc, hraciDoc] = await Promise.all([userRef.get(), hraciRef.get()]);

            let userData = {};

            if (userDoc.exists) {
                userData = userDoc.data();
            } else {
                userData = {
                    identitaNaForu: 'Neznámý autor',
                    podpisNaForu: '',
                    avatarNaForu: 'img/avatars/char_placeholder.png'
                };
            }

            if (hraciDoc.exists) {
                const hraciData = hraciDoc.data();
                userData.role = hraciData.role || 'user';
            } else {
                userData.role = 'user';
            }
            
            userData.roleNaForu = Array.isArray(userData.roleNaForu) ? userData.roleNaForu : [];

            userCache[userId] = userData;
            return userData;

        } catch (error) {
            console.error("Chyba při načítání dat uživatele: ", error);
            return {
                identitaNaForu: 'Neznámý autor',
                podpisNaForu: '',
                avatarNaForu: 'img/avatars/char_placeholder.png',
                roleNaForu: [],
                role: 'user'
            };
        }
    }

    function parseContent(content) {
        function bbcodeToHtml(bbcode) {
            let text = bbcode.replace(/\n/g, '<br>');

            const stack = [];
            let result = '';
            let lastIndex = 0;

            const regex = /(\[quote author="(.*?)"\])|(\[\/quote\])/g;
            let match;

            while ((match = regex.exec(text)) !== null) {
                const plainText = text.substring(lastIndex, match.index);
                
                if (stack.length > 0) {
                    stack[stack.length - 1].children.push(plainText);
                } else {
                    result += plainText;
                }

                if (match[1]) { // Opening tag
                    const quoteNode = {
                        author: match[2],
                        children: []
                    };
                    if (stack.length > 0) {
                        stack[stack.length - 1].children.push(quoteNode);
                    }
                    stack.push(quoteNode);
                } else if (match[3]) { // Closing tag
                    if (stack.length > 1) {
                        const completedNode = stack.pop();
                    } else if (stack.length === 1) {
                        const rootNode = stack.pop();
                        result += renderNode(rootNode);
                    } 
                }
                lastIndex = regex.lastIndex;
            }
            
            const remainingText = text.substring(lastIndex);
            if (stack.length > 0) {
                stack[stack.length - 1].children.push(remainingText);
            } else {
                result += remainingText;
            }

            while (stack.length > 0) {
                 const rootNode = stack.pop();
                 result = renderNode(rootNode) + result;
            }

            return result;
        }

        function renderNode(node) {
            if (typeof node === 'string') {
                return node;
            }

            const childrenHtml = node.children.map(child => renderNode(child)).join('');
            return `<blockquote class="forum-quote"><cite>Napsal/a ${node.author}:</cite><p>${childrenHtml}</p></blockquote>`;
        }

        return bbcodeToHtml(content);
    }

    
    async function renderPost(post, postId, threadData, isInitialPost = false) {
        const authorData = post.authorData;
        const authorName = authorData.identitaNaForu || 'Neznámý autor';
        const authorSignature = authorData.podpisNaForu || '';
        const authorAvatar = authorData.avatarNaForu || 'img/avatars/char_placeholder.png';
        
        let controlsHtml = '';
        // Ovládací prvky pro autora příspěvku
        if (currentUser && currentUser.uid === post.autorId) {
            const editButton = `<button class="edit-post-btn" data-post-id="${postId}" title="Upravit"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>`;
            let deleteButton = '';
            if (!isInitialPost) {
                deleteButton = `<button class="delete-post-btn" data-post-id="${postId}" title="Smazat"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>`;
            }
            controlsHtml += editButton + deleteButton;
        }
        
        // Tlačítko pro citaci zobrazíme jen pokud téma není zamčené
        if (currentUser && !threadData.zamceno) {
            const quoteButton = `<button class="quote-post-btn" data-post-id="${postId}" data-author-name="${authorName}" title="Citovat"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 2v6c0 7 4 8 7 8Z"></path><path d="M21 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2h-4c-1.25 0-2 .75-2 2v6c0 7 4 8 7 8Z"></path></svg></button>`;
            controlsHtml += quoteButton;
        }


        let editedHtml = '';
        if (post.upravenoDne) {
            editedHtml = `<span class="edited-timestamp">Upraveno: ${post.upravenoDne.toDate().toLocaleString('cs-CZ')}</span>`;
        }

        let initialPostBadge = ''; // Zde bude štítek
        if (isInitialPost) {
            initialPostBadge = '<span class="initial-post-badge">Úvodní příspěvek</span>';
        }

        let authorRoleHtml = '';
        const roleIds = authorData.roleNaForu;
        if (roleIds.length > 0) {
            const rolePromises = roleIds.map(roleId => ForumUtils.getRoleName(db, roleId));
            const roleNames = await Promise.all(rolePromises);
            const validRoleNames = roleNames.filter(name => name !== null);

            if (validRoleNames.length > 0) {
                authorRoleHtml = validRoleNames.map(name => `<div><span class="post-author-role">${name}</span></div>`).join('');
            }
        }

        let signatureHtml = '';
        if (authorSignature) {
            signatureHtml = `
                <div class="post-signature">
                    <hr>
                    <p>${authorSignature}</p>
                </div>
            `;
        }

        return `
            <div class="post" id="post-${postId}">
                <div class="author-profile">
                    <img src="${authorAvatar}" alt="Avatar autora" class="avatar">
                    <div class="author-details">
                        <span class="post-author">${authorName}</span>
                        ${authorRoleHtml}
                    </div>
                </div>
                <div class="post-body">
                    <div class="post-header">
                        ${initialPostBadge} 
                        <span class="post-timestamp">${post.cas.toDate().toLocaleString('cs-CZ')}</span>
                        <div class="post-controls">${controlsHtml}</div>
                    </div>
                    <div class="post-content" data-post-id="${postId}" data-raw-content="${post.obsah.replace(/"/g, '&quot;')}">
                        ${parseContent(post.obsah)}
                    </div>
                    <div class="post-footer">
                        ${editedHtml}
                    </div>
                    ${signatureHtml}
                </div>
            </div>
        `;
    }

    async function loadThread() {
        initialPostContainer.innerHTML = '<h2>Načítání...</h2>';
        postsContainer.innerHTML = '';
        if (controlsContainer) {
            controlsContainer.innerHTML = '';
        }
        if (pollContainer) {
            pollContainer.innerHTML = '';
        }

        try {
            const threadDoc = await threadRef.get();
            if (threadDoc.exists) {
                const threadData = threadDoc.data();
                threadTitleElement.textContent = threadData.nazev;
                
                if (currentUserData) {
                    if (window.Kruval && window.Kruval.forumLocking) {
                        window.Kruval.forumLocking.initialize(db, currentUserData, threadData, threadId);
                    }
                    if (window.Kruval && window.Kruval.threadFollowing) {
                        window.Kruval.threadFollowing.initialize(db, currentUserData, threadData, threadRef);
                    }
                    if (threadData.typ === 'anketa' && window.Kruval && window.Kruval.pollSystem) {
                        window.Kruval.pollSystem.initialize(db, currentUser, threadRef, threadData, pollContainer);
                    }
                }

                const postsRef = threadRef.collection('prispevky').orderBy('cas', 'asc');
                const postsSnapshot = await postsRef.get();
                
                if (postsSnapshot.empty) {
                    initialPostContainer.innerHTML = '<h2>V tomto tématu zatím nejsou žádné příspěvky.</h2>';
                    return;
                }

                const allPosts = [];
                for (const postDoc of postsSnapshot.docs) {
                    const postData = postDoc.data();
                    postData.id = postDoc.id;
                    postData.authorData = await getUserData(postData.autorId);
                    allPosts.push(postData);
                }

                const initialPost = allPosts.shift();
                initialPostContainer.innerHTML = await renderPost(initialPost, initialPost.id, threadData, true);
                
                if (allPosts.length > 0) {
                    const replyPromises = allPosts.map(reply => renderPost(reply, reply.id, threadData));
                    const repliesHtml = (await Promise.all(replyPromises)).join('');
                    postsContainer.innerHTML = repliesHtml;
                } else {
                    postsContainer.innerHTML = '<p style="text-align:center; color: #8b93b0;">Zatím zde nejsou žádné odpovědi.</p>';
                }

            } else {
                threadTitleElement.textContent = 'Téma nenalezeno';
                initialPostContainer.innerHTML = '<h2>Téma nebylo nalezeno.</h2>';
            }
        } catch (error) {
            console.error("Chyba při načítání tématu: ", error);
            threadTitleElement.textContent = 'Chyba';
            initialPostContainer.innerHTML = '<h2>Došlo k chybě při načítání příspěvků.</h2>';
        }
    }

    function showReplyForm() {
        replyContainer.innerHTML = `
            <form id="reply-form">
                <h3>Napsat odpověď</h3>
                <textarea id="reply-content" name="reply-content" rows="8" required></textarea>
                <button type="submit" id="submit-reply-btn">Odeslat odpověď</button>
                <p id="reply-error-message" class="error-message"></p>
            </form>
        `;
        
        // ✨ INICIALIZACE NOVÉHO EDITORU
        if (window.Kruval && window.Kruval.forumEditor) {
            window.Kruval.forumEditor.initialize('reply-content');
        }

        const replyForm = document.getElementById('reply-form');
        replyForm.addEventListener('submit', handleReplySubmit);
    }
    
    async function vytvorUpozorneniNaForu(authorIdentity) {
        const threadDoc = await threadRef.get();
        if (!threadDoc.exists) return;

        const threadData = threadDoc.data();
        const followerIdentities = threadData.seznamSledujicichIdentit || [];

        const notificationPromises = followerIdentities.map(followerIdentity => {
            if (followerIdentity === authorIdentity) return null;

            const notificationRef = db.collection('upozorneniNaForu').doc();
            return notificationRef.set({
                idTematu: threadId,
                idKategorie: categoryId,
                idFora: forumId,
                nazevTematu: threadData.nazev,
                autorOdpovedi: authorIdentity,
                prijemceUpozorneniNaForu: followerIdentity,
                casovaZnamka: firebase.firestore.FieldValue.serverTimestamp(),
                precteno: false
            });
        }).filter(p => p !== null);

        if (notificationPromises.length > 0) {
            await Promise.all(notificationPromises);
        }
    }

    async function handleReplySubmit(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('submit-reply-btn');
        const errorMessage = document.getElementById('reply-error-message');
        
        // ✨ ZÍSKÁNÍ OBSAHU Z EDITORU
        const content = window.Kruval.forumEditor.getContent().trim();
        
        if (!content) {
            errorMessage.textContent = 'Obsah odpovědi nesmí být prázdný.';
            return;
        }
        if (!currentUserData || !currentUserData.identitaNaForu) {
             errorMessage.textContent = 'Pro odeslání odpovědi potřebujete platnou identitu na fóru.';
            return;
        }

        submitBtn.disabled = true;
        errorMessage.textContent = '';

        try {
            await threadRef.collection('prispevky').add({
                obsah: content,
                autorId: currentUser.uid,
                cas: firebase.firestore.FieldValue.serverTimestamp()
            });

            const forumRef = db.collection('forum_categories').doc(categoryId).collection('fora').doc(forumId);
            await db.runTransaction(async (transaction) => {
                const threadDoc = await transaction.get(threadRef);
                const forumDoc = await transaction.get(forumRef);

                if (!threadDoc.exists || !forumDoc.exists) throw "Téma nebo fórum neexistuje!";
                
                transaction.update(threadRef, {
                    odpovedi: (threadDoc.data().odpovedi || 0) + 1,
                    posledniPrispevek: firebase.firestore.FieldValue.serverTimestamp()
                });

                transaction.update(forumRef, {
                    pocetPrispevku: (forumDoc.data().pocetPrispevku || 0) + 1,
                    posledniAktivita: {
                        temaId: threadId,
                        temaNazev: threadDoc.data().nazev,
                        autorId: currentUser.uid,
                        cas: firebase.firestore.FieldValue.serverTimestamp(),
                    }
                 });
            });

            const userRef = db.collection('users').doc(currentUser.uid);
            await userRef.update({
                'forumStats.pocetOdpovedi': firebase.firestore.FieldValue.increment(1)
            });

            await vytvorUpozorneniNaForu(currentUserData.identitaNaForu);

            location.reload();

        } catch (error) {
            console.error('Chyba při odesílání odpovědi: ', error);
            errorMessage.textContent = 'Při odesílání odpovědi došlo k chybě.';
            submitBtn.disabled = false;
        }
    }

    function handleEditClick(e) {
        const editButton = e.target.closest('.edit-post-btn');
        if (!editButton) return;

        const postId = editButton.dataset.postId;
        const postContentElement = document.querySelector(`.post-content[data-post-id='${postId}']`);
        const rawContent = postContentElement.dataset.rawContent;
        
        // ✨ Místo textarea inicializujeme editor i pro úpravy
        const editorContainer = document.createElement('div');
        postContentElement.innerHTML = ''; 
        postContentElement.appendChild(editorContainer);
        
        const tempTextarea = document.createElement('textarea');
        const tempId = `edit-area-${postId}`;
        tempTextarea.id = tempId;
        tempTextarea.style.display = 'none';
        tempTextarea.value = rawContent;
        editorContainer.appendChild(tempTextarea);
        
        window.Kruval.forumEditor.initialize(tempId);

        const controls = document.createElement('div');
        controls.innerHTML = `
            <button class="save-edit-btn" data-post-id="${postId}">Uložit</button>
            <button class="cancel-edit-btn" data-post-id="${postId}">Zrušit</button>
        `;
        postContentElement.appendChild(controls);
    }

    async function handleSaveClick(e) {
        if (!e.target.classList.contains('save-edit-btn')) return;

        const postId = e.target.dataset.postId;
        // ✨ Získání obsahu z editoru pro úpravy
        const newContent = window.Kruval.forumEditor.getContent();

        try {
            const postRef = threadRef.collection('prispevky').doc(postId);
            await postRef.update({
                obsah: newContent,
                upravenoDne: firebase.firestore.FieldValue.serverTimestamp()
            });
            loadThread();
        } catch (error) {
            console.error("Chyba při ukládání úprav: ", error);
        }
    }

    function handleCancelClick(e) {
        if (!e.target.classList.contains('cancel-edit-btn')) return;
        loadThread();
    }
    
    async function handleDeleteClick(e) {
        const deleteButton = e.target.closest('.delete-post-btn');
        if (!deleteButton) return;

        const postId = deleteButton.dataset.postId;

        try {
            await Kruval.forumAdmin.showConfirmation({
                title: 'Smazat příspěvek',
                text: 'Opravdu si přejete smazat tento příspěvek? Tato akce je nevratná.'
            });

            const postRef = threadRef.collection('prispevky').doc(postId);
            const forumRef = threadRef.parent.parent;
            const userRef = db.collection('users').doc(currentUser.uid);

            await db.runTransaction(async (transaction) => {
                const threadDoc = await transaction.get(threadRef);
                const forumDoc = await transaction.get(forumRef);
                const userDoc = await transaction.get(userRef);

                if (!threadDoc.exists || !forumDoc.exists) {
                    throw "Téma nebo fórum neexistuje!";
                }

                transaction.update(threadRef, { odpovedi: firebase.firestore.FieldValue.increment(-1) });
                transaction.update(forumRef, { pocetPrispevku: firebase.firestore.FieldValue.increment(-1) });
                
                if (userDoc.exists) {
                     transaction.update(userRef, {
                        'forumStats.pocetOdpovedi': firebase.firestore.FieldValue.increment(-1)
                    });
                }

                transaction.delete(postRef);
            });

            loadThread();

        } catch (error) {
            if (error === 'Uživatel zrušil akci') {
                console.log('Smazání zrušeno uživatelem.');
            } else {
                console.error("Chyba při mazání příspěvku: ", error);
                Kruval.forumAdmin.showAlert("Při mazání příspěvku došlo k chybě.", "error");
            }
        }
    }

    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
            currentUserData = await getUserData(user.uid);
            
            const threadDoc = await threadRef.get();
            if(threadDoc.exists && !threadDoc.data().zamceno) {
                 showReplyForm();
            }

        } else {
            currentUserData = null;
            replyContainer.innerHTML = '<p>Pro odpověď se musíte <a href="login.html">přihlásit</a>.</p>';
        }
        await loadThread();
    });

    // Inicializace nově přidaných modulů
    if (window.Kruval && window.Kruval.quoteSystem) {
        window.Kruval.quoteSystem.initialize();
    }

    document.addEventListener('click', (e) => {
        handleEditClick(e);
        handleSaveClick(e);
        handleCancelClick(e);
        handleDeleteClick(e);
    });
});
