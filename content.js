// Map to store active editors and their associated elements
const activeEditors = new Map();

// Map to store split-preview state (observers/panes) keyed by editorId
const splitPreviewObservers = new Map();

// Shared MutationObserver config used to mirror the native preview into the split panes
const SPLIT_OBSERVER_CONFIG = { childList: true, subtree: true, characterData: true, attributes: true };

/**
 * Locate the native Condenser preview element for a given editor container.
 */
const getPreviewElement = (gridParent) =>
    gridParent.querySelector('.Preview') || gridParent.parentElement?.querySelector('.Preview');

// Smallest allowed height of either pane while dragging the divider
const MIN_PANE_HEIGHT = 60; // px

/**
 * Mirror the native preview's rendered HTML into both split panes while
 * preserving each pane's own independent scroll position.
 */
const syncSplitPanes = (splitData) => {
    if (!splitData || !splitData.previewEl) return;
    const html = splitData.previewEl.innerHTML;
    const scrollPositions = splitData.panes.map((pane) => pane.scrollTop);
    splitData.panes.forEach((pane) => { pane.innerHTML = html; });
    splitData.panes.forEach((pane, i) => { pane.scrollTop = scrollPositions[i]; });
};

/**
 * Make the divider draggable so the operator can re-balance the two panes
 * (like dragging the split bar between frozen panes in a spreadsheet).
 */
const attachDividerDrag = (splitData) => {
    const { divider, wrapper } = splitData;

    const applyRatio = (ratio) => {
        const clamped = Math.max(0, Math.min(1, ratio));
        splitData.ratio = clamped;
        wrapper.style.setProperty('--ece-split-top', `${clamped * 100}%`);
    };

    // Apply any previously chosen ratio (survives toggling the split off/on)
    const data = activeEditors.get(splitData.editorId);
    applyRatio(data && typeof data.splitRatio === 'number' ? data.splitRatio : 0.5);

    divider.addEventListener('pointerdown', (e) => {
        e.preventDefault();

        const wrapperHeight = wrapper.getBoundingClientRect().height;
        if (!wrapperHeight) return;

        const startY = e.clientY;
        const startTop = splitData.panes[0].getBoundingClientRect().height;
        document.body.classList.add('ece-split-dragging');

        const onMove = (ev) => {
            const top = startTop + (ev.clientY - startY);
            const minTop = MIN_PANE_HEIGHT;
            const maxTop = Math.max(minTop, wrapperHeight - MIN_PANE_HEIGHT);
            applyRatio(Math.max(minTop, Math.min(maxTop, top)) / wrapperHeight);
        };

        const onEnd = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
            document.body.classList.remove('ece-split-dragging');

            // Remember the chosen ratio for this editor instance
            const current = activeEditors.get(splitData.editorId);
            if (current) current.splitRatio = splitData.ratio;
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    });
};

/**
 * Split the preview pane horizontally into two independently scrolling halves
 * (similar to freezing panes in a spreadsheet). Returns true on success.
 */
const enableSplitPreview = (editorId) => {
    const data = activeEditors.get(editorId);
    if (!data) return false;

    // Already split
    if (splitPreviewObservers.has(editorId)) return true;

    const { gridParent } = data;
    const previewEl = getPreviewElement(gridParent);
    if (!previewEl) return false;

    // Build the wrapper that holds the two independent panes
    const wrapper = document.createElement('div');
    wrapper.className = 'ece-split-wrapper';
    wrapper.setAttribute('data-ece-split-id', editorId);

    const topPane = document.createElement('div');
    topPane.className = 'ece-split-pane';
    topPane.setAttribute('data-pane', 'top');

    const divider = document.createElement('div');
    divider.className = 'ece-split-divider';
    divider.title = 'Drag to resize the preview panes';
    divider.setAttribute('role', 'separator');
    divider.setAttribute('aria-orientation', 'horizontal');

    const bottomPane = document.createElement('div');
    bottomPane.className = 'ece-split-pane';
    bottomPane.setAttribute('data-pane', 'bottom');

    wrapper.appendChild(topPane);
    wrapper.appendChild(divider);
    wrapper.appendChild(bottomPane);

    // Place the wrapper in the same grid cell as the native preview
    previewEl.parentElement.insertBefore(wrapper, previewEl.nextSibling);

    const splitData = { editorId, wrapper, divider, previewEl, panes: [topPane, bottomPane], observer: null, frame: null, ratio: 0.5 };

    // Debounced mirroring of the native preview into both panes
    const scheduleSync = () => {
        if (splitData.frame) cancelAnimationFrame(splitData.frame);
        splitData.frame = requestAnimationFrame(() => {
            splitData.frame = null;
            // Re-bind if React replaced the preview element underneath us
            if (!document.body.contains(splitData.previewEl)) {
                const replacement = getPreviewElement(gridParent);
                if (replacement && replacement !== splitData.previewEl) {
                    splitData.observer.disconnect();
                    splitData.previewEl = replacement;
                    splitData.observer.observe(replacement, SPLIT_OBSERVER_CONFIG);
                }
            }
            syncSplitPanes(splitData);
        });
    };

    const mo = new MutationObserver(scheduleSync);
    mo.observe(previewEl, SPLIT_OBSERVER_CONFIG);
    splitData.observer = mo;

    splitPreviewObservers.set(editorId, splitData);

    // CSS uses this class to hide the native preview and reveal the wrapper
    gridParent.classList.add('split-preview-active');
    data.splitActive = true;

    // Enable dragging the divider to re-balance the panes, then fill them
    attachDividerDrag(splitData);
    syncSplitPanes(splitData);

    return true;
};

