/**
 * Soubor: js/spravce-roli-forum.js
 * Účel: Zajišťuje veškerou logiku pro správu a přiřazování rolí na fóru.
 * Verze: 2.0 (Podpora více rolí)
 */

document.addEventListener('DOMContentLoaded', () => {
    const roleDefinitionContainer = document.getElementById('role-definition-container');
    const userRoleAssignmentContainer = document.getElementById('user-role-assignment-container');
    
    if (!roleDefinitionContainer || !userRoleAssignmentContainer) return;

    const db = firebase.firestore();
    const rolesCollection = db.collection('forum_roles');

    let allForumRoles = [];

    // --- ČÁST 1: DEFINICE A SPRÁVA ROLÍ ---

    function initRoleDefinition() {
        renderRoleCreationForm();
        loadAndDisplayRoles();
        roleDefinitionContainer.addEventListener('click', handleRoleActions);
    }

    function renderRoleCreationForm() {
        const html = `
            <form id="create-role-form">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="role-name">Název role</label>
                        <input type="text" id="role-name" required placeholder="Např. Moderátor">
                    </div>
                    <div class="form-group">
                        <label for="role-description">Stručný popis</label>
                        <input type="text" id="role-description" placeholder="Co tato role může dělat?">
                    </div>
                    <button type="submit" class="admin-button">Vytvořit roli</button>
                </div>
            </form>
            <div id="existing-roles-list-container">
                <h4>Existující role</h4>
                <div id="existing-roles-list" class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
            </div>
        `;
        roleDefinitionContainer.innerHTML = html;
        document.getElementById('create-role-form').addEventListener('submit', handleCreateRoleSubmit);
    }

    async function loadAndDisplayRoles() {
        const listContainer = document.getElementById('existing-roles-list');
        try {
            const snapshot = await rolesCollection.get();
            allForumRoles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if (snapshot.empty) {
                listContainer.innerHTML = '<p class="empty-state">Zatím nebyly vytvořeny žádné role.</p>';
                return;
            }
            
            const rolesHtml = allForumRoles.map(role => renderRoleItem(role.id, role)).join('');
            listContainer.innerHTML = rolesHtml;
            listContainer.classList.remove('loading-spinner');

        } catch (error) {
            console.error("Chyba při načítání rolí fóra: ", error);
            listContainer.innerHTML = '<p class="error-message">Nepodařilo se načíst role.</p>';
        }
    }

    function renderRoleItem(id, data) {
        return `
            <div class="role-item" data-id="${id}">
                <div>
                    <span class="role-name">${data.nazev}</span>
                    <span class="role-description">${data.popis || ''}</span>
                </div>
                <div class="item-actions">
                    <button class="action-btn delete-role-btn" title="Smazat roli"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
    }

    async function handleCreateRoleSubmit(event) {
        event.preventDefault();
        const nameInput = document.getElementById('role-name');
        const descriptionInput = document.getElementById('role-description');
        const name = nameInput.value.trim();
        const description = descriptionInput.value.trim();

        if (!name) {
            Kruval.forumAdmin.showAlert('Název role nesmí být prázdný.', 'error');
            return;
        }

        const roleId = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (!roleId) {
             Kruval.forumAdmin.showAlert('Z názvu role se nepodařilo vytvořit platné ID.', 'error');
            return;
        }

        const roleRef = rolesCollection.doc(roleId);

        try {
            const doc = await roleRef.get();
            if (doc.exists) {
                Kruval.forumAdmin.showAlert('Role s tímto ID již existuje. Zvolte jiný název.', 'error');
                return;
            }

            const newRole = { nazev: name, popis: description };
            await roleRef.set(newRole);

            Kruval.forumAdmin.showAlert('Role byla úspěšně vytvořena.', 'success');
            nameInput.value = '';
            descriptionInput.value = '';
            
            allForumRoles.push({ id: roleId, ...newRole });
            const listContainer = document.getElementById('existing-roles-list');
            if(listContainer.querySelector('.empty-state')) listContainer.innerHTML = '';
            const newRoleElement = document.createElement('div');
            newRoleElement.innerHTML = renderRoleItem(roleId, newRole);
            listContainer.appendChild(newRoleElement.firstChild);

            initUserRoleAssignment(); // Refresh user assignments

        } catch (error) {
            console.error("Chyba při vytváření role: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při vytváření role.', 'error');
        }
    }

    async function handleRoleActions(event) {
        const deleteBtn = event.target.closest('.delete-role-btn');
        if (deleteBtn) {
            const roleItem = deleteBtn.closest('.role-item');
            const roleId = roleItem.dataset.id;
            const roleName = roleItem.querySelector('.role-name').textContent;

            Kruval.forumAdmin.showModal(
                `<h2><i class="fas fa-exclamation-triangle warning-icon"></i> Opravdu smazat roli?</h2>`+
                `<p>Chystáte se smazat roli "${roleName}". Role bude odebrána všem autorům, kterým je přiřazena. Tato akce je nevratná.</p>`+
                `<div class="modal-actions"><button id="confirm-delete-btn" class="admin-button danger-button">Ano, smazat</button><button id="cancel-delete-btn" class="admin-button-secondary">Zrušit</button></div>`
            );
            document.getElementById('confirm-delete-btn').onclick = () => executeRoleDeletion(roleId);
            document.getElementById('cancel-delete-btn').onclick = () => Kruval.forumAdmin.closeModal();
        }
    }

    async function executeRoleDeletion(roleId) {
        try {
            await rolesCollection.doc(roleId).delete();
            Kruval.forumAdmin.showAlert('Role byla úspěšně smazána.', 'success');
            document.querySelector(`.role-item[data-id="${roleId}"]`).remove();
            allForumRoles = allForumRoles.filter(role => role.id !== roleId);
            initUserRoleAssignment(); // Refresh user assignments
        } catch (error) {
            console.error("Chyba při mazání role: ", error);
            Kruval.forumAdmin.showAlert('Došlo k chybě při mazání role.', 'error');
        } finally {
            Kruval.forumAdmin.closeModal();
        }
    }

    // --- ČÁST 2: PŘIŘAZOVÁNÍ ROLÍ UŽIVATELŮM (PŘEPRACOVÁNO PRO VÍCE ROLÍ) ---

    async function initUserRoleAssignment() {
        userRoleAssignmentContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Načítám autory...</div>';
        try {
            const authors = await loadAllAuthors();
            renderUserRoleAssignments(authors, allForumRoles);
        } catch (error) {
            console.error("Chyba při inicializaci přiřazování rolí: ", error);
            userRoleAssignmentContainer.innerHTML = '<p class="error-message">Nepodařilo se načíst autory pro přiřazení rolí.</p>';
        }
    }

    async function loadAllAuthors() {
        const usersSnapshot = await db.collection('users').get();
        const authors = [];

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.identitaNaForu) {
                authors.push({
                    id: doc.id,
                    identita: data.identitaNaForu,
                    roles: Array.isArray(data.roleNaForu) ? data.roleNaForu : [], // Očekáváme pole
                    collection: 'users'
                });
            }
        });
        
        return authors.sort((a, b) => a.identita.localeCompare(b.identita));
    }

    function renderUserRoleAssignments(authors, roles) {
        if (authors.length === 0) {
            userRoleAssignmentContainer.innerHTML = '<p class="empty-state">Nebyli nalezeni žádní autoři s identitou na fóru v kolekci `users`.</p>';
            return;
        }
        const tableHtml = `
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Autor</th>
                            <th>Přiřazené role</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${authors.map(author => renderUserRoleRow(author, roles)).join('')}
                    </tbody>
                </table>
            </div>
        `;
        userRoleAssignmentContainer.innerHTML = tableHtml;
        userRoleAssignmentContainer.addEventListener('change', handleRoleCheckboxChange);
    }

    function renderUserRoleRow(author, roles) {
        return `
            <tr>
                <td>${author.identita}</td>
                <td class="role-checkbox-container" data-user-id="${author.id}" data-collection="${author.collection}">
                    ${roles.map(role => `
                        <label class="role-checkbox-label">
                            <input type="checkbox" class="role-checkbox" value="${role.id}" ${author.roles.includes(role.id) ? 'checked' : ''}>
                            <span>${role.nazev}</span>
                        </label>
                    `).join('')}
                </td>
            </tr>
        `;
    }

    async function handleRoleCheckboxChange(event) {
        const checkbox = event.target;
        if (checkbox.classList.contains('role-checkbox')) {
            const container = checkbox.closest('.role-checkbox-container');
            const userId = container.dataset.userId;
            const collection = container.dataset.collection;

            const allCheckboxes = container.querySelectorAll('.role-checkbox');
            const selectedRoleIds = Array.from(allCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);

            try {
                const userRef = db.collection(collection).doc(userId);
                await userRef.update({ roleNaForu: selectedRoleIds });
                Kruval.forumAdmin.showAlert('Role autora byly úspěšně aktualizovány.', 'success');
            } catch (error) {
                console.error("Chyba při aktualizaci rolí autora: ", error);
                Kruval.forumAdmin.showAlert('Došlo k chybě při změně rolí.', 'error');
            }
        }
    }

    // --- SPUŠTĚNÍ --- 
    async function initialize() {
        await initRoleDefinition();
        initUserRoleAssignment();
    }

    initialize();
});