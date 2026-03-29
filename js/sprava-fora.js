document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const mainContent = document.getElementById('main-content');
    const adminContent = document.getElementById('admin-content');
    const createCategoryBtn = document.getElementById('show-create-category-modal-btn');

    if(adminContent) adminContent.style.display = 'block';

    const switchContent = (targetId) => {
        const allContentDivs = adminContent.querySelectorAll(':scope > div');
        allContentDivs.forEach(div => {
            div.style.display = 'none';
        });

        const targetContent = document.getElementById(targetId);
        if (targetContent) {
            targetContent.style.display = 'block';
        }

        navLinks.forEach(link => {
            if (link.href.split('#')[1] === targetId.replace('-content', '')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = e.currentTarget.href.split('#')[1];
            history.pushState(null, null, `#${targetId}`);
            switchContent(targetId + '-content');
        });
    });

    const initialTarget = window.location.hash.substring(1);
    if (initialTarget) {
        switchContent(initialTarget + '-content');
    } else {
        switchContent('manage-categories-content');
    }

    if(sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });
    }

    // Posluchač pro tlačítko vytvoření kategorie
    if (createCategoryBtn) {
        createCategoryBtn.addEventListener('click', () => {
            // Vyšleme vlastní událost, na kterou bude reagovat spravce-kategorii.js
            document.dispatchEvent(new CustomEvent('showCreateCategoryModalRequest'));
        });
    }
});
