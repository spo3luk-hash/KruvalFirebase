window.spravceAutoru = {
    nactiAVykresliAutory: async (db, container) => {
        container.innerHTML = '<p>Načítám data autorů...</p>';
        try {
            const [usersSnapshot, hraciSnapshot, rolesSnapshot] = await Promise.all([
                db.collection('users').get(),
                db.collection('hraci').get(),
                db.collection('forum_role').get()
            ]);

            const hraciMap = new Map(hraciSnapshot.docs.map(doc => [doc.id, doc.data()]));
            const rolesMap = new Map(rolesSnapshot.docs.map(doc => [doc.id, doc.data().nazev]));
            
            let autori = [];
            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                const hracData = hraciMap.get(userDoc.id) || { hernick: '<em>Nenalezeno</em>' };
                const roleNames = (userData.forumRole || []).map(roleId => rolesMap.get(roleId) || 'Neznámá role').join(', ');

                autori.push({
                    id: userDoc.id,
                    identitaNaForu: userData.identitaNaForu || '<em>Chybí</em>',
                    herniNick: hracData.hernick,
                    role: roleNames || '<em>Žádná</em>'
                });
            }
            
            window.spravceAutoru.vykresliTabulku(container, autori);

        } catch (error) {
            console.error("Chyba při načítání autorů: ", error);
            container.innerHTML = `<p class="error-message">Při načítání dat autorů došlo k chybě.</p>`;
        }
    },

    vykresliTabulku: (container, autori) => {
        if (autori.length === 0) {
            container.innerHTML = '<p>Nebyli nalezeni žádní autoři (uživatelé fóra).</p>';
            return;
        }

        let tableHtml = `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Jméno na Fóru</th>
                            <th>Role na Fóru</th>
                            <th>Herní Nick (Skutečná identita)</th>
                        </tr>
                    </thead>
                    <tbody>`;

        autori.forEach(autor => {
            tableHtml += `
                <tr>
                    <td>${autor.identitaNaForu}</td>
                    <td>${autor.role}</td>
                    <td>${autor.herniNick}</td>
                </tr>`;
        });

        tableHtml += `</tbody></table></div>`;
        container.innerHTML = tableHtml;
    }
};