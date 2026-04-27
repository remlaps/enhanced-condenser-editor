// Map to store active editors and their associated elements
const activeEditors = new Map();

const injectToggle = (editorElement) => {
    // Generate a unique ID for this instance based on the element or a timestamp
    const editorId = editorElement.getAttribute('data-ece-id') || `ece-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    editorElement.setAttribute('data-ece-id', editorId);

    if (activeEditors.has(editorId)) return;

    // Find the closest form or editor container
    const gridParent = editorElement.closest('form, .ReplyEditor, .vframe');
    if (!gridParent) return;

    // Prioritize the action button container (Clear/Post) over the options container (Rewards/Settings)
    let actionTarget = gridParent.querySelector('.button-container .item');
    if (!actionTarget) actionTarget = gridParent.querySelector('.ReplyEditor__options, .ReplyEditor__actions');
    if (!actionTarget) return;

    const isMarkdown = editorElement.tagName === 'TEXTAREA';
    let btn = null;

    // Only create the toggle button if we are in Markdown mode
    if (isMarkdown) {
        btn = document.createElement('button');
        btn.id = `steem-side-toggle-${editorId}`;
        btn.type = 'button'; // Prevent form submission
        btn.innerText = 'ECE Preview: OFF';
        btn.className = 'button hollow no-border inactive';
    }
    
    const stats = document.createElement('span');
    stats.className = 'ece-stats';

    const updateStats = () => {
        const text = (editorElement.tagName === 'TEXTAREA' ? editorElement.value : editorElement.innerText).trim();
        const wordCount = text ? text.split(/\s+/).length : 0;

        // Don't show stats until there is actual content
        if (wordCount === 0) {
            if (stats.parentElement) stats.remove();
            return;
        }

        const readingTime = Math.ceil(wordCount / 200);
        stats.innerText = `${wordCount} words | ${readingTime} min read`;

        // Defer placement to allow React to render the Preview pane (especially during undo/paste)
        setTimeout(() => {
            if (!(editorElement.tagName === 'TEXTAREA' ? editorElement.value : editorElement.innerText).trim()) return;

            const previewTarget = gridParent.querySelector('.Preview') || gridParent.parentElement?.querySelector('.Preview');
            
            if (previewTarget) {
                if (stats.parentElement !== previewTarget) previewTarget.prepend(stats);
            } else if (stats.parentElement !== actionTarget) {
                // Fallback to action area; insert before button if button exists
                if (btn) {
                    actionTarget.insertBefore(stats, btn);
                } else {
                    actionTarget.appendChild(stats);
                }
            }
        }, 0);
    };

    // Use multiple events to ensure word count updates in all modes (Markdown & Slate)
    ['input', 'keyup', 'cut', 'paste', 'mouseup'].forEach(evt => {
        editorElement.addEventListener(evt, () => setTimeout(updateStats, 0));
    });

    // 1. Place the toggle button in the action/options area where it was originally
    if (btn) actionTarget.appendChild(btn);
    updateStats();

    if (btn) {
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
    }

    activeEditors.set(editorId, { btn, stats, gridParent, editorElement, updateStats });
};

const removeToggle = (editorId) => {
    const data = activeEditors.get(editorId);
    if (!data) return;

    if (data.btn) data.btn.remove();
    if (data.stats) data.stats.remove();
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
    // Broaden selector to catch editors in all contexts (new posts, edits, replies)
    const currentEditors = document.querySelectorAll('textarea[name="body"], textarea.upload-enabled, div[data-slate-editor="true"]');
    
    // Inject into new ones OR re-inject if React wiped our buttons during a re-render
    currentEditors.forEach(el => {
        const id = el.getAttribute('data-ece-id');
        const data = id ? activeEditors.get(id) : null;
        
        // Determine if injection is needed:
        // 1. It's a brand new editor
        // 2. It's an existing Markdown editor but the button is missing from the DOM
        const isMarkdown = el.tagName === 'TEXTAREA';
        const needsReinjection = data && isMarkdown && data.btn && !document.body.contains(data.btn);

        if (!data || needsReinjection) {
            if (data) activeEditors.delete(id); // Clear stale ref to allow clean re-injection
            injectToggle(el);
        }
    });

    // Clean up removed ones
    activeEditors.forEach((data, id) => {
        if (!document.body.contains(data.editorElement)) {
            removeToggle(id);
        }
    });

    // Fail-safe: if no textareas exist at all, force sidebar restoration
    if (currentEditors.length === 0) {
        document.body.classList.remove('side-by-side-active');
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});