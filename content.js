const injectToggle = () => {
    if (document.getElementById('steem-side-toggle')) return;

    const btn = document.createElement('button');
    btn.id = 'steem-side-toggle';
    btn.innerText = 'ECE Preview: OFF';
    btn.className = 'inactive';
    document.body.appendChild(btn);

    // Default to OFF on page load
    document.body.classList.remove('side-by-side-active');

    btn.onclick = () => {
        const isActive = document.body.classList.toggle('side-by-side-active');
        btn.innerText = `ECE Preview: ${isActive ? 'ON' : 'OFF'}`;
        btn.classList.toggle('inactive', !isActive);
        window.dispatchEvent(new Event('resize'));
    };
};

const removeToggle = () => {
    const btn = document.getElementById('steem-side-toggle');
    if (btn) {
        document.body.classList.remove('side-by-side-active');
        btn.remove();
    }
};

// Precise Observer for the editor form
const observer = new MutationObserver(() => {
    const editor = document.querySelector('textarea[name="body"]');
    if (editor) {
        injectToggle();
    } else {
        removeToggle();
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});