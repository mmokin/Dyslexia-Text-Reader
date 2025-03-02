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

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get('dyslexiaExtensionEnabled', (data) => {
        if (data.dyslexiaExtensionEnabled === undefined) {
            chrome.storage.sync.set({dyslexiaExtensionEnabled: true});
            extensionEnabled = true;
        } else {
            extensionEnabled = data.dyslexiaExtensionEnabled;
        }
        updateExtensionIcon(extensionEnabled);
    });
    
    chrome.storage.sync.get('dyslexiaSettings', (data) => {
        if (!data.dyslexiaSettings) {
            const defaultSettings = {
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
            chrome.storage.sync.set({dyslexiaSettings: defaultSettings});
        }
    });
    
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
    
    chrome.contextMenus.create({
        id: "phoneticText",
        title: "Show Phonetic Breakdown",
        contexts: ["selection"]
    });
    
    chrome.contextMenus.create({
        id: "toggleExtension",
        title: "Toggle Extension On/Off",
        contexts: ["page"]
    });
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.sync.get('dyslexiaExtensionEnabled', (data) => {
        extensionEnabled = data.dyslexiaExtensionEnabled !== undefined ? data.dyslexiaExtensionEnabled : true;
        updateExtensionIcon(extensionEnabled);
    });
    
    loadSettings();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "dyslexiaFriendly") {
        chrome.tabs.sendMessage(tab.id, {
            action: 'updateSettings',
            settings: currentSettings
        }, () => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'applyDyslexiaStyles',
                text: info.selectionText
            });
        });
    } else if (info.menuItemId === "readAloud") {
        chrome.tabs.sendMessage(tab.id, {
            action: 'readAloud',
            text: info.selectionText
        });
    } else if (info.menuItemId === "simplifyText") {
        chrome.tabs.sendMessage(tab.id, {
            action: 'processText',
            text: info.selectionText
        });
    } else if (info.menuItemId === "phoneticText") {
        chrome.tabs.sendMessage(tab.id, {
            action: 'phoneticBreakdown',
            text: info.selectionText
        });
    } else if (info.menuItemId === "toggleExtension") {
        toggleExtension(tab.id);
    }
});

function toggleExtension(tabId) {
    chrome.storage.sync.get('dyslexiaExtensionEnabled', (data) => {
        const newState = !data.dyslexiaExtensionEnabled;
        chrome.storage.sync.set({dyslexiaExtensionEnabled: newState});
        
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                try {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'toggleExtension',
                        enabled: newState
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn(`Could not send message to tab ${tab.id}: ${chrome.runtime.lastError.message}`);
                        }
                    });
                } catch (error) {
                    console.error(`Error sending message to tab ${tab.id}:`, error);
                }
            });
        });
        
        updateExtensionIcon(newState);
    });
}

function getExtensionState(callback) {
    chrome.storage.sync.get('dyslexiaExtensionEnabled', (data) => {
        const isEnabled = data.dyslexiaExtensionEnabled !== undefined ? data.dyslexiaExtensionEnabled : true;
        callback(isEnabled);
    });
}

function updateExtensionIcon(isEnabled) {
    if (isEnabled) {
        chrome.action.setIcon({
            path: {
                "16": "icons/icon16.png",
                "48": "icons/icon48.png",
                "128": "icon.png"
            }
        });
        chrome.action.setBadgeText({ text: "" });
    } else {
        chrome.action.setIcon({
            path: {
                "16": "icons/icon16-disabled.png",
                "48": "icons/icon48-disabled.png",
                "128": "icon-disabled.png"
            }
        });
        chrome.action.setBadgeText({ text: "OFF" });
        chrome.action.setBadgeBackgroundColor({ color: "#888888" });
    }
}

async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['dyslexiaSettings', 'dyslexiaExtensionEnabled', 'apiKeys'], (data) => {
            if (data.dyslexiaSettings) {
                currentSettings = data.dyslexiaSettings;
            } else {
                chrome.storage.sync.set({dyslexiaSettings: currentSettings});
            }
            
            if (data.dyslexiaExtensionEnabled !== undefined) {
                extensionEnabled = data.dyslexiaExtensionEnabled;
            } else {
                chrome.storage.sync.set({dyslexiaExtensionEnabled: extensionEnabled});
            }
            
            if (data.apiKeys) {
                apiKeys = data.apiKeys;
                console.log('Loaded API keys:', apiKeys);
            } else {
                console.log('No API keys found in storage');
                apiKeys = {};
                chrome.storage.sync.set({apiKeys: apiKeys});
            }
            
            resolve();
        });
    });
}

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
                
                await fetchUserSettings(data.userId);
            }
        }
    } catch (error) {
        console.error('Error checking login status:', error);
    }
}

