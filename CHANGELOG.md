# Changelog

All notable changes to this project will be documented in this file.

## [0.0.5] - 2026-04-25
### Added
- Word count and reading time now appear in the reading pain for Markdown mode editing (new posts, edited posts, replies)
- Word count and reading time now appear in the button area for Editor mode editing

### Changed
- Cosmetic changes.  Moved "ECE Preview" button away from "Post" button to avoid accidental premature posting.

## [0.0.4] - 2026-04-24
### Changed
- Moved toggle button from a floating position to inline within the editor options/actions area.
- Integrated toggle button with native platform CSS classes for height/style matching.
- Refactored button CSS to inherit platform styles, ensuring sync during window resizing.
- (Re)implemented support for multiple simultaneous editor instances, each with its own ECE toggle.

### Fixed
- Fixed ReferenceError where the event object was undefined in the toggle click handler.
- Resolved issue where sidebars remained hidden after closing or navigating away from an editor.

## [0.0.3] - 2026-04-23
### Fixed
- Relocated toggle button to the bottom-left to prevent obstructing preview content.
- Added bottom padding to the preview pane for better scrolling visibility.
- Adjusted preview position to avoid overlap with the sticky navigation header.

## [0.0.2] - 2026-04-23
### Fixed
- Added theme-awareness to the preview pane to support both Light and Dark modes.

## [0.0.1] - 2026-04-23

### Added
- Initial Alpha release.
- Side-by-side grid layout for the editor.
- Logic to detect and inject the ECE toggle on post and reply forms.
- CSS fixes for horizontal scrolling and sidebar suppression.