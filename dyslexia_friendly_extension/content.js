// Global variables
let extensionEnabled = false;
let currentSettings = {};

// Initialize extension
document.addEventListener('DOMContentLoaded', async () => {
    // Load user settings
    await loadSettings();

    // Setup toggle listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'toggleExtension') {
            extensionEnabled = message.enabled;
            if (extensionEnabled) {
                applyDyslexiaStyles();
            } else {
                removeDyslexiaStyles();
            }
            sendResponse({status: 'success'});
        } else if (message.action === 'updateSettings') {
            currentSettings = message.settings;
            if (extensionEnabled) {
                applyDyslexiaStyles();
            }
            sendResponse({status: 'success'});
        } else if (message.action === 'readAloud') {
            readTextAloud(message.text);
            sendResponse({status: 'success'});
        } else if (message.action === 'simplifyText') {
            simplifyText(message.text, message.element);
            sendResponse({status: 'pending'});
        } else if (message.action === 'getStatus') {
            sendResponse({enabled: extensionEnabled});
        }
        return true;
    });

    // Check for initial status
    chrome.runtime.sendMessage({action: 'getStatus'}, (response) => {
        if (response && response.enabled) {
            extensionEnabled = true;
            applyDyslexiaStyles();
        }
    });
});

// Load settings from storage
async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get('dyslexiaSettings', (data) => {
            if (data.dyslexiaSettings) {
                currentSettings = data.dyslexiaSettings;
            } else {
                // Default settings
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
                // Save default settings
                chrome.storage.sync.set({dyslexiaSettings: currentSettings});
            }
            resolve();
        });
    });
}

// Apply dyslexia-friendly styles to the page
function applyDyslexiaStyles() {
    // Create style element if it doesn't exist
    let styleEl = document.getElementById('dyslexia-styles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dyslexia-styles';
        document.head.appendChild(styleEl);
    }

    // Apply styles based on current settings
    styleEl.textContent = `
        body, p, div, span, h1, h2, h3, h4, h5, h6, a, li, td, th {
            font-family: ${getFontFamily(currentSettings.font)} !important;
            font-size: ${currentSettings.fontSize}px !important;
            letter-spacing: ${currentSettings.letterSpacing}em !important;
            word-spacing: ${currentSettings.wordSpacing}em !important;
            line-height: ${currentSettings.lineSpacing} !important;
            color: ${currentSettings.textColor} !important;
            background-color: ${currentSettings.backgroundColor} !important;
        }
    `;

    // Add dyslexia-friendly overlay
    let overlay = document.getElementById('dyslexia-overlay');
    if (!overlay && currentSettings.backgroundColor !== '#ffffff') {
        overlay = document.createElement('div');
        overlay.id = 'dyslexia-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = currentSettings.backgroundColor;
        overlay.style.opacity = '0.3';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '9999';
        document.body.appendChild(overlay);
    }
}

// Remove dyslexia-friendly styles
function removeDyslexiaStyles() {
    const styleEl = document.getElementById('dyslexia-styles');
    if (styleEl) {
        styleEl.remove();
    }

    const overlay = document.getElementById('dyslexia-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Get font family based on selection
function getFontFamily(fontChoice) {
    switch (fontChoice) {
        case 'open-dyslexic':
            return '"OpenDyslexic", sans-serif';
        case 'comic-sans':
            return '"Comic Sans MS", cursive';
        case 'arial':
            return 'Arial, sans-serif';
        case 'sans-serif':
        default:
            return 'sans-serif';
    }
}

// Text to speech functionality
function readTextAloud(text) {
    if (!text) {
        text = window.getSelection().toString();
    }
    
    if (text && currentSettings.textToSpeechEnabled) {
        chrome.runtime.sendMessage({
            action: 'readText',
            text: text
        });
    }
}

// Simplify selected text
function simplifyText(text, elementSelector) {
    if (!text) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            text = selection.toString();
        }
    }
    
    if (text && currentSettings.rewriteEnabled) {
        chrome.runtime.sendMessage({
            action: 'simplifyText',
            text: text,
            level: currentSettings.simplificationLevel,
            model: currentSettings.aiModel,
            elementSelector: elementSelector
        }, (response) => {
            if (response && response.simplifiedText) {
                replaceSelectedText(response.simplifiedText);
            }
        });
    }
}

// Replace selected text with new content
function replaceSelectedText(newText) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.classList.add('dyslexia-processed');
        span.textContent = newText;
        
        // Apply phonetic transcription if enabled
        if (currentSettings.phoneticsEnabled) {
            addPhoneticTranscription(span, newText);
        }
        
        range.deleteContents();
        range.insertNode(span);
    }
}

// Add phonetic transcription using OpenAI API
async function addPhoneticTranscription(element, text) {
    // Split text into words for processing
    const words = text.split(/\s+/);
    let longWords = words.filter(word => word.length > 4);
    
    // Only process if there are long words
    if (longWords.length > 0) {
        try {
            // Send request to get phonetic transcription from OpenAI
            const response = await chrome.runtime.sendMessage({
                action: 'getPhoneticTranscription',
                text: longWords.join(' ')
            });
            
            // Check if we got a valid response
            if (response && response.phoneticText) {
                const phoneticMap = response.phoneticText;
                let phoneticHtml = '';
                
                // Create HTML with phonetic transcriptions
                words.forEach(word => {
                    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    
                    if (cleanWord.length > 4 && phoneticMap[cleanWord]) {
                        phoneticHtml += `<span class="word-container">
                            <span class="word">${word}</span>
                            <span class="phonetic">(${phoneticMap[cleanWord]})</span>
                        </span> `;
                    } else {
                        phoneticHtml += `<span class="word">${word}</span> `;
                    }
                });
                
                element.innerHTML = phoneticHtml;
            } else {
                // Fallback to just showing the text if API fails
                element.textContent = text;
            }
        } catch (error) {
            console.error('Error getting phonetic transcription:', error);
            element.textContent = text;
        }
    } else {
        // Just show the text if no long words to process
        element.textContent = text;
    }
}

// Add context menu actions for quick access
document.addEventListener('contextmenu', (event) => {
    if (extensionEnabled) {
        const selection = window.getSelection().toString();
        if (selection) {
            chrome.runtime.sendMessage({
                action: 'updateContextMenu',
                hasSelection: true
            });
        }
    }
});

// Listen for keyboard shortcuts
document.addEventListener('keydown', (event) => {
    // Ctrl+Shift+D to toggle extension
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        chrome.runtime.sendMessage({action: 'toggleExtension'});
    }
    
    // Ctrl+Shift+R to read selected text
    if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        readTextAloud();
    }
    
    // Ctrl+Shift+S to simplify selected text
    if (event.ctrlKey && event.shiftKey && event.key === 'S') {
        simplifyText();
    }
});