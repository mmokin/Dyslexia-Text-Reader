let extensionEnabled = false;
let currentSettings = {};
let selectionOverlay = null;
let isWikipedia = window.location.hostname.includes('wikipedia.org');
let modifiedElements = [];
let domReady = false;
let previousSelection = '';
let selectionConfirmDialog = null;

function isDOMReady() {
    return document.readyState === 'complete' || document.readyState === 'interactive';
}

function waitForDOM() {
    return new Promise(resolve => {
        if (isDOMReady()) {
            resolve();
        } else {
            document.addEventListener('DOMContentLoaded', () => resolve());
            window.addEventListener('load', () => resolve());
            setTimeout(resolve, 1000);
        }
    });
}

(async function init() {
    try {
        await waitForDOM();
        domReady = true;
        
        await loadSettings();

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                if (message.action === 'toggleExtension') {
                    extensionEnabled = message.enabled;
                    
                    if (!extensionEnabled) {
                        if (selectionOverlay && selectionOverlay.parentNode) {
                            selectionOverlay.remove();
                        }
                        
                        const span = document.getElementById('dyslexia-selection-span');
                        if (span && span.parentNode) {
                            span.remove();
                        }
                        
                        revertModifiedElements();
                    }
                    
                    if (sendResponse) {
                        sendResponse({status: 'success'});
                    }
                } else if (message.action === 'updateSettings') {
                    currentSettings = message.settings;
                    
                    if (extensionEnabled && selectionOverlay) {
                        updateSelectionOverlay();
                    }
                    
                    sendResponse({status: 'success'});
                } else if (message.action === 'applyDyslexiaStyles') {
                    if (!extensionEnabled) {
                        sendResponse({status: 'error', error: 'Extension is disabled'});
                        return true;
                    }
                    
                    const mockSelection = {
                        toString: () => message.text,
                        isCollapsed: false,
                        rangeCount: 1,
                        getRangeAt: (i) => {
                            const realSelection = window.getSelection();
                            if (realSelection && realSelection.rangeCount > 0) {
                                return realSelection.getRangeAt(0);
                            }
                            
                            return document.createRange();
                        }
                    };
                    
                    applyDyslexiaStylesToSelection(mockSelection);
                    sendResponse({status: 'success'});
                } else if (message.action === 'readAloud') {
                    readTextAloud(message.text);
                    sendResponse({status: 'success'});
                } else if (message.action === 'processText') {
                    processTextSelection(message.text);
                    sendResponse({status: 'success'});
                } else if (message.action === 'phoneticBreakdown') {
                    handlePhoneticTranscription(message.text);
                    sendResponse({status: 'success'});
                }
            } catch (error) {
                console.error('Error in message listener:', error);
                if (sendResponse) {
                    sendResponse({status: 'error', error: error.message});
                }
            }
            
            return true;
        });

        chrome.runtime.sendMessage({action: 'getStatus'}, (response) => {
            if (response && response.enabled) {
                extensionEnabled = true;
            }
        });
        
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('keyup', handleTextSelection);
        document.addEventListener('keydown', handleKeyboardShortcuts);
    } catch (error) {
        console.error('Error initializing extension:', error);
    }
})();

async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get('dyslexiaSettings', (data) => {
            if (data.dyslexiaSettings) {
                currentSettings = data.dyslexiaSettings;
            } else {
                currentSettings = {
                    font: 'sans-serif',
                    fontSize: 16,
                    letterSpacing: 0.12,
                    wordSpacing: 0.16,
                    lineSpacing: 1.5,
                    textColor: '#000000',
                    backgroundColor: '#f8f8f8',
                    rewriteEnabled: true,
                    textToSpeechEnabled: true,
                    aiModel: 'gpt-4o',
                    simplificationLevel: 'medium',
                    phoneticsEnabled: false
                };
            }
            resolve();
        });
    });
}

function getFontFamily(font) {
    switch(font) {
        case 'sans-serif':
            return 'sans-serif';
        case 'arial':
            return 'Arial, sans-serif';
        case 'verdana':
            return 'Verdana, sans-serif';
        case 'tahoma':
            return 'Tahoma, sans-serif';
        case 'trebuchet':
            return 'Trebuchet MS, sans-serif';
        case 'calibri':
            return 'Calibri, sans-serif';
        case 'century':
            return 'Century Gothic, sans-serif';
        case 'comic':
            return 'Comic Sans MS, sans-serif';
        case 'opendyslexic':
            return 'OpenDyslexic, sans-serif';
        default:
            return 'sans-serif';
    }
}

