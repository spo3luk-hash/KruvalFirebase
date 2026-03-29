document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const rolesList = document.getElementById('roles-list');
    const addRoleForm = document.getElementById('add-role-form');

    // Načtení a zobrazení rolí
    async function loadRoles() {
        rolesList.innerHTML = '<p>Načítám role...</p>';
        try {
            const snapshot = await db.collection('herniRole').orderBy('nazev').get();
            if (snapshot.empty) {
                rolesList.innerHTML = '<p>Zatím nebyly vytvořeny žádné role.</p>';
                return;
            }
            renderRoles(snapshot.docs);
        } catch (error) {
            console.error('Chyba při načítání rolí: ', error);
            rolesList.innerHTML = '<p class="error-text">Při načítání rolí došlo k chybě.</p>';
        }
    }

    // Vykreslení tabulky rolí
    function renderRoles(rolesDocs) {
        const tableRows = rolesDocs.map(doc => {
            const role = doc.data();
            return `
                <tr>
                    <td>${role.nazev}</td>
                    <td>${role.popis || '–'}</td>
                    <td class="action-icons">
                        <i class="fas fa-trash-alt delete-role-btn" data-id="${doc.id}" title="Smazat roli"></i>
                    </td>
                </tr>
            `;
        }).join('');

        rolesList.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Název Role</th>
                        <th>Popis</th>
                        <th>Akce</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;

        // Přidání event listenerů pro tlačítka smazání
        document.querySelectorAll('.delete-role-btn').forEach(button => {
            button.addEventListener('click', handleDeleteRole);
        });
    }

    // Zpracování formuláře pro přidání role
    addRoleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const roleNameInput = document.getElementById('role-name');
        const roleDescriptionInput = document.getElementById('role-description');
        const nazev = roleNameInput.value.trim();
        const popis = roleDescriptionInput.value.trim();

        if (!nazev) {
            alert('Název role nesmí být prázdný.');
            return;
        }

        try {
            await db.collection('herniRole').add({
                nazev: nazev,
                popis: popis
            });
            addRoleForm.reset();
            alert('Role byla úspěšně vytvořena.');
            loadRoles();
        } catch (error) {
            console.error('Chyba při vytváření role: ', error);
            alert('Při vytváření role došlo k chybě.');
        }
    });

    // Funkce pro smazání role
    async function handleDeleteRole(e) {
        const roleId = e.target.dataset.id;
        if (confirm('Opravdu si přejete smazat tuto roli? Tato akce je nevratná.')) {
            try {
                await db.collection('herniRole').doc(roleId).delete();
                alert('Role byla úspěšně smazána.');
                loadRoles();
            } catch (error) {
                console.error('Chyba při mazání role: ', error);
                alert('Při mazání role došlo k chybě.');
            }
        }
    }

    // Prvotní načtení rolí při zobrazení sekce oprávnění
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && mutation.target.classList.contains('active')) {
                loadRoles();
            }
        });
    });

    const permissionsSection = document.getElementById('opravneni');
    if (permissionsSection) {
        observer.observe(permissionsSection, { attributes: true });
        // Pokud je sekce již aktivní při načtení stránky
        if (permissionsSection.classList.contains('active')) {
            loadRoles();
        }
    }
});
