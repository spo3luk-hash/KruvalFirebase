/**
 * Soubor: js/forum-utils.js
 * Účel: Poskytuje sdílené pomocné funkce pro celé fórum.
 */

const ForumUtils = {
    _roleCache: new Map(),
    _rolesFetched: false,

    /**
     * Zajistí, že jsou všechny role načteny a uloženy v cache.
     * @param {firebase.firestore.Firestore} db Instance databáze.
     */
    async _ensureRolesFetched(db) {
        if (this._rolesFetched) {
            return;
        }
        try {
            const snapshot = await db.collection('forum_roles').get();
            snapshot.forEach(doc => {
                this._roleCache.set(doc.id, doc.data().nazev);
            });
            this._rolesFetched = true;
        } catch (error) {
            console.error("Chyba při cachování rolí fóra:", error);
        }
    },

    /**
     * Získá zobrazovaný název role na základě jejího ID.
     * @param {firebase.firestore.Firestore} db Instance databáze.
     * @param {string} roleId ID role (např. 'moderator').
     * @returns {Promise<string|null>} Zobrazovaný název role nebo null.
     */
    async getRoleName(db, roleId) {
        if (!roleId) {
            return null;
        }
        await this._ensureRolesFetched(db);
        return this._roleCache.get(roleId) || null;
    }
};