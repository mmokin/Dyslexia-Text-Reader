// Global variables
let extensionEnabled = false;
let apiKeys = {};
let currentSettings = {
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
    phoneticsEnabled: false,
    userId: null
};

// Extension initialization
chrome.runtime.onInstalled.addListener(async () => {
    // Initialize extension state
    await loadSettings();
    
    // Create context menu items
    chrome.contextMenus.create({
        id: "dyslexiaFriendly",
        title: "Make Dyslexia Friendly",
        contexts: ["selection"]
    });
    
    chrome.contextMenus.create({
        id: "readAloud",
        title: "Read Text Aloud",
        contexts: ["selection"]
    });
    
    chrome.contextMenus.create({
        id: "simplifyText",
        title: "Simplify Text",
        contexts: ["selection"]
    });
    
    // Check if user is logged in
    await checkLoginStatus();
});

// Load settings from storage
async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['dyslexiaSettings', 'extensionEnabled', 'apiKeys'], (data) => {
            if (data.dyslexiaSettings) {
                currentSettings = data.dyslexiaSettings;
            } else {
                // Save default settings if none exist
                chrome.storage.sync.set({dyslexiaSettings: currentSettings});
            }
            
            if (data.extensionEnabled !== undefined) {
                extensionEnabled = data.extensionEnabled;
            } else {
                chrome.storage.sync.set({extensionEnabled: extensionEnabled});
            }
            
            if (data.apiKeys) {
                apiKeys = data.apiKeys;
            }
            
            resolve();
        });
    });
}

// Check if user is logged in
async function checkLoginStatus() {
    try {
        const response = await fetch('http://localhost:3000/api/auth/status', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.isLoggedIn && data.userId) {
                currentSettings.userId = data.userId;
                
                // Get user settings from server
                await fetchUserSettings(data.userId);
            }
        }
    } catch (error) {
        console.error('Error checking login status:', error);
    }
}

