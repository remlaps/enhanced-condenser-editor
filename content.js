// Map to store active editors and their associated elements
const activeEditors = new Map();

const injectToggle = (textarea) => {
    // Generate a unique ID for this instance based on the textarea or a timestamp
    const editorId = textarea.getAttribute('data-ece-id') || `ece-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    textarea.setAttribute('data-ece-id', editorId);

    if (activeEditors.has(editorId)) return;

    // Find the closest form or editor container
    const gridParent = textarea.closest('form, .ReplyEditor, .vframe');
    if (!gridParent) return;

    // Look for target containers: Post options or Reply button area WITHIN this specific gridParent
    const target = gridParent.querySelector('.ReplyEditor__options, .button-container .item');
    if (!target) return;

    const btn = document.createElement('button');
    btn.id = `steem-side-toggle-${editorId}`;
    btn.type = 'button'; // Prevent form submission
    btn.innerText = 'ECE Preview: OFF';
    btn.className = 'button hollow inactive';
    
    target.appendChild(btn);

    btn.onclick = (e) => {
        e.preventDefault();
        const isActive = gridParent.classList.toggle('side-by-side-active-instance');
        btn.innerText = `ECE Preview: ${isActive ? 'ON' : 'OFF'}`;
        btn.classList.toggle('inactive', !isActive);

        // Manage the global body class to hide sidebars if ANY instance is active
        const anyActive = !!document.querySelector('.side-by-side-active-instance');
        document.body.classList.toggle('side-by-side-active', anyActive);
        
        window.dispatchEvent(new Event('resize'));
    };

    activeEditors.set(editorId, { btn, gridParent, textarea });
};

const removeToggle = (editorId) => {
    const data = activeEditors.get(editorId);
    if (!data) return;

    data.btn.remove();
    data.gridParent.classList.remove('side-by-side-active-instance');
    
    activeEditors.delete(editorId);

    // Cleanup global state if no editors are left
    const anyActive = !!document.querySelector('.side-by-side-active-instance');
    if (!anyActive) {
        document.body.classList.remove('side-by-side-active');
        window.dispatchEvent(new Event('resize'));
    }
};

// Main Observer to handle addition and removal of textareas
const observer = new MutationObserver(() => {
    const currentTextareas = document.querySelectorAll('textarea[name="body"]');
    
    // Inject into new ones
    currentTextareas.forEach(ta => {
        if (!ta.getAttribute('data-ece-id') || !activeEditors.has(ta.getAttribute('data-ece-id'))) {
            injectToggle(ta);
        }
    });

    // Clean up removed ones
    activeEditors.forEach((data, id) => {
        if (!document.body.contains(data.textarea)) {
            removeToggle(id);
        }
    });

    // Fail-safe: if no textareas exist at all, force sidebar restoration
    if (currentTextareas.length === 0) {
        document.body.classList.remove('side-by-side-active');
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});