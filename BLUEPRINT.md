# Kruval RPG Online - Plán Vývoje (BLUEPRINT.md)

**Verze Dokumentu:** 3.4
**Poslední Aktualizace:** 25. 05. 2024

---

## Filozofie a Hlavní Pravidla

1.  **Hráč na Prvním Místě:** Každá funkce musí být intuitivní, zábavná a smysluplná.
2.  **Pohlcující Svět:** Všechny systémy musí spolupracovat na vytvoření iluze živého, dýchajícího světa.
3.  **Tematická Věrnost:** Vše od názvů po ikonky musí zapadat do magického světa.
4.  **Jediný Zdroj Pravdy (Single Source of Truth):** Veškerá klíčová data jsou uložena a spravována výhradně ve Firestore pro konzistenci a bezpečnost.
5.  **Kreativní Iniciativa:** Aktivně navrhovat a vylepšovat systémy nad rámec původního zadání.
6.  **Robustní Modulární Architektura:** Kritické a komplexní operace jsou izolovány do samostatných, specializovaných modulů, aby se zabránilo systémovým selháním a zajistila se maximální stabilita.

---

## Fáze 4: Interaktivní Správa Fóra (CRUD)

### Současný Stav Projektu (v3.4)

*   **Úspěch! Dokončena Fáze 3!**
*   Implementovali jsme plně funkční a vizuálně přehledné zobrazení kompletní hierarchie fóra v administraci.
*   Systém nyní správně a přehledně zobrazuje stromovou strukturu: **Kategorie -> Fóra -> Témata -> Úvodní příspěvek -> Odpovědi**.
*   Jsou korektně načítána a zobrazována všechna relevantní data, včetně názvů, popisů, autorů a časových značek.
*   **Vylepšení v3.4:** Implementována plně funkční, bezpečná a responzivní možnost pro uživatele mazat své vlastní odpovědi v tématech, včetně elegantního potvrzovacího modálního okna a dokonalého vizuálního zarovnání formuláře pro odpověď.
*   Tímto je uzavřena fáze **zobrazení (Read)** a můžeme se plně soustředit na implementaci operací **vytváření (Create)**, **úprav (Update)** a **mazání (Delete)**.

### Další Kroky: Vytvoření Kategorie

- **Cíl:** Umožnit administrátorům vytvářet nové kategorie fóra přímo z administrativního rozhraní.
- **Plán:**
    1.  **Návrh UI:** Vytvořit jednoduchý, ale elegantní formulář pro zadání názvu a popisu nové kategorie.
    2.  **Logika na straně klienta:** Přidat JavaScript, který bude formulář ověřovat a po odeslání volat příslušnou funkci.
    3.  **Bezpečnostní pravidla:** Aktualizovat `firestore.rules`, aby bylo vytváření kategorií povoleno pouze uživatelům s rolí `admin` nebo `superadmin`.
    4.  **Aktualizace statistik:** Zajistit, aby se po vytvoření nové kategorie správně aktualizovaly globální statistiky fóra (pokud to bude relevantní).

---

**POZNÁMKA NA ZAČÁTEK: VŠE PEČLIVĚ PROJÍT A ZJISTIT FUNKČNOST NA 100%. NIKDY NEVYTVÁŘET SYSTÉM, KTERÝ NEBUDE FUNGOVAT NEBO NEBUDE PLYNULE NAVAZOVAT NA JIŽ VYTVOŘENÝ SYSTÉM. PEČLIVĚ VŠE PROMYSLET A INSPIRATIVNĚ DOPLNIT O DALŠÍ ROZŠÍŘENÍ NEBO NÁPADY. KAŽDÝ SYSTÉM BUDE MASIVNÍ A MUSÍ SE POČÍTAT DOPŘEDU S TÍM, ŽE BUDE NAVAZOVAT NA JINÝ NEBO NA ÚPLNĚ NOVÝ.**

**POZNÁMKA NA KONEC: NEBÁT SE ZEPTAT, JAK SI CO PŘEDSTAVUJI. AKTIVNĚ NAVRHOVAT PLÁNY A ROVNOU JE VYLEPŠOVAT.**