// Fetch user settings from server
async function fetchUserSettings(userId) {
    try {
        const response = await fetch(`http://localhost:3000/api/settings/${userId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.settings) {
                // Update local settings with server settings
                currentSettings = {...currentSettings, ...data.settings};
                // Save to local storage
                chrome.storage.sync.set({dyslexiaSettings: currentSettings});
                
                // Update all tabs with new settings
                updateAllTabs();
            }
        }
    } catch (error) {
        console.error('Error fetching user settings:', error);
    }
}

// Update all open tabs with current settings
function updateAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'updateSettings',
                settings: currentSettings
            }).catch(() => {
                // Ignore errors for tabs that don't have content script
            });
        });
    });
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "dyslexiaFriendly") {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: processTextForDyslexia,
            args: [info.selectionText, currentSettings]
        });
    } else if (info.menuItemId === "readAloud") {
        chrome.tabs.sendMessage(tab.id, {
            action: 'readAloud',
            text: info.selectionText
        });
    } else if (info.menuItemId === "simplifyText") {
        chrome.tabs.sendMessage(tab.id, {
            action: 'simplifyText',
            text: info.selectionText
        });
    }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleExtension') {
        extensionEnabled = message.enabled !== undefined ? message.enabled : !extensionEnabled;
        
        // Save state to storage
        chrome.storage.sync.set({extensionEnabled: extensionEnabled});
        
        // Update all tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'toggleExtension',
                    enabled: extensionEnabled
                }).catch(() => {
                    // Ignore errors for tabs that don't have content script
                });
            });
        });
        
        sendResponse({enabled: extensionEnabled});
    } else if (message.action === 'getStatus') {
        sendResponse({enabled: extensionEnabled, settings: currentSettings});
    } else if (message.action === 'updateSettings') {
        // Update settings
        currentSettings = {...currentSettings, ...message.settings};
        
        // Save to local storage
        chrome.storage.sync.set({dyslexiaSettings: currentSettings});
        
        // If user is logged in, save to server
        if (currentSettings.userId) {
            saveSettingsToServer(currentSettings);
        }
        
        // Update all tabs
        updateAllTabs();
        
        sendResponse({status: 'success'});
    } else if (message.action === 'readText') {
        // Use chrome TTS API to read text
        chrome.tts.speak(message.text, {
            rate: 1.0,
            pitch: 1.0,
            onEvent: function(event) {
                if (event.type === 'end') {
                    sendResponse({status: 'complete'});
                }
            }
        });
        sendResponse({status: 'started'});
    } else if (message.action === 'simplifyText') {
        // Process text using AI model
        processTextWithOpenAI(message.text, message.model || currentSettings.aiModel, message.level || currentSettings.simplificationLevel, "simplify")
            .then(simplifiedText => {
                if (sender.tab) {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        action: 'updateText',
                        simplifiedText: simplifiedText
                    });
                }
                sendResponse({simplifiedText: simplifiedText});
            })
            .catch(error => {
                console.error('Error simplifying text:', error);
                sendResponse({error: error.message});
            });
    } else if (message.action === 'getPhoneticTranscription') {
        // Process text using OpenAI to get phonetic transcription
        processTextWithOpenAI(message.text, 'gpt-3.5-turbo', 'medium', "phonetic")
            .then(phoneticText => {
                sendResponse({phoneticText: phoneticText});
            })
            .catch(error => {
                console.error('Error getting phonetic transcription:', error);
                sendResponse({error: error.message});
            });
    } else if (message.action === 'login') {
        // Handle login
        loginUser(message.username, message.password)
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                sendResponse({error: error.message});
            });
    } else if (message.action === 'logout') {
        // Handle logout
        logoutUser()
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                sendResponse({error: error.message});
            });
    } else if (message.action === 'register') {
        // Handle registration
        registerUser(message.username, message.password, message.email)
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                sendResponse({error: error.message});
            });
    } else if (message.action === 'updateContextMenu') {
        // Update context menu based on selection
        if (message.hasSelection) {
            chrome.contextMenus.update("dyslexiaFriendly", {visible: true});
            chrome.contextMenus.update("readAloud", {visible: true});
            chrome.contextMenus.update("simplifyText", {visible: true});
        } else {
            chrome.contextMenus.update("dyslexiaFriendly", {visible: false});
            chrome.contextMenus.update("readAloud", {visible: false});
            chrome.contextMenus.update("simplifyText", {visible: false});
        }
    }
    
    // Required for async responses
    return true;
});

// Save settings to server
async function saveSettingsToServer(settings) {
    if (!settings.userId) return;
    
    try {
        await fetch(`http://localhost:3000/api/settings/${settings.userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({settings})
        });
    } catch (error) {
        console.error('Error saving settings to server:', error);
    }
}

// Process text for dyslexia
async function processTextForDyslexia(selectedText, settings) {
    if (!selectedText) return;
    
    if (settings.rewriteEnabled) {
        try {
            const newText = await processTextWithOpenAI(selectedText, settings.aiModel, settings.simplificationLevel, "rewrite");
            replaceHighlightedText(newText, settings.font);
        } catch (error) {
            console.error('Error processing text:', error);
            // Fallback to original text with styling
            replaceHighlightedText(selectedText, settings.font);
        }
    } else {
        // Just apply styling without rewriting
        replaceHighlightedText(selectedText, settings.font);
    }
    
    // Define replaceHighlightedText function
    function replaceHighlightedText(newText, fontFamily) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const span = document.createElement("span");
        span.classList.add('dyslexia-processed');
        span.textContent = newText.trim();
        
        span.style.fontFamily = getFontFamily(fontFamily);
        span.style.letterSpacing = `${settings.letterSpacing}em`;
        span.style.wordSpacing = `${settings.wordSpacing}em`;
        span.style.lineHeight = settings.lineSpacing;
        
        range.deleteContents();
        range.insertNode(span);
    }
    
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
}