function handleTextSelection(event) {
    if (!extensionEnabled) return;
    
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    

    if (selection && !selection.isCollapsed && selectedText) {
        previousSelection = selectedText;
        
        chrome.runtime.sendMessage({
            action: 'updateContextMenu',
            hasSelection: true
        });
    } else if (event && event.type === 'mouseup') {
        chrome.runtime.sendMessage({
            action: 'updateContextMenu',
            hasSelection: false
        });
    }
}


function showSelectionConfirmationDialog(text, selection) {
    return;
}

function handleKeyboardShortcuts(event) {
    if (!extensionEnabled) return;
    
    if (event.ctrlKey && event.shiftKey && event.key === 'L') {
        event.preventDefault();
        
        if (!currentSettings.textToSpeechEnabled) {
            console.log('Text-to-speech is disabled in settings');
            return;
        }
        
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            const text = selection.toString().trim();
            if (text) {
                readTextAloud(text);
            }
        }
    }
}

function applyDyslexiaStylesToSelection(selection) {
    if (!selection || !document.body || !domReady) {
        console.error('Cannot apply styles: selection, document.body, or DOM not ready');
        return;
    }
    
    const existingHighlights = document.querySelectorAll('.readease-highlight-container');
    existingHighlights.forEach(el => {
        if (el.toolbarElement && el.toolbarElement.parentNode) {
            el.toolbarElement.parentNode.removeChild(el.toolbarElement);
        }
        el.remove();
    });
    
    selectionOverlay = null;
    
    try {
        if (!selection.rangeCount) {
            console.warn('No range in selection');
            return;
        }
        
        // Store the original range and its content
        const range = selection.getRangeAt(0);
        const selectedContent = selection.toString();
        
        // Create a new container for the highlighted text
        const container = document.createElement('span');
        container.className = 'readease-highlight-container';
        
        // Create the text element with user's settings
        const textElement = document.createElement('span');
        textElement.className = 'readease-highlight-text';
        
        // Apply the user's dyslexia-friendly settings
        textElement.style.fontFamily = getFontFamily(currentSettings.font || 'sans-serif');
        textElement.style.fontSize = `${currentSettings.fontSize || 16}px`;
        textElement.style.letterSpacing = `${currentSettings.letterSpacing || 0.12}em`;
        textElement.style.wordSpacing = `${currentSettings.wordSpacing || 0.16}em`;
        textElement.style.lineHeight = `${currentSettings.lineSpacing || 1.5}`;
        textElement.style.color = currentSettings.textColor || '#000000';
        textElement.style.backgroundColor = currentSettings.backgroundColor || '#f8f8f8';
        textElement.style.padding = '2px 4px';
        textElement.style.borderRadius = '3px';
        textElement.style.display = 'inline-block';
        
        // Set the text content
        textElement.textContent = selectedContent;
        
        // Create a floating toolbar that appears on hover
        const toolbarContainer = document.createElement('div');
        toolbarContainer.className = 'readease-highlight-toolbar';
        toolbarContainer.style.position = 'absolute';
        toolbarContainer.style.top = '-30px';
        toolbarContainer.style.left = '50%';
        toolbarContainer.style.transform = 'translateX(-50%)';
        toolbarContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        toolbarContainer.style.borderRadius = '4px';
        toolbarContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
        toolbarContainer.style.padding = '2px 6px';
        toolbarContainer.style.zIndex = '1001';
        toolbarContainer.style.display = 'flex';
        toolbarContainer.style.alignItems = 'center';
        toolbarContainer.style.gap = '4px';
        toolbarContainer.style.transition = 'opacity 0.2s ease';
        toolbarContainer.style.opacity = '0';  // Start hidden
        
        // Create close button for the toolbar
        const closeButton = document.createElement('button');
        closeButton.className = 'readease-highlight-close';
        closeButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;
        closeButton.style.background = 'transparent';
        closeButton.style.border = 'none';
        closeButton.style.color = '#666';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '4px';
        closeButton.style.borderRadius = '50%';
        closeButton.style.display = 'flex';
        closeButton.style.alignItems = 'center';
        closeButton.style.justifyContent = 'center';
        closeButton.addEventListener('click', () => {
            // Restore original text and remove toolbar
            const parent = container.parentNode;
            if (parent) {
                const originalText = document.createTextNode(selectedContent);
                parent.replaceChild(originalText, container);
                
                if (toolbarContainer.parentNode) {
                    toolbarContainer.parentNode.removeChild(toolbarContainer);
                }
                
                // Reset global reference if this was the current selection
                if (selectionOverlay === container) {
                    selectionOverlay = null;
                }
            }
        });
        
        toolbarContainer.appendChild(closeButton);
        
        // Show/hide toolbar on hover
        container.addEventListener('mouseenter', () => {
            toolbarContainer.style.opacity = '1';
        });
        
        container.addEventListener('mouseleave', () => {
            toolbarContainer.style.opacity = '0';
        });
        
        // We need to clone the range first, so we can still have the original selection
        const highlightRange = range.cloneRange();
        
        // Add the text element to the container
        container.appendChild(textElement);
        
        // Only delete the contents after we've constructed our replacement
        highlightRange.deleteContents();
        
        // Insert the container with the styled text
        highlightRange.insertNode(container);
        
        // Add the toolbar to the body
        document.body.appendChild(toolbarContainer);
        
        // Store reference for later positioning
        toolbarContainer.dataset.targetId = container.id = 'readease-highlight-' + Date.now();
        
        // Position toolbar above the container
        function positionToolbar() {
            const rect = container.getBoundingClientRect();
            toolbarContainer.style.left = `${window.scrollX + rect.left + (rect.width / 2)}px`;
            toolbarContainer.style.top = `${window.scrollY + rect.top - 30}px`;
        }
        
        // Initial positioning
        positionToolbar();
        
        // Update position on scroll/resize
        window.addEventListener('scroll', positionToolbar, { passive: true });
        window.addEventListener('resize', positionToolbar, { passive: true });
        
        // Store references for cleanup
        container.toolbarElement = toolbarContainer;
        selectionOverlay = container;
        
        // Add action buttons to the toolbar based on enabled features
        // We'll add them to the toolbar instead of a separate container
        
        // If text-to-speech is enabled, add read-aloud button
        if (currentSettings.textToSpeechEnabled) {
            const readBtn = document.createElement('button');
            readBtn.className = 'readease-action-btn readease-tooltip';
            readBtn.setAttribute('data-tooltip', 'Read Aloud');
            readBtn.style.background = 'transparent';
            readBtn.style.border = 'none';
            readBtn.style.padding = '4px 8px';
            readBtn.style.cursor = 'pointer';
            readBtn.style.color = '#3B82F6';
            readBtn.style.borderRadius = '3px';
            
            // Use SVG icon for better quality
            readBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
            `;
            
            readBtn.addEventListener('click', () => readTextAloud(selectedContent));
            toolbarContainer.appendChild(readBtn);
        }
        
        // If rewrite is enabled, add simplify button
        if (currentSettings.rewriteEnabled) {
            const simplifyBtn = document.createElement('button');
            simplifyBtn.className = 'readease-action-btn readease-tooltip';
            simplifyBtn.setAttribute('data-tooltip', 'Simplify Text');
            simplifyBtn.style.background = 'transparent';
            simplifyBtn.style.border = 'none';
            simplifyBtn.style.padding = '4px 8px';
            simplifyBtn.style.cursor = 'pointer';
            simplifyBtn.style.color = '#3B82F6';
            simplifyBtn.style.borderRadius = '3px';
            
            // Use SVG icon for better quality
            simplifyBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
            `;
            
            simplifyBtn.addEventListener('click', () => processTextSelection(selectedContent));
            toolbarContainer.appendChild(simplifyBtn);
        }
        
        // If phonetics is enabled, add syllables button
        if (currentSettings.phoneticsEnabled) {
            const syllablesBtn = document.createElement('button');
            syllablesBtn.className = 'readease-action-btn readease-tooltip';
            syllablesBtn.setAttribute('data-tooltip', 'Show Syllables');
            syllablesBtn.style.background = 'transparent';
            syllablesBtn.style.border = 'none';
            syllablesBtn.style.padding = '4px 8px';
            syllablesBtn.style.cursor = 'pointer';
            syllablesBtn.style.color = '#3B82F6';
            syllablesBtn.style.borderRadius = '3px';
            
            // Use SVG icon for better quality
            syllablesBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
            `;
            
            syllablesBtn.addEventListener('click', () => {
                // Create a popup for syllables
                const syllablesPopup = document.createElement('div');
                syllablesPopup.className = 'readease-syllables-popup';
                syllablesPopup.style.position = 'absolute';
                syllablesPopup.style.top = '30px'; // Position below the toolbar
                syllablesPopup.style.left = '50%';
                syllablesPopup.style.transform = 'translateX(-50%)';
                syllablesPopup.style.width = 'auto';
                syllablesPopup.style.minWidth = '200px';
                syllablesPopup.style.backgroundColor = 'white';
                syllablesPopup.style.borderRadius = '6px';
                syllablesPopup.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                syllablesPopup.style.zIndex = '1002';
                syllablesPopup.style.animation = 'readease-fade-in 0.2s ease-out';
                
                // Create header with title
                const syllablesHeader = document.createElement('div');
                syllablesHeader.style.display = 'flex';
                syllablesHeader.style.alignItems = 'center';
                syllablesHeader.style.justifyContent = 'space-between';
                syllablesHeader.style.padding = '10px 12px';
                syllablesHeader.style.borderBottom = '1px solid #E5E7EB';
                
                const syllablesTitle = document.createElement('div');
                syllablesTitle.style.fontWeight = '600';
                syllablesTitle.style.fontSize = '14px';
                syllablesTitle.style.color = '#1F2937';
                syllablesTitle.style.display = 'flex';
                syllablesTitle.style.alignItems = 'center';
                syllablesTitle.style.gap = '6px';
                
                syllablesTitle.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    Syllable Breakdown
                `;
                
                const syllablesCloseBtn = document.createElement('button');
                syllablesCloseBtn.style.background = 'transparent';
                syllablesCloseBtn.style.border = 'none';
                syllablesCloseBtn.style.cursor = 'pointer';
                syllablesCloseBtn.style.padding = '2px';
                syllablesCloseBtn.style.display = 'flex';
                syllablesCloseBtn.style.alignItems = 'center';
                syllablesCloseBtn.style.justifyContent = 'center';
                syllablesCloseBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                `;
                syllablesCloseBtn.addEventListener('click', () => syllablesPopup.remove());
                
                syllablesHeader.appendChild(syllablesTitle);
                syllablesHeader.appendChild(syllablesCloseBtn);
                syllablesPopup.appendChild(syllablesHeader);
                
                const syllablesContainer = document.createElement('div');
                syllablesContainer.className = 'readease-syllables-content';
                syllablesContainer.style.padding = '12px';
                syllablesPopup.appendChild(syllablesContainer);
                
                const loadingElement = document.createElement('div');
                loadingElement.style.display = 'flex';
                loadingElement.style.alignItems = 'center';
                loadingElement.style.justifyContent = 'center';
                loadingElement.style.padding = '16px';
                loadingElement.style.color = '#6B7280';
                loadingElement.style.fontSize = '14px';
                
                // Add loading spinner
                loadingElement.innerHTML = `
                    <div style="
                        border: 2px solid #E5E7EB; 
                        border-top: 2px solid #3B82F6; 
                        border-radius: 50%; 
                        width: 16px; 
                        height: 16px; 
                        animation: readease-spin 1s linear infinite; 
                        margin-right: 8px;
                    "></div>
                    Analyzing syllable structure...
                `;
                syllablesContainer.appendChild(loadingElement);
                
                // Add to document body for better positioning
                document.body.appendChild(syllablesPopup);
                
                // Position near the toolbar
                const rect = toolbarContainer.getBoundingClientRect();
                syllablesPopup.style.top = `${window.scrollY + rect.bottom + 5}px`;
                syllablesPopup.style.left = `${window.scrollX + rect.left + (rect.width / 2)}px`;
                
                // Get the syllables from the background script
                chrome.runtime.sendMessage({
                    action: 'getPhoneticTranscription',
                    text: selectedContent
                }, (response) => {
                    // Remove loading indicator
                    loadingElement.remove();
                    
                    if (response && response.phoneticText) {
                        const syllablesContent = document.createElement('div');
                        syllablesContent.style.display = 'flex';
                        syllablesContent.style.flexWrap = 'wrap';
                        syllablesContent.style.gap = '8px';
                        syllablesContent.style.margin = '12px 0';
                        
                        if (typeof response.phoneticText === 'object') {
                            // Process and display each word/syllable pair
                            for (const [word, syllables] of Object.entries(response.phoneticText)) {
                                const wordElem = document.createElement('div');
                                wordElem.className = 'readease-syllable-word';
                                
                                const syllableElem = document.createElement('div');
                                syllableElem.className = 'readease-syllable-text';
                                syllableElem.textContent = syllables;
                                
                                const originalElem = document.createElement('div');
                                originalElem.className = 'readease-original-word';
                                originalElem.textContent = word;
                                
                                wordElem.appendChild(syllableElem);
                                wordElem.appendChild(originalElem);
                                syllablesContent.appendChild(wordElem);
                            }
                            
                            // Add a "speak syllables" button
                            const speakSyllablesBtn = document.createElement('button');
                            speakSyllablesBtn.className = 'readease-btn';
                            speakSyllablesBtn.innerHTML = `
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                </svg>
                                Speak Syllables
                            `;
                            
                            // Format for speech
                            let syllableSpeechText = '';
                            if (typeof response.phoneticText === 'object') {
                                syllableSpeechText = Object.entries(response.phoneticText)
                                    .map(([word, syllables]) => `${word}: ${syllables.replace(/-/g, ', ')}`)
                                    .join('. ');
                            }
                            
                            speakSyllablesBtn.addEventListener('click', () => readTextAloud(syllableSpeechText || selectedContent));
                            
                            // Create button container
                            const buttonContainer = document.createElement('div');
                            buttonContainer.style.marginTop = '16px';
                            buttonContainer.style.display = 'flex';
                            buttonContainer.style.justifyContent = 'flex-end';
                            buttonContainer.appendChild(speakSyllablesBtn);
                            
                            syllablesContainer.appendChild(syllablesContent);
                            syllablesContainer.appendChild(buttonContainer);
                        } else {
                            syllablesContent.textContent = response.phoneticText;
                            syllablesContainer.appendChild(syllablesContent);
                        }
                    } else {
                        const errorElement = document.createElement('div');
                        errorElement.style.padding = '16px';
                        errorElement.style.color = 'var(--readease-error)';
                        errorElement.style.display = 'flex';
                        errorElement.style.alignItems = 'center';
                        errorElement.style.gap = '8px';
                        
                        errorElement.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            <span>Could not analyze syllables. Please try again.</span>
                        `;
                        
                        syllablesContainer.appendChild(errorElement);
                    }
                });
            });
            
            toolbarContainer.appendChild(syllablesBtn);
        }
        
    } catch (error) {
        console.error('Error applying dyslexia styles to selection:', error);
    }
}

