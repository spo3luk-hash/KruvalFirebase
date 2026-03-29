document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();

    const form = document.getElementById('form-vytvorit-zakazku');
    const container = document.getElementById('dostupne-zakazky-container');

    // Pomocný objekt pro texty a barvy stavů
    const stavInfo = {
        vypsana: { text: 'VYPSANÁ', color: '#6c757d' },
        probiha: { text: 'PROBÍHÁ', color: '#007bff' },
        dokoncena: { text: 'DOKONČENA', color: '#28a745' },
        stornovana: { text: 'STORNOVÁNA', color: '#dc3545' }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;

        const newZakazka = {
            nazev: form.nazev.value,
            popis: form.popis.value,
            zadavatel: form.zadavatel.value,
            odmenaGaleony: parseInt(form.odmena.value, 10),
            kapacita: parseInt(form.kapacita.value, 10),
            trvaniMinut: parseInt(form.trvani.value, 10),
            stav: 'vypsana',
            casVytvoreni: firebase.firestore.FieldValue.serverTimestamp(),
            casSpusteni: null,
            zapsaniHraci: []
        };

        try {
            await db.collection('zakazky').add(newZakazka);
            alert('Nová zakázka byla úspěšně vytvořena.');
            form.reset();
        } catch (error) {
            console.error("Chyba při vytváření zakázky: ", error);
            alert('Došlo k chybě.');
        } finally {
            btn.disabled = false;
        }
    });

    db.collection('zakazky').orderBy('casVytvoreni', 'desc').onSnapshot(snapshot => {
        container.innerHTML = snapshot.empty ? '<p>Nebyly nalezeny žádné zakázky.</p>' : '';
        snapshot.forEach(doc => renderZakazka({ id: doc.id, ...doc.data() }));
    }, error => {
        console.error("Chyba při načítání zakázek: ", error);
        container.innerHTML = '<p class="error">Chyba při načítání dat.</p>';
    });

    function renderZakazka(zakazka) {
        const div = document.createElement('div');
        div.classList.add('zakazka-item', `stav-${zakazka.stav}`);
        div.setAttribute('data-id', zakazka.id);

        const detailsDiv = document.createElement('div');
        detailsDiv.classList.add('zakazka-details');

        const zapsaniHraciHtml = zakazka.zapsaniHraci.length > 0
            ? `<ul class="zapsani-hraci-list">${zakazka.zapsaniHraci.map(hrac => `<li>${hrac.jmenoPostavy}</li>`).join('')}</ul>`
            : '<p><em>Zatím nikdo.</em></p>';

        const aktualniStav = stavInfo[zakazka.stav] || { text: zakazka.stav.toUpperCase(), color: '#333' };

        detailsDiv.innerHTML = `
            <h4>
                ${zakazka.nazev} 
                <span class="stav-label" style="color: ${aktualniStav.color}; border: 1px solid ${aktualniStav.color};">${aktualniStav.text}</span>
            </h4>
            <p>${zakazka.popis}</p>
            <p class="zakazka-meta">
                <span><strong>Odměna:</strong> ${zakazka.odmenaGaleony} G</span> | 
                <span><strong>Kapacita:</strong> ${zakazka.zapsaniHraci.length}/${zakazka.kapacita}</span>
            </p>
            <div class="zapsani-hraci">
                <strong>Zapsané postavy:</strong>
                ${zapsaniHraciHtml}
            </div>
        `;

        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('zakazka-actions');

        if (zakazka.stav === 'vypsana') {
            actionsDiv.innerHTML += `<button class="btn-primary" data-action="spustit">Spustit</button>`;
        } else if (zakazka.stav === 'probiha') {
            actionsDiv.innerHTML += `<button class="btn-danger" data-action="ukoncit">Ukončit</button>`;
        } else if (zakazka.stav === 'dokoncena' || zakazka.stav === 'stornovana') {
            actionsDiv.innerHTML += `<p><em>Žádné akce</em></p>`;
        }
        
        actionsDiv.innerHTML += `<button class="btn-secondary" data-action="smazat">Smazat</button>`;

        div.appendChild(detailsDiv);
        div.appendChild(actionsDiv);
        container.appendChild(div);
    }

    container.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const zakazkaDiv = button.closest('.zakazka-item');
        if (!zakazkaDiv) return;
        
        const zakazkaId = zakazkaDiv.dataset.id;
        const action = button.dataset.action;

        if (!action) return;

        button.disabled = true;
        const zakazkaRef = db.collection('zakazky').doc(zakazkaId);

        try {
            switch (action) {
                case 'smazat':
                    if (confirm('Opravdu chcete trvale smazat tuto zakázku?')) {
                        await zakazkaRef.delete();
                    } else {
                        button.disabled = false;
                    }
                    break;
                case 'spustit':
                    await zakazkaRef.update({ stav: 'probiha', casSpusteni: firebase.firestore.FieldValue.serverTimestamp() });
                    break;
                case 'ukoncit':
                    await handleUkonceniZakazky(zakazkaRef, button);
                    break;
            }
        } catch (error) {
            console.error(`Chyba při akci "${action}":`, error);
            alert('Došlo k chybě. Zkuste to znovu.');
            if (button) button.disabled = false;
        }
    });

    async function handleUkonceniZakazky(zakazkaRef, button) {
        try {
            const zakazkaDoc = await zakazkaRef.get();
            if (!zakazkaDoc.exists) {
                throw new Error("Zakázka nenalezena!");
            }

            const zakazkaData = zakazkaDoc.data();
            const odmena = zakazkaData.odmenaGaleony;
            const zapsaniHraci = zakazkaData.zapsaniHraci;

            if (!odmena || odmena <= 0) {
                await zakazkaRef.update({ stav: 'dokoncena' });
                alert('Zakázka byla ukončena (bez odměny).');
                return;
            }
            
            if (zapsaniHraci.length === 0) {
                await zakazkaRef.update({ stav: 'dokoncena' });
                alert('Zakázka byla ukončena. Nikdo nebyl zapsán, takže se nerozdávaly odměny.');
                return;
            }

            await db.runTransaction(async (transaction) => {
                const freshZakazkaDoc = await transaction.get(zakazkaRef);
                const freshZakazkaData = freshZakazkaDoc.data();

                if (freshZakazkaData.stav !== 'probiha') {
                    throw new Error('Zakázka již není ve stavu "probiha"!');
                }

                const postavyRefs = zapsaniHraci.map(hrac => db.collection('hraci').doc(hrac.uid).collection('postavy').doc(hrac.idPostavy));
                const postavyDocs = await Promise.all(postavyRefs.map(ref => transaction.get(ref)));

                for (let i = 0; i < postavyDocs.length; i++) {
                    const postavaDoc = postavyDocs[i];
                    if (postavaDoc.exists) {
                        const data = postavaDoc.data();
                        const aktualniGaleony = data.peněženka?.galeony || 0;
                        const noveGaleony = aktualniGaleony + odmena;
                        transaction.update(postavyRefs[i], { 'peněženka.galeony': noveGaleony });
                        
                        const hracInfo = zapsaniHraci[i];
                        const upozorneniRef = db.collection('notifications').doc(); 
                        transaction.set(upozorneniRef, {
                            nazevUpozorneni: "Odměna za zakázku!",
                            obsahUpozorneni: `Za úspěšné splnění zakázky '${freshZakazkaData.nazev}' ti bylo připsáno ${odmena} galeonů.`,
                            hracId: hracInfo.uid,
                            typ: "soukrome",
                            casVytvoreni: firebase.firestore.FieldValue.serverTimestamp(),
                            precteno: false
                        });

                    } else {
                        console.warn(`Postava s ID ${zapsaniHraci[i].idPostavy} nenalezena, odměna nebude připsána.`);
                    }
                }
                
                transaction.update(zakazkaRef, { stav: 'dokoncena', casDokonceni: firebase.firestore.FieldValue.serverTimestamp() });
            });

            alert(`Zakázka byla úspěšně ukončena. Odměna ${odmena} galeonů byla připsána ${zapsaniHraci.length} postavám a bylo odesláno soukromé upozornění.`);

        } catch (error) {
            console.error("Chyba při ukončování zakázky a rozdávání odměn: ", error);
            alert("Při ukončování zakázky se vyskytla chyba. Zkontrolujte konzoli pro více detailů.");
        } finally {
            if (button) button.disabled = false;
        }
    }
});
