function initializeCustomSelects() {
    const allSelects = document.querySelectorAll('.custom-select-wrapper');

    allSelects.forEach(wrapper => {
        const selectElement = wrapper.querySelector('select');
        if (!selectElement || wrapper.querySelector('.select-selected')) {
            return; // Přeskočí, pokud select neexistuje nebo už byl inicializován
        }

        const selectedDiv = document.createElement('div');
        selectedDiv.classList.add('select-selected');
        selectedDiv.innerHTML = selectElement.options[selectElement.selectedIndex].innerHTML;
        wrapper.appendChild(selectedDiv);

        const itemsDiv = document.createElement('div');
        itemsDiv.classList.add('select-items', 'select-hide');

        for (let i = 0; i < selectElement.length; i++) {
            const optionDiv = document.createElement('div');
            optionDiv.innerHTML = selectElement.options[i].innerHTML;
            
            if (i === selectElement.selectedIndex) {
                optionDiv.classList.add('same-as-selected');
            }

            optionDiv.addEventListener('click', function() {
                for (let j = 0; j < selectElement.length; j++) {
                    if (selectElement.options[j].innerHTML == this.innerHTML) {
                        selectElement.selectedIndex = j;
                        selectedDiv.innerHTML = this.innerHTML;
                        const currentSelected = wrapper.querySelector('.same-as-selected');
                        if(currentSelected) {
                            currentSelected.classList.remove('same-as-selected');
                        }
                        this.classList.add('same-as-selected');
                        break;
                    }
                }
                selectedDiv.click();
            });
            itemsDiv.appendChild(optionDiv);
        }
        wrapper.appendChild(itemsDiv);

        selectedDiv.addEventListener('click', function(e) {
            e.stopPropagation();
            const isAlreadyOpen = !this.nextSibling.classList.contains('select-hide');
            closeAllSelect(); 
            if (!isAlreadyOpen) {
                this.nextSibling.classList.remove('select-hide');
                this.classList.add('select-arrow-active');
            }
        });
    });
}

function closeAllSelect() {
    const items = document.querySelectorAll('.select-items');
    const selected = document.querySelectorAll('.select-selected');
    
    items.forEach(item => {
        item.classList.add('select-hide');
    });
    
    selected.forEach(sel => {
        sel.classList.remove('select-arrow-active');
    });
}

document.addEventListener('click', closeAllSelect);

document.addEventListener('DOMContentLoaded', () => {
    initializeCustomSelects(); 
});
