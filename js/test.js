
document.addEventListener('DOMContentLoaded', () => {
    const character = document.getElementById('character');
    const rightArm = character.querySelector('.arm.right');
    const dragon = document.getElementById('dragon');
    const fire = document.getElementById('fire');

    character.addEventListener('animationend', (event) => {
        if (event.animationName === 'walk-in') {
            rightArm.style.animation = 'wave 1s ease-in-out 2'; // Wave twice

            rightArm.addEventListener('animationend', () => {
                dragon.style.display = 'block';

                dragon.addEventListener('animationend', () => {
                    fire.style.display = 'block';
                    setTimeout(() => {
                      character.classList.add("burnt");
                    }, 500);
                });
            });
        }
    });
});