async function fetchUserSettings(userId) {
    try {
        const response = await fetch(`http://localhost:3000/api/settings/${userId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.settings) {
                currentSettings = {...currentSettings, ...data.settings};
                chrome.storage.sync.set({dyslexiaSettings: currentSettings});
                
                updateAllTabs();
            }
        }
    } catch (error) {
        console.error('Error fetching user settings:', error);
    }
}

function updateAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            try {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'updateSettings',
                    settings: currentSettings
                }, (response) => {
                    if (chrome.runtime.lastError) {
                    }
                });
            } catch (error) {
                console.error(`Error sending message to tab ${tab.id}:`, error);
            }
        });
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleExtension') {
        extensionEnabled = message.enabled !== undefined ? message.enabled : !extensionEnabled;
        
        chrome.storage.sync.set({dyslexiaExtensionEnabled: extensionEnabled});
        
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                try {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'toggleExtension',
                        enabled: extensionEnabled
                    });
                } catch (error) {
                    console.error(`Error sending message to tab ${tab.id}:`, error);
                }
            });
        });
        
        updateExtensionIcon(extensionEnabled);
        
        if (sendResponse) {
            sendResponse({enabled: extensionEnabled});
        }
        return true;
    } else if (message.action === 'getStatus') {
        if (sendResponse) {
            sendResponse({enabled: extensionEnabled, settings: currentSettings});
        }
        return true;
    } else if (message.action === 'updateSettings') {
        currentSettings = {...currentSettings, ...message.settings};
        
        chrome.storage.sync.set({dyslexiaSettings: currentSettings});
        
        if (currentSettings.userId) {
            saveSettingsToServer(currentSettings);
        }
        
        updateAllTabs();
        
        sendResponse({status: 'success'});
    } else if (message.action === 'updateApiKeys') {
        apiKeys = message.apiKeys || {};
        
        chrome.storage.sync.set({apiKeys: apiKeys});
        
        console.log('API keys updated:', apiKeys);
        
        sendResponse({status: 'success'});
    } else if (message.action === 'readText') {
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
        processTextWithOpenAI(message.text, 'gpt-3.5-turbo', 'medium', "phonetic")
            .then(phoneticText => {
                sendResponse({phoneticText: phoneticText});
            })
            .catch(error => {
                console.error('Error getting phonetic transcription:', error);
                sendResponse({error: error.message});
            });
    } else if (message.action === 'login') {
        loginUser(message.username, message.password)
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                sendResponse({error: error.message});
            });
    } else if (message.action === 'logout') {
        logoutUser()
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                sendResponse({error: error.message});
            });
    } else if (message.action === 'register') {
        registerUser(message.username, message.password, message.email)
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                sendResponse({error: error.message});
            });
    } else if (message.action === 'updateContextMenu') {
        try {
            if (message.hasSelection) {
                chrome.contextMenus.update("dyslexiaFriendly", {visible: true}, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('Error updating dyslexiaFriendly menu:', chrome.runtime.lastError);
                    }
                });
                chrome.contextMenus.update("readAloud", {visible: true}, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('Error updating readAloud menu:', chrome.runtime.lastError);
                    }
                });
                chrome.contextMenus.update("simplifyText", {visible: true}, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('Error updating simplifyText menu:', chrome.runtime.lastError);
                    }
                });
            } else {
                chrome.contextMenus.update("dyslexiaFriendly", {visible: false}, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('Error updating dyslexiaFriendly menu:', chrome.runtime.lastError);
                    }
                });
                chrome.contextMenus.update("readAloud", {visible: false}, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('Error updating readAloud menu:', chrome.runtime.lastError);
                    }
                });
                chrome.contextMenus.update("simplifyText", {visible: false}, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('Error updating simplifyText menu:', chrome.runtime.lastError);
                    }
                });
            }
        } catch (error) {
            console.error('Error updating context menus:', error);
        }
    }
    
    return true;
});

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


async function processTextWithOpenAI(text, model, level, purpose) {
    try {
        const apiKey = apiKeys.openai;
        if (!apiKey || apiKey.trim() === '') {
            throw new Error('No OpenAI API key available. Please add your API key in the extension settings (API tab).');
        }
        
        let systemPrompt;
        
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
            systemPrompt = "You are a helpful assistant specialized in syllable division for dyslexic readers. For each word in the text, split it into syllables using hyphens. Format your response as a JSON object where each key is a word and its value is the syllable breakdown. Example: {\"banana\": \"ba-na-na\", \"comprehension\": \"com-pre-hen-sion\"}. Follow rules for syllable division: (1) Divide between double consonants (hap-py), (2) Keep consonant blends and digraphs together (teach-er, not tea-cher), (3) Divide after short vowels followed by a consonant (lim-it), (4) Divide between roots and affixes (re-do, help-ful). Focus on clean, clear syllable divisions that will help pronunciation.";
        }
        
        const endpoint = 'https://api.openai.com/v1/chat/completions';
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`
        };
        
        let userPrompt;
        if (purpose === "phonetic") {
            userPrompt = `Provide syllable breakdowns for the following text. Respond with a JSON object only, no explanations: "${text}"`;
        } else {
            userPrompt = `${text}`;
        }
        
        console.log(`Processing text with model ${model} for purpose: ${purpose}`);
        
        const body = JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            max_tokens: 1000
        });
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: body
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API error:', errorData);
            throw new Error(`API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
        }
        
        const data = await response.json();
        const result = data.choices[0].message.content;
        
        if (purpose === "phonetic") {
            try {
                return JSON.parse(result);
            } catch (e) {
                console.error('Error parsing phonetic JSON response:', e);
                return result;
            }
        }
        
        return result;
    } catch (error) {
        console.error(`Error with OpenAI API:`, error);
        throw error;
    }
}

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
        
        if (response.ok) {
            const data = await response.json();
            
            currentSettings.userId = data.userId;
            chrome.storage.sync.set({dyslexiaSettings: currentSettings});
            
            await fetchUserSettings(data.userId);
            
            return {success: true, userId: data.userId};
        }
    } catch (serverError) {
        console.warn('Server authentication unavailable:', serverError);
        
        return await localLogin(username, password);
    }
}

async function logoutUser() {
    try {
        await fetch('http://localhost:3000/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (serverError) {
        console.warn('Server logout unavailable:', serverError);
    }
    
    currentSettings.userId = null;
    chrome.storage.sync.set({dyslexiaSettings: currentSettings});
    
    chrome.storage.local.remove('localAuthData');
    
    return {success: true};
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
        
        if (response.ok) {
            const data = await response.json();
            return {success: true, userId: data.userId};
        }
    } catch (serverError) {
        console.warn('Server registration unavailable:', serverError);
        
        return await localRegister(username, password, email);
    }
}

async function localLogin(username, password) {
    return new Promise((resolve) => {
        chrome.storage.local.get('localAuthData', (data) => {
            const users = data.localAuthData || [];
            const user = users.find(u => u.username === username);
            
            if (user && user.password === password) {
                currentSettings.userId = user.userId;
                chrome.storage.sync.set({dyslexiaSettings: currentSettings});
                
                resolve({success: true, userId: user.userId, message: 'Logged in locally (server unavailable)'});
            } else {
                resolve({success: false, error: 'Invalid username or password'});
            }
        });
    });
}

async function localRegister(username, password, email) {
    return new Promise((resolve) => {
        chrome.storage.local.get('localAuthData', (data) => {
            const users = data.localAuthData || [];
            
            if (users.some(u => u.username === username)) {
                resolve({success: false, error: 'Username already exists'});
                return;
            }
            
            const userId = 'local_' + Date.now().toString();
            const newUser = {
                userId,
                username,
                password,
                email,
                createdAt: new Date().toISOString()
            };
            
            users.push(newUser);
            chrome.storage.local.set({localAuthData: users}, () => {
                resolve({success: true, userId, message: 'Registered locally (server unavailable)'});
            });
        });
    });
}