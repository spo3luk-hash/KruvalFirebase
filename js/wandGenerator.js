const wandGenerator = (() => {

    const woods = [
        'Jasan', 'Olše', 'Jabloň', 'Buk', 'Trnka', 'Ořechovec', 'Cesmína', 'Habr', 
        'Modřín', 'Vavřín', 'Javor', 'Dub', 'Hrušeň', 'Borovice', 'Topol', 'Sekvoj', 
        'Jeřáb', 'Stříbrný limetkovec', 'Smrk', 'Platan', 'Réva', 'Ořech', 'Vrba', 'Tis'
    ];

    const cores = [
        'Žíně z jednorožce', 'Pero z fénixe', 'Vlákno ze srdce draka', 'Vlas z víly',
        'Srst z testrála', 'Roh z rohatého hada', 'Vlákno z rougarou'
    ];

    const flexibilities = [
        'Tuhá', 'Pevná', 'Pružná', 'Velmi pružná', 'Ohebná', 'Křehká', 'Nepoddajná', 'Podajná'
    ];

    const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const getRandomLength = () => {
        // Generuje délku mezi 9 a 15 palci, s přesností na čtvrt palce
        const inches = Math.floor(Math.random() * (15 - 9 + 1)) + 9;
        const quarters = [0, 0.25, 0.5, 0.75];
        return inches + getRandomElement(quarters);
    };

    const generateRandomWand = () => {
        const wood = getRandomElement(woods);
        const core = getRandomElement(cores);
        const flexibility = getRandomElement(flexibilities);
        const length = getRandomLength();

        return {
            drevo: wood,
            jadro: core,
            delka: length,
            pruznost: flexibility,
            nazev: `${wood}, ${core}, ${length}"`, // Generujeme i název pro snazší identifikaci
            typ: 'hulka', // Přidáno pro konzistenci
            vlastnik: null
        };
    };

    const generateRandomWands = (count) => {
        const wands = [];
        for (let i = 0; i < count; i++) {
            wands.push(generateRandomWand());
        }
        return wands;
    };

    return {
        generate: generateRandomWands
    };

})();