// Process text with OpenAI models
async function processTextWithOpenAI(text, model, level, purpose) {
    // Get API key
    const apiKey = apiKeys.openai;
    if (!apiKey) {
        throw new Error('No OpenAI API key available. Please add your API key in the settings.');
    }
    
    let systemPrompt;
    
    // Set purpose-specific instructions
    if (purpose === "rewrite") {
        switch (level) {
            case 'low':
                systemPrompt = "You are a helpful assistant that rewrites text to be more readable and dyslexia-friendly. Make minor changes to improve readability while keeping most of the original text.";
                break;
            case 'high':
                systemPrompt = "You are a helpful assistant that rewrites text to be more readable and dyslexia-friendly. Significantly simplify the text, focusing on clarity and ease of reading for someone with dyslexia.";
                break;
            case 'medium':
            default:
                systemPrompt = "You are a helpful assistant that rewrites text to be more readable and dyslexia-friendly. Text should be summarized, written in active voice.";
        }
    } else if (purpose === "simplify") {
        switch (level) {
            case 'low':
                systemPrompt = "You are a helpful assistant that simplifies text for people with dyslexia. Replace a few complex words with simpler alternatives while maintaining most of the original text.";
                break;
            case 'high':
                systemPrompt = "You are a helpful assistant that simplifies text for people with dyslexia. Replace all complex words with simpler alternatives and break down complex sentences into shorter, clearer ones.";
                break;
            case 'medium':
            default:
                systemPrompt = "You are a helpful assistant that simplifies text for people with dyslexia. Replace complex words with simpler alternatives and break down difficult sentences into more readable ones.";
        }
    } else if (purpose === "phonetic") {
        systemPrompt = "You are a helpful assistant that provides phonetic transcriptions of words. Break down the given words into syllables with hyphens. Format your response as a JSON object where each key is a word and its value is the syllable breakdown, for example: {\"example\": \"ex-am-ple\", \"syllable\": \"syl-la-ble\"}";
    }
    
    // Configure API call
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };
    
    let userPrompt;
    if (purpose === "phonetic") {
        userPrompt = `Provide syllable breakdowns for the following text. Respond with a JSON object only, no explanations: "${text}"`;
    } else {
        userPrompt = `${text}`;
    }
    
    const body = JSON.stringify({
        model: model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        max_tokens: 1000
    });
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: body
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const result = data.choices[0].message.content;
        
        // If this is a phonetic request, parse the JSON response
        if (purpose === "phonetic") {
            try {
                return JSON.parse(result);
            } catch (e) {
                console.error('Error parsing phonetic JSON response:', e);
                return result; // Return the raw text if JSON parsing fails
            }
        }
        
        return result;
    } catch (error) {
        console.error(`Error with OpenAI API:`, error);
        throw error;
    }
}

// User authentication functions
async function loginUser(username, password) {
    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({username, password})
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
        }
        
        const data = await response.json();
        
        // Update user ID in settings
        currentSettings.userId = data.userId;
        chrome.storage.sync.set({dyslexiaSettings: currentSettings});
        
        // Fetch user settings
        await fetchUserSettings(data.userId);
        
        return {success: true, userId: data.userId};
    } catch (error) {
        console.error('Login error:', error);
        return {success: false, error: error.message};
    }
}

async function logoutUser() {
    try {
        await fetch('http://localhost:3000/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        // Clear user ID from settings
        currentSettings.userId = null;
        chrome.storage.sync.set({dyslexiaSettings: currentSettings});
        
        return {success: true};
    } catch (error) {
        console.error('Logout error:', error);
        return {success: false, error: error.message};
    }
}

async function registerUser(username, password, email) {
    try {
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({username, password, email})
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Registration failed');
        }
        
        const data = await response.json();
        return {success: true, userId: data.userId};
    } catch (error) {
        console.error('Registration error:', error);
        return {success: false, error: error.message};
    }
}