/**
 * Remove the horizontal split and restore the native preview.
 */
const disableSplitPreview = (editorId) => {
    const splitData = splitPreviewObservers.get(editorId);
    if (splitData) {
        if (splitData.frame) cancelAnimationFrame(splitData.frame);
        if (splitData.observer) splitData.observer.disconnect();
        splitData.wrapper.remove();
        splitPreviewObservers.delete(editorId);
    }

    const data = activeEditors.get(editorId);
    if (data) {
        data.gridParent.classList.remove('split-preview-active');
        data.splitActive = false;
    }
};

/**
 * Remove the split toggle button from the DOM.
 */
const removeSplitButton = (editorId) => {
    const data = activeEditors.get(editorId);
    // Remove by id so orphaned buttons left behind by React are also cleaned up
    const existing = document.getElementById(`steem-split-toggle-${editorId}`);
    if (existing) existing.remove();
    if (data) data.splitBtn = null;
};

/**
 * Create (or re-create) the split toggle button next to the main ECE toggle.
 * Only meaningful while side-by-side mode is active.
 */
const ensureSplitButton = (editorId) => {
    const data = activeEditors.get(editorId);
    if (!data || !data.btn || !document.body.contains(data.btn)) return;

    // Re-use an existing button if one is already mounted (avoids duplicates on re-render)
    const existing = document.getElementById(`steem-split-toggle-${editorId}`);
    if (existing) {
        data.splitBtn = existing;
        return;
    }

    const splitBtn = document.createElement('button');
    splitBtn.id = `steem-split-toggle-${editorId}`;
    splitBtn.type = 'button';
    splitBtn.innerText = 'ECE Split: OFF';
    splitBtn.className = 'button hollow no-border inactive ece-toggle-btn';

    splitBtn.onclick = (e) => {
        e.preventDefault();
        if (data.gridParent.classList.contains('split-preview-active')) {
            disableSplitPreview(editorId);
            splitBtn.innerText = 'ECE Split: OFF';
            splitBtn.classList.add('inactive');
        } else if (enableSplitPreview(editorId)) {
            splitBtn.innerText = 'ECE Split: ON';
            splitBtn.classList.remove('inactive');
        }
        window.dispatchEvent(new Event('resize'));
    };

    data.btn.insertAdjacentElement('afterend', splitBtn);
    data.splitBtn = splitBtn;
};

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
        btn.className = 'button hollow no-border inactive ece-toggle-btn';
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

            if (isActive) {
                // Offer the horizontal split option once the preview is visible
                ensureSplitButton(editorId);
            } else {
                // Tearing down the preview also tears down any active split
                disableSplitPreview(editorId);
                removeSplitButton(editorId);
            }

            // Manage the global body class to hide sidebars if ANY instance is active
            const anyActive = !!document.querySelector('.side-by-side-active-instance');
            document.body.classList.toggle('side-by-side-active', anyActive);
            
            window.dispatchEvent(new Event('resize'));
        };
    }

    activeEditors.set(editorId, { btn, stats, gridParent, editorElement, updateStats, splitBtn: null, splitActive: false });

    // Restore state if React re-rendered our controls while the editor was still active
    if (gridParent.classList.contains('side-by-side-active-instance')) {
        if (btn) {
            btn.innerText = 'ECE Preview: ON';
            btn.classList.remove('inactive');
        }
        ensureSplitButton(editorId);
        if (gridParent.classList.contains('split-preview-active')) {
            enableSplitPreview(editorId);
            const splitBtn = activeEditors.get(editorId)?.splitBtn;
            if (splitBtn) {
                splitBtn.innerText = 'ECE Split: ON';
                splitBtn.classList.remove('inactive');
            }
        }
    }
};

const removeToggle = (editorId) => {
    const data = activeEditors.get(editorId);
    if (!data) return;

    disableSplitPreview(editorId);
    removeSplitButton(editorId);
    if (data.btn) data.btn.remove();
    if (data.stats) data.stats.remove();
    data.gridParent.classList.remove('side-by-side-active-instance');
    data.gridParent.classList.remove('split-preview-active');
    
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

    // Keep split previews healthy across React re-renders
    splitPreviewObservers.forEach((splitData, id) => {
        const data = activeEditors.get(id);
        if (!data) {
            disableSplitPreview(id);
            return;
        }
        // If React removed our wrapper, rebuild it while the split is still desired
        if (!document.body.contains(splitData.wrapper)) {
            const wasActive = data.splitActive;
            disableSplitPreview(id);
            if (wasActive) enableSplitPreview(id);
        }
    });

    // Re-create a missing split button while side-by-side is active
    activeEditors.forEach((data, id) => {
        if (data.btn && document.body.contains(data.btn) &&
            data.gridParent.classList.contains('side-by-side-active-instance')) {
            ensureSplitButton(id);
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});