// Helper function to make an element draggable
function makeDraggable(element) {
    let offsetX = 0, offsetY = 0, isDragging = false;
    
    // Only make the background and top area draggable (not the text itself)
    const dragHandle = element.querySelector('.readease-highlight-background');
    if (!dragHandle) return;
    
    dragHandle.addEventListener('mousedown', startDrag);
    
    function startDrag(e) {
        e.preventDefault();
        offsetX = e.clientX - element.getBoundingClientRect().left;
        offsetY = e.clientY - element.getBoundingClientRect().top;
        isDragging = true;
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
    }
    
    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        
        const x = e.clientX - offsetX + window.scrollX;
        const y = e.clientY - offsetY + window.scrollY;
        
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    }
    
    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
    }
}

function updateSelectionOverlay() {
    // Guard clauses to prevent errors
    if (!selectionOverlay) return;
    
    try {
        // Find the text element
        const text = selectionOverlay.querySelector('.readease-highlight-text');
        
        if (text) {
            // Update all style properties based on current settings
            text.style.fontFamily = getFontFamily(currentSettings.font || 'sans-serif');
            text.style.fontSize = `${currentSettings.fontSize || 16}px`;
            text.style.letterSpacing = `${currentSettings.letterSpacing || 0.12}em`;
            text.style.wordSpacing = `${currentSettings.wordSpacing || 0.16}em`;
            text.style.lineHeight = `${currentSettings.lineSpacing || 1.5}`;
            text.style.color = currentSettings.textColor || '#000000';
            text.style.backgroundColor = currentSettings.backgroundColor || '#f8f8f8';
            
            // Update any additional CSS properties if needed
            text.style.padding = '2px 4px';
            text.style.borderRadius = '3px';
        }
    } catch (error) {
        console.error('Error updating selection overlay:', error);
    }
}

