const spellsData = [
    {
        id: "lumos",
        jmeno: "Lumos",
        popis: "Vytvoří na špičce hůlky malé světlo.",
        rocnik: 1,
        typ: "Charms",
        uspesnost: [
            { min: 0, max: 20, efekt: "Hůlka jen slabě zajiskří.", uspesne: false },
            { min: 21, max: 50, efekt: "Hůlka se na okamžik slabě rozsvítí.", uspesne: true, delka: 5 },
            { min: 51, max: 80, efekt: "Na špičce hůlky se objeví jasné, stabilní světlo.", uspesne: true, delka: 30 },
            { min: 81, max: 99, efekt: "Hůlka se rozzáří intenzivním světlem, které osvětlí celé okolí.", uspesne: true, delka: 60 },
            { min: 100, max: 100, efekt: "S naprostou lehkostí vykouzlíte jasné a trvalé světlo.", uspesne: true, delka: 120 }
        ]
    },
    {
        id: "nox",
        jmeno: "Nox",
        popis: "Zhasne světlo vytvořené kouzlem Lumos.",
        rocnik: 1,
        typ: "Charms",
        uspesnost: [
            { min: 0, max: 100, efekt: "Úspěšně zhasne světlo na hůlce.", uspesne: true }
        ]
    }
];

module.exports = { spellsData };
