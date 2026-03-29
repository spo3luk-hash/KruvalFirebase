document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const characterRolesList = document.getElementById('character-roles-list');

    let allRoles = [];

    async function loadRolesAndCharacters() {
        characterRolesList.innerHTML = '<p>Načítání rolí a postav...</p>';
        try {
            // Načtení všech dostupných rolí
            const rolesSnapshot = await db.collection('herniRole').get();
            allRoles = rolesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Načtení všech postav
            const charactersSnapshot = await db.collectionGroup('postavy').get();
            const characters = charactersSnapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
            
            renderCharacterRolesTable(characters);
        } catch (error) {
            console.error('Chyba při načítání rolí a postav: ', error);
            characterRolesList.innerHTML = '<p class="error-text">Při načítání dat došlo k chybě.</p>';
        }
    }

    function renderCharacterRolesTable(characters) {
        const tableRows = characters.map(char => {
            const rolesOptions = allRoles.map(role => 
                `<option value="${role.nazev}" ${char.herniRole === role.nazev ? 'selected' : ''}>${role.nazev}</option>`
            ).join('');

            return `
                <tr>
                    <td>${char.jmeno || 'Neznámé jméno'}</td>
                    <td>${char.herniRole || 'Nováček'}</td>
                    <td class="role-assignment-cell">
                        <select class="role-select" data-character-id="${char.id}" data-character-path="${char.ref.path}">
                            <option value="">Odebrat roli</option>
                            ${rolesOptions}
                        </select>
                        <button class="save-role-btn" disabled>Uložit</button>
                    </td>
                </tr>
            `;
        }).join('');

        characterRolesList.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Jméno Postavy</th>
                        <th>Aktuální Role</th>
                        <th>Přiřadit Novou Roli</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;

        setupRoleAssignmentListeners();
    }

    function setupRoleAssignmentListeners() {
        document.querySelectorAll('.role-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const saveButton = e.target.nextElementSibling;
                saveButton.disabled = false;
            });
        });

        document.querySelectorAll('.save-role-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const select = e.target.previousElementSibling;
                const characterPath = select.dataset.characterPath;
                const newRole = select.value;

                e.target.disabled = true;
                e.target.textContent = 'Ukládám...';

                try {
                    const charRef = db.doc(characterPath);
                    await charRef.update({ herniRole: newRole || 'Nováček' });
                    alert('Role byla úspěšně aktualizována!');
                    loadRolesAndCharacters(); // Znovu načteme tabulku pro aktualizaci
                } catch (error) {
                    console.error('Chyba při ukládání role: ', error);
                    alert('Při ukládání role došlo k chybě.');
                    e.target.disabled = false;
                    e.target.textContent = 'Uložit';
                }
            });
        });
    }

    // Sledujeme, kdy se sekce "Oprávnění" stane aktivní
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && mutation.target.classList.contains('active')) {
                loadRolesAndCharacters();
            }
        });
    });

    const permissionsSection = document.getElementById('opravneni');
    if (permissionsSection) {
        observer.observe(permissionsSection, { attributes: true });
        if (permissionsSection.classList.contains('active')) {
            loadRolesAndCharacters();
        }
    }
});