function readTextAloud(text) {
    if (!currentSettings.textToSpeechEnabled) return;
    
    try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    } catch (error) {
        console.error('Text-to-speech error:', error);
    }
}

function createProcessedTextBox(text, processedText, processType) {
    const container = document.createElement('div');
    container.className = 'dyslexia-processed-text readease-element';
    
    const header = document.createElement('div');
    header.className = 'dyslexia-processed-header';
    
    const title = document.createElement('div');
    title.className = 'dyslexia-processed-title';
    
    let titleText = 'Original Text';
    let icon = '';
    
    if (processType === 'simplified') {
        titleText = 'Simplified Text';
        icon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>`;
    } else if (processType === 'phonetic') {
        titleText = 'Phonetic Breakdown';
        icon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>`;
    } else if (processType === 'loading') {
        titleText = 'Processing...';
        icon = `<div class="readease-spinner"></div>`;
    }
    
    title.innerHTML = `${icon} <span>${titleText}</span>`;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'readease-highlight-close';
    closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`;
    
    closeBtn.addEventListener('click', () => container.remove());
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    container.appendChild(header);
    
    // Main content area
    const content = document.createElement('div');
    content.className = 'dyslexia-processed-content';
    
    // Apply user's dyslexia settings
    content.style.fontFamily = getFontFamily(currentSettings.font || 'sans-serif');
    content.style.fontSize = `${currentSettings.fontSize || 16}px`;
    content.style.letterSpacing = `${currentSettings.letterSpacing || 0.12}em`;
    content.style.wordSpacing = `${currentSettings.wordSpacing || 0.16}em`;
    content.style.lineHeight = `${currentSettings.lineSpacing || 1.5}`;
    content.style.color = currentSettings.textColor || '#000000';
    
    if (processType === 'loading') {
        const loadingText = document.createElement('div');
        loadingText.className = 'readease-loading';
        loadingText.textContent = processedText || 'Processing content...';
        content.appendChild(loadingText);
    } else if (processType === 'simplified') {
        content.textContent = processedText;
    } else if (processType === 'phonetic') {
        // Handle phonetic display differently based on format
        if (typeof processedText === 'object') {
            const syllablesContent = document.createElement('div');
            syllablesContent.style.display = 'flex';
            syllablesContent.style.flexWrap = 'wrap';
            syllablesContent.style.gap = '8px';
            
            for (const [word, syllables] of Object.entries(processedText)) {
                const wordElem = document.createElement('div');
                wordElem.className = 'readease-syllable-word';
                
                const syllableElem = document.createElement('div');
                syllableElem.className = 'readease-syllable-text';
                syllableElem.textContent = syllables;
                
                const originalElem = document.createElement('div');
                originalElem.className = 'readease-original-word';
                originalElem.textContent = word;
                
                wordElem.appendChild(syllableElem);
                wordElem.appendChild(originalElem);
                syllablesContent.appendChild(wordElem);
            }
            
            content.appendChild(syllablesContent);
        } else {
            content.textContent = processedText;
        }
    }
    
    container.appendChild(content);
    
    // Add action buttons for non-loading states
    if (processType !== 'loading') {
        const actions = document.createElement('div');
        actions.className = 'readease-actions';
        
        // Read aloud button if enabled
        if (currentSettings.textToSpeechEnabled) {
            const readBtn = document.createElement('button');
            readBtn.className = 'readease-btn';
            readBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                Read Aloud
            `;
            readBtn.addEventListener('click', () => {
                if (processType === 'phonetic' && typeof processedText === 'object') {
                    // Format for speech
                    const syllableSpeechText = Object.entries(processedText)
                        .map(([word, syllables]) => `${word}: ${syllables.replace(/-/g, ', ')}`)
                        .join('. ');
                    readTextAloud(syllableSpeechText);
                } else {
                    readTextAloud(processedText);
                }
            });
            actions.appendChild(readBtn);
        }
        
        container.appendChild(actions);
    }
    
    // Add to document
    document.body.appendChild(container);
    
    // Position near current selection or center of viewport
    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        container.style.position = 'absolute';
        container.style.top = `${window.scrollY + rect.bottom + 10}px`;
        container.style.left = `${window.scrollX + rect.left}px`;
    } else {
        container.style.position = 'fixed';
        container.style.top = '20%';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
    }
    
    // Make container draggable by header
    header.style.cursor = 'move';
    let isDragging = false;
    let offsetX, offsetY;
    
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - container.getBoundingClientRect().left;
        offsetY = e.clientY - container.getBoundingClientRect().top;
        container.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        container.style.left = `${e.clientX - offsetX}px`;
        container.style.top = `${e.clientY - offsetY}px`;
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        container.style.cursor = 'auto';
    });
    
    return container;
}

