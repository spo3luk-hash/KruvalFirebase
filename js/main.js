
const SVG_FRAMES_RENDERER = [
    { id: 'frame-default', name: 'Žádný' },
    { id: 'frame-svg-1', name: 'Zlatý Kruh', svg: '<circle cx="128" cy="128" r="124"/>' },
    { id: 'frame-svg-2', name: 'Stříbrný Kruh', svg: '<circle cx="128" cy="128" r="124"/>' },
    { id: 'frame-svg-3', name: 'Dvojitý Kruh', svg: '<circle class="outer-circle" cx="128" cy="128" r="124"/><circle class="inner-circle" cx="128" cy="128" r="118"/>' },
    { id: 'frame-svg-4', name: 'Runový Kruh', svg: '<circle class="runic-circle" cx="128" cy="128" r="122"/>' },
    { id: 'frame-svg-5', name: 'Magická Záře', svg: '<circle cx="128" cy="128" r="124"/>' },
    { id: 'frame-svg-6', name: 'Kovaný Kov',
      svg: `
        <defs>
          <linearGradient id="forged-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#999;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#555;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#999;stop-opacity:1" />
          </linearGradient>
        </defs>
        <circle cx="128" cy="128" r="120"/>
      `
    },
    { id: 'frame-svg-7', name: 'Přerušovaný Kruh', svg: '<circle cx="128" cy="128" r="123"/>' },
    { id: 'frame-svg-8', name: 'Ledový Kruh', svg: '<circle cx="128" cy="128" r="122"/>' },
];

window.createAvatarHtml = (data, containerClass) => {
    const avatarUrl = data.avatarUrl || '';
    const frameId = data.avatarFrame || 'frame-default';
    const initial = (data.herniNick || '?').charAt(0).toUpperCase();

    const frameData = SVG_FRAMES_RENDERER.find(f => f.id === frameId);
    const frameSvg = frameData && frameData.svg ? `<div class="avatar-frame"><svg viewBox="0 0 256 256">${frameData.svg}</svg></div>` : '';

    const backgroundStyle = avatarUrl ? `style="background-image: url('${avatarUrl}');"` : '';
    const initialHtml = !avatarUrl ? `<span class="initial">${initial}</span>` : '';

    return `
        <div class="${containerClass}" data-frame-id="${frameId}">
            <div class="avatar-image" ${backgroundStyle}>${initialHtml}</div>
            ${frameSvg}
        </div>
    `;
};

window.renderAvatar = (containerId, data) => {
    const container = document.getElementById(containerId);
    if (container) {
        const avatarClass = container.dataset.avatarClass || 'avatar-container';
        container.innerHTML = window.createAvatarHtml(data, avatarClass);
    }
};

window.renderAvatarFrames = () => {
    document.querySelectorAll('[data-frame-id]').forEach(container => {
        const frameId = container.getAttribute('data-frame-id');
        const frameData = SVG_FRAMES_RENDERER.find(f => f.id === frameId);
        let frameContainer = container.querySelector('.avatar-frame');

        if (frameData && frameData.svg) {
            if (!frameContainer) {
                frameContainer = document.createElement('div');
                frameContainer.className = 'avatar-frame';
                container.appendChild(frameContainer);
            }
            frameContainer.innerHTML = `<svg viewBox="0 0 256 256">${frameData.svg}</svg>`;
        } else if (frameContainer) {
            frameContainer.innerHTML = '';
        }
    });
};
