document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const shopsContainer = document.getElementById('shops-container'); 

    if (!shopsContainer) {
        console.error("Chyba: Kontejner pro seznam obchodů nebyl nalezen.");
        return;
    }

    const loadShops = async () => {
        shopsContainer.innerHTML = '<p>Načítám obchody...</p>';
        shopsContainer.className = 'shop-list-container';

        try {
            // Načtení speciálních obchodů z kolekce 'obchody'
            const specialShopsSnapshot = await db.collection('obchody').orderBy('name').get();
            
            // Načtení obecných obchodů z kolekce 'obchody_nove'
            const generalShopsSnapshot = await db.collection('obchody_nove').orderBy('name').get();

            if (specialShopsSnapshot.empty && generalShopsSnapshot.empty) {
                shopsContainer.innerHTML = '<p>Na Příčné ulici momentálně nejsou otevřeny žádné obchody.</p>';
                return;
            }

            shopsContainer.innerHTML = ''; // Vyčistit kontejner

            // Zpracování a vykreslení speciálních obchodů
            specialShopsSnapshot.forEach(doc => {
                renderShop(doc.id, doc.data(), false); // false značí, že nejde o obecný obchod
            });

            // Zpracování a vykreslení obecných obchodů
            generalShopsSnapshot.forEach(doc => {
                renderShop(doc.id, doc.data(), true); // true značí, že jde o obecný obchod
            });

        } catch (error) {
            console.error('Chyba při načítání obchodů: ', error);
            shopsContainer.innerHTML = '<p class="error-message">Nepodařilo se načíst obchody. Zkuste to prosím později.</p>';
        }
    };

    const renderShop = (shopId, shopData, isGeneral) => {
        let shopUrl = '#';

        if (isGeneral) {
            // Obecné obchody směřují na univerzální stránku
            shopUrl = `obecny-obchod.html?id=${shopId}`;
        } else {
            // Speciální obchody mají své vlastní stránky
            switch(shopId) {
                case 'trolli-pokladnice': shopUrl = 'trolli-pokladnice.html'; break;
                case 'ollivanderovy-hulky': shopUrl = 'obchod-hulky.html'; break; // Opravený odkaz
                case 'velkoprodejna-mzourov': shopUrl = 'obchod-zverimex.html'; break;
                case 'krucanky-a-kanoury': shopUrl = 'obchod-ucebnice.html'; break;
                // Případné další speciální obchody
                default: shopUrl = '#'; // Fallback pro speciální obchody bez definované URL
            }
        }

        const shopElement = document.createElement('a');
        shopElement.href = shopUrl;
        shopElement.className = 'shop-tile';

        const imageDiv = document.createElement('div');
        // Pro obecné obchody můžeme mít defaultní obrázek nebo ho brát z dat, pokud existuje
        const imageClass = isGeneral ? 'general-shop-default' : shopId;
        imageDiv.className = `shop-tile-image ${imageClass}`;
        // Pokud by obecné obchody měly vlastní obrázky v datech:
        // if (isGeneral && shopData.imageUrl) { imageDiv.style.backgroundImage = `url(${shopData.imageUrl})`; }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'shop-tile-info';

        const nameH3 = document.createElement('h3');
        nameH3.className = 'shop-name';
        nameH3.textContent = shopData.name;

        const descriptionP = document.createElement('p');
        descriptionP.className = 'shop-description';
        descriptionP.textContent = shopData.description;

        const enterBtnSpan = document.createElement('span');
        enterBtnSpan.className = 'shop-enter-btn';
        enterBtnSpan.textContent = 'Vstoupit do obchodu';

        infoDiv.appendChild(nameH3);
        infoDiv.appendChild(descriptionP);
        infoDiv.appendChild(enterBtnSpan);

        shopElement.appendChild(imageDiv);
        shopElement.appendChild(infoDiv);

        shopsContainer.appendChild(shopElement);
    };

    loadShops();
});