// Toast notification for errors/messages
function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `readease-toast readease-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
        
        // Auto-remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }, 10);
}

// Process text for simplification
function processTextSelection(text) {
    if (!text || !currentSettings.rewriteEnabled) return;
    
    // Create loading container
    const loadingContainer = createProcessedTextBox(text, 'Simplifying text...', 'loading');
    
    // Request text simplification from the background script
    chrome.runtime.sendMessage({
        action: 'simplifyText',
        text: text,
        level: currentSettings.simplificationLevel
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error simplifying text:', chrome.runtime.lastError);
            loadingContainer.remove();
            showToast('Error simplifying text. Please try again.');
            return;
        }
        
        // Remove loading container
        loadingContainer.remove();
        
        if (response && response.simplifiedText) {
            // Create new container with simplified text
            createProcessedTextBox(text, response.simplifiedText, 'simplified');
        } else {
            showToast('Could not simplify text. Please try again.');
        }
    });
}

// Process text for phonetic/syllable breakdown
function handlePhoneticTranscription(text) {
    if (!text || !currentSettings.phoneticsEnabled) return;
    
    // Create loading container
    const loadingContainer = createProcessedTextBox(text, 'Analyzing syllables...', 'loading');
    
    chrome.runtime.sendMessage({
        action: 'getPhoneticTranscription',
        text: text
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error getting phonetic transcription:', chrome.runtime.lastError);
            loadingContainer.remove();
            showToast('Error analyzing syllables. Please try again.');
            return;
        }
        
        // Remove loading container
        loadingContainer.remove();
        
        if (response && response.phoneticText) {
            // Create new container with phonetic breakdown
            createProcessedTextBox(text, response.phoneticText, 'phonetic');
        } else {
            showToast('Could not analyze syllables. Please try again.');
        }
    });
}

// Legacy function for backward compatibility
function addPhoneticTranscription(element, text) {
    if (!text || !currentSettings.phoneticsEnabled) return;
    
    // Show loading indicator for syllables
    const loadingIndicator = document.createElement('div');
    loadingIndicator.classList.add('syllable-loading');
    loadingIndicator.textContent = 'Loading syllable breakdown...';
    loadingIndicator.style.fontSize = '90%';
    loadingIndicator.style.color = '#666';
    loadingIndicator.style.marginTop = '10px';
    loadingIndicator.style.fontStyle = 'italic';
    
    element.appendChild(loadingIndicator);
    
    chrome.runtime.sendMessage({
        action: 'getPhoneticTranscription',
        text: text
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error getting phonetic transcription:', chrome.runtime.lastError);
            loadingIndicator.textContent = 'Could not load syllable breakdown.';
            return;
        }
        
        // Remove the loading indicator
        loadingIndicator.remove();
        
        if (response && response.phoneticText) {
            // Create a styled container for syllables
            const syllablesContainer = document.createElement('div');
            syllablesContainer.classList.add('syllables-breakdown');
            syllablesContainer.style.marginTop = '15px';
            syllablesContainer.style.backgroundColor = '#f5f5f5';
            syllablesContainer.style.borderRadius = '5px';
            syllablesContainer.style.padding = '10px';
            syllablesContainer.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            
            const syllablesHeader = document.createElement('h4');
            syllablesHeader.textContent = 'Syllable Breakdown';
            syllablesHeader.style.margin = '0 0 10px 0';
            syllablesHeader.style.fontSize = '16px';
            syllablesHeader.style.color = '#333';
            syllablesContainer.appendChild(syllablesHeader);
            
            const syllablesContent = document.createElement('div');
            syllablesContent.style.display = 'flex';
            syllablesContent.style.flexWrap = 'wrap';
            syllablesContent.style.gap = '12px';
            
            // Process the phonetic text response
            if (typeof response.phoneticText === 'string') {
                // Simple fallback if string is returned instead of JSON
                syllablesContent.textContent = response.phoneticText;
            } else if (typeof response.phoneticText === 'object') {
                // Process each word/syllable pair
                for (const [word, syllables] of Object.entries(response.phoneticText)) {
                    const wordContainer = document.createElement('div');
                    wordContainer.className = 'syllable-word';
                    wordContainer.style.display = 'inline-flex';
                    wordContainer.style.flexDirection = 'column';
                    wordContainer.style.alignItems = 'center';
                    wordContainer.style.padding = '5px 10px';
                    wordContainer.style.backgroundColor = 'white';
                    wordContainer.style.borderRadius = '4px';
                    wordContainer.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
                    
                    // The syllable breakdown
                    const syllableText = document.createElement('div');
                    syllableText.className = 'syllable-text';
                    syllableText.textContent = syllables;
                    syllableText.style.color = '#3B82F6';
                    syllableText.style.fontWeight = 'bold';
                    syllableText.style.fontSize = '14px';
                    
                    // The original word (smaller, below)
                    const originalWord = document.createElement('div');
                    originalWord.className = 'original-word';
                    originalWord.textContent = word;
                    originalWord.style.fontSize = '12px';
                    originalWord.style.color = '#666';
                    originalWord.style.marginTop = '3px';
                    
                    wordContainer.appendChild(syllableText);
                    wordContainer.appendChild(originalWord);
                    syllablesContent.appendChild(wordContainer);
                }
            }
            
            syllablesContainer.appendChild(syllablesContent);
            element.appendChild(syllablesContainer);
            
            // Add a speak button for the syllables
            const speakSyllablesBtn = document.createElement('button');
            speakSyllablesBtn.textContent = '🔊 Speak Syllables';
            speakSyllablesBtn.style.display = 'block';
            speakSyllablesBtn.style.marginTop = '10px';
            speakSyllablesBtn.style.backgroundColor = '#3B82F6';
            speakSyllablesBtn.style.color = 'white';
            speakSyllablesBtn.style.border = 'none';
            speakSyllablesBtn.style.borderRadius = '4px';
            speakSyllablesBtn.style.padding = '5px 10px';
            speakSyllablesBtn.style.cursor = 'pointer';
            speakSyllablesBtn.style.fontSize = '14px';
            
            // Create syllable speech text
            let syllableSpeechText = '';
            if (typeof response.phoneticText === 'object') {
                // Format for speech: "banana: ba-na-na, apple: ap-ple"
                syllableSpeechText = Object.entries(response.phoneticText)
                    .map(([word, syllables]) => `${word}: ${syllables.replace(/-/g, ', ')}`)
                    .join('. ');
            }
            
            speakSyllablesBtn.addEventListener('click', () => {
                readTextAloud(syllableSpeechText || text);
            });
            
            syllablesContainer.appendChild(speakSyllablesBtn);
        }
    });
}

// Helper function to revert a single element back to its original state
function revertElement(item) {
    try {
        if (item.element && item.element.parentNode) {
            // Create a text node with the original content
            const textNode = document.createTextNode(item.originalContent);
            
            // Replace the modified element with the original text
            item.element.parentNode.replaceChild(textNode, item.element);
            
            // Remove the toolbar if it exists
            if (item.element.dataset && item.element.dataset.toolbarId) {
                const toolbar = document.getElementById(item.element.dataset.toolbarId);
                if (toolbar && toolbar.parentNode) {
                    toolbar.parentNode.removeChild(toolbar);
                }
            }
            
            // Remove this item from the tracking array
            const index = modifiedElements.findIndex(mod => mod.element === item.element);
            if (index !== -1) {
                modifiedElements.splice(index, 1);
            }
        }
    } catch (error) {
        console.error('Error reverting element:', error);
    }
}

function revertModifiedElements() {
    // Create a copy of the array since we'll be modifying it during iteration
    const elementsToRevert = [...modifiedElements];
    
    elementsToRevert.forEach(item => {
        try {
            if (item.element && item.element.parentNode) {
                const textNode = document.createTextNode(item.originalContent);
                item.element.parentNode.replaceChild(textNode, item.element);
                
                // Remove any associated toolbars
                if (item.element.dataset && item.element.dataset.toolbarId) {
                    const toolbar = document.getElementById(item.element.dataset.toolbarId);
                    if (toolbar && toolbar.parentNode) {
                        toolbar.parentNode.removeChild(toolbar);
                    }
                }
            }
        } catch (error) {
            console.error('Error reverting modified element:', error);
        }
    });
    
    modifiedElements = [];
}