// Initialize settings state
let currentSettings = {};
let isLoggedIn = false;
let currentUser = null;

// DOM elements will be initialized after the DOM is fully loaded
let extensionToggle, toggleStatus, tabButtons, tabPanes, fontSelect, fontSizeSlider;
let fontSizeValue, letterSpacingSlider, letterSpacingValue, wordSpacingSlider;
let wordSpacingValue, lineSpacingSlider, lineSpacingValue, textColorPicker;
let backgroundColorPicker, aiModelSelect, rewriteToggle, ttsToggle, phoneticsToggle;
let simplificationLevel, saveSettingsBtn, resetSettingsBtn, openaiKeyInput, fontPreview;
let loginForm, registerForm, userProfile, showRegisterLink, showLoginLink;
let loginBtn, registerBtn, logoutBtn, loginMessage, statusDiv, serverConnected, serverDisconnected;

// Function to initialize all DOM element references
function initDOMElements() {
    extensionToggle = document.getElementById('extension-toggle');
    toggleStatus = document.getElementById('toggle-status');
    tabButtons = document.querySelectorAll('.tab-btn');
    tabPanes = document.querySelectorAll('.tab-pane');
    fontSelect = document.getElementById('font-select');
    fontSizeSlider = document.getElementById('font-size');
    fontSizeValue = document.getElementById('font-size-value');
    letterSpacingSlider = document.getElementById('letter-spacing');
    letterSpacingValue = document.getElementById('letter-spacing-value');
    wordSpacingSlider = document.getElementById('word-spacing');
    wordSpacingValue = document.getElementById('word-spacing-value');
    lineSpacingSlider = document.getElementById('line-spacing');
    lineSpacingValue = document.getElementById('line-spacing-value');
    textColorPicker = document.getElementById('text-color');
    backgroundColorPicker = document.getElementById('background-color');
    aiModelSelect = document.getElementById('ai-model-select');
    rewriteToggle = document.getElementById('rewrite-toggle');
    ttsToggle = document.getElementById('tts-toggle');
    phoneticsToggle = document.getElementById('phonetics-toggle');
    simplificationLevel = document.getElementById('simplification-level');
    saveSettingsBtn = document.getElementById('save-settings');
    resetSettingsBtn = document.getElementById('reset-settings');
    openaiKeyInput = document.getElementById('openai-key');
    fontPreview = document.getElementById('font-preview');
    
    loginForm = document.getElementById('login-form');
    registerForm = document.getElementById('register-form');
    userProfile = document.getElementById('user-profile');
    showRegisterLink = document.getElementById('show-register');
    showLoginLink = document.getElementById('show-login');
    loginBtn = document.getElementById('login-btn');
    registerBtn = document.getElementById('register-btn');
    logoutBtn = document.getElementById('logout-btn');
    loginMessage = document.getElementById('login-message');
    statusDiv = document.getElementById('server-status');
    serverConnected = document.getElementById('server-connected');
    serverDisconnected = document.getElementById('server-disconnected');
}

document.addEventListener('DOMContentLoaded', async () => {
    // Use a small timeout to ensure all DOM elements are fully loaded
    setTimeout(async () => {
        try {
            // Initialize DOM elements first
            initDOMElements();
            
            if (!fontPreview || !extensionToggle) {
                console.error('Critical DOM elements missing. Aborting initialization.');
                return;
            }
            
            // Load settings and check server status in parallel
            const [serverStatus] = await Promise.all([
                checkServerStatus(),
                loadSettings()
            ]);
            
            // Set up UI components
            setupTabs();
            setupEventListeners();
            updateFontPreview(currentSettings.font);
            
            // Check login status
            await checkLoginStatus();
            updateAuthUI();
        } catch (error) {
            console.error('Error initializing extension:', error);
        }
    }, 100); // Increase timeout slightly to ensure DOM is ready
});

async function checkServerStatus() {
    try {
        // Use Promise.race to implement timeout since fetch doesn't natively support timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timed out')), 2000)
        );
        
        const fetchPromise = fetch('http://localhost:3000/api/status', {
            method: 'GET'
        });
        
        // Race the fetch against the timeout
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (response.ok) {
            serverConnected.style.display = 'block';
            serverDisconnected.style.display = 'none';
            return true;
        } else {
            throw new Error('Server responded with error');
        }
    } catch (error) {
        serverConnected.style.display = 'none';
        serverDisconnected.style.display = 'block';
        return false;
    }
}

async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['dyslexiaSettings', 'dyslexiaExtensionEnabled', 'apiKeys'], (data) => {
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
            
            updateSettingsUI();
            
            let extensionEnabled = data.dyslexiaExtensionEnabled !== undefined ? data.dyslexiaExtensionEnabled : false;
            extensionToggle.checked = extensionEnabled;
            toggleStatus.textContent = extensionEnabled ? 'On' : 'Off';
            
            if (data.apiKeys && data.apiKeys.openai) {
                openaiKeyInput.value = data.apiKeys.openai || '';
            }
            
            resolve();
        });
    });
}

function updateSettingsUI() {
    // Ensure DOM elements exist before trying to access them
    if (!rewriteToggle || !ttsToggle || !phoneticsToggle || !simplificationLevel ||
        !fontSelect || !fontSizeSlider || !fontSizeValue || !letterSpacingSlider ||
        !letterSpacingValue || !wordSpacingSlider || !wordSpacingValue ||
        !lineSpacingSlider || !lineSpacingValue || !textColorPicker ||
        !backgroundColorPicker || !aiModelSelect) {
        console.error('DOM elements not initialized in updateSettingsUI');
        return;
    }
    
    rewriteToggle.checked = currentSettings.rewriteEnabled;
    ttsToggle.checked = currentSettings.textToSpeechEnabled;
    phoneticsToggle.checked = currentSettings.phoneticsEnabled;
    simplificationLevel.value = currentSettings.simplificationLevel;
    
    fontSelect.value = currentSettings.font;
    fontSizeSlider.value = currentSettings.fontSize;
    fontSizeValue.textContent = `${currentSettings.fontSize}px`;
    letterSpacingSlider.value = currentSettings.letterSpacing;
    letterSpacingValue.textContent = `${currentSettings.letterSpacing}em`;
    wordSpacingSlider.value = currentSettings.wordSpacing;
    wordSpacingValue.textContent = `${currentSettings.wordSpacing}em`;
    lineSpacingSlider.value = currentSettings.lineSpacing;
    lineSpacingValue.textContent = currentSettings.lineSpacing;
    textColorPicker.value = currentSettings.textColor;
    backgroundColorPicker.value = currentSettings.backgroundColor;
    aiModelSelect.value = currentSettings.aiModel;
}

function setupTabs() {
    // Get tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    if (!tabButtons || tabButtons.length === 0) {
        console.error('No tab buttons found');
        return;
    }
    
    // Simplified tab setup that works reliably
    tabButtons.forEach(button => {
        if (!button) return;
        
        button.addEventListener('click', function(event) {
            event.preventDefault();
            
            const tabId = this.getAttribute('data-tab');
            if (!tabId) {
                console.error('Tab button missing data-tab attribute');
                return;
            }
            
            // Update button active states
            document.querySelectorAll('.tab-btn').forEach(btn => {
                if (btn) btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // Update tab pane visibility
            const tabPanes = document.querySelectorAll('.tab-pane');
            if (tabPanes) {
                tabPanes.forEach(pane => {
                    if (pane) {
                        pane.classList.remove('active');
                        pane.style.display = 'none';
                    }
                });
            }
            
            const tabPane = document.getElementById(tabId);
            if (tabPane) {
                tabPane.classList.add('active');
                tabPane.style.display = 'block';
            } else {
                console.error(`Tab pane with id ${tabId} not found`);
            }
        });
    });
    
    // Ensure the initial active tab is properly set
    const activeTabButton = document.querySelector('.tab-btn.active');
    if (activeTabButton) {
        const tabId = activeTabButton.getAttribute('data-tab');
        if (tabId) {
            const tabPane = document.getElementById(tabId);
            if (tabPane) {
                const tabPanes = document.querySelectorAll('.tab-pane');
                if (tabPanes) {
                    tabPanes.forEach(pane => {
                        if (pane) {
                            pane.classList.remove('active');
                            pane.style.display = 'none';
                        }
                    });
                }
                tabPane.classList.add('active');
                tabPane.style.display = 'block';
            }
        }
    } else {
        // If no active tab is set, try to activate the first tab
        const firstTabButton = document.querySelector('.tab-btn');
        if (firstTabButton) {
            firstTabButton.classList.add('active');
            const tabId = firstTabButton.getAttribute('data-tab');
            if (tabId) {
                const tabPane = document.getElementById(tabId);
                if (tabPane) {
                    tabPane.classList.add('active');
                    tabPane.style.display = 'block';
                }
            }
        }
    }
}

function setupEventListeners() {
    // Check if required DOM elements exist
    if (!extensionToggle || !toggleStatus) {
        console.error('Extension toggle elements missing');
        return;
    }
    
    // Extension toggle
    extensionToggle.addEventListener('change', () => {
        const enabled = extensionToggle.checked;
        toggleStatus.textContent = enabled ? 'On' : 'Off';
        
        chrome.runtime.sendMessage({
            action: 'toggleExtension',
            enabled: enabled
        });
        
        chrome.storage.sync.set({dyslexiaExtensionEnabled: enabled});
    });
    
    // Feature toggles
    if (rewriteToggle) {
        rewriteToggle.addEventListener('change', () => {
            currentSettings.rewriteEnabled = rewriteToggle.checked;
            saveSettings();
        });
    }
    
    if (ttsToggle) {
        ttsToggle.addEventListener('change', () => {
            currentSettings.textToSpeechEnabled = ttsToggle.checked;
            saveSettings();
        });
    }
    
    if (phoneticsToggle) {
        phoneticsToggle.addEventListener('change', () => {
            currentSettings.phoneticsEnabled = phoneticsToggle.checked;
            saveSettings();
        });
    }
    
    if (simplificationLevel) {
        simplificationLevel.addEventListener('change', () => {
            currentSettings.simplificationLevel = simplificationLevel.value;
            saveSettings();
        });
    }
    
    // Font settings
    if (fontSelect) {
        fontSelect.addEventListener('change', () => {
            currentSettings.font = fontSelect.value;
            updateFontPreview(currentSettings.font);
        });
    }
    
    if (fontSizeSlider && fontSizeValue) {
        fontSizeSlider.addEventListener('input', () => {
            currentSettings.fontSize = parseInt(fontSizeSlider.value);
            fontSizeValue.textContent = `${currentSettings.fontSize}px`;
        });
    }
    
    if (letterSpacingSlider && letterSpacingValue) {
        letterSpacingSlider.addEventListener('input', () => {
            currentSettings.letterSpacing = parseFloat(letterSpacingSlider.value);
            letterSpacingValue.textContent = `${currentSettings.letterSpacing}em`;
        });
    }
    
    if (wordSpacingSlider && wordSpacingValue) {
        wordSpacingSlider.addEventListener('input', () => {
            currentSettings.wordSpacing = parseFloat(wordSpacingSlider.value);
            wordSpacingValue.textContent = `${currentSettings.wordSpacing}em`;
        });
    }
    
    if (lineSpacingSlider && lineSpacingValue) {
        lineSpacingSlider.addEventListener('input', () => {
            currentSettings.lineSpacing = parseFloat(lineSpacingSlider.value);
            lineSpacingValue.textContent = currentSettings.lineSpacing;
        });
    }
    
    if (textColorPicker) {
        textColorPicker.addEventListener('change', () => {
            currentSettings.textColor = textColorPicker.value;
            saveSettings();
        });
    }
    
    if (backgroundColorPicker) {
        backgroundColorPicker.addEventListener('change', () => {
            currentSettings.backgroundColor = backgroundColorPicker.value;
            saveSettings();
        });
    }
    
    if (aiModelSelect) {
        aiModelSelect.addEventListener('change', () => {
            currentSettings.aiModel = aiModelSelect.value;
        });
    }
    
    // Settings buttons
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            saveSettings();
            saveApiKey();
            
            const buttonsContainer = document.querySelector('.buttons');
            if (buttonsContainer) {
                const messageEl = document.createElement('div');
                messageEl.className = 'success-message';
                messageEl.textContent = 'Settings saved successfully!';
                buttonsContainer.prepend(messageEl);
                
                setTimeout(() => {
                    if (messageEl && messageEl.parentNode) {
                        messageEl.remove();
                    }
                }, 3000);
            }
        });
    }
    
    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all settings to default values?')) {
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
                
                updateSettingsUI();
                saveSettings();
                
                const buttonsContainer = document.querySelector('.buttons');
                if (buttonsContainer) {
                    const messageEl = document.createElement('div');
                    messageEl.className = 'success-message';
                    messageEl.textContent = 'Settings reset to defaults!';
                    buttonsContainer.prepend(messageEl);
                    
                    setTimeout(() => {
                        if (messageEl && messageEl.parentNode) {
                            messageEl.remove();
                        }
                    }, 3000);
                }
            }
        });
    }
    
    // Authentication buttons
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            login();
        });
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            register();
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    // Navigation links
    if (showRegisterLink && loginForm && registerForm) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
        });
    }
    
    if (showLoginLink && loginForm && registerForm) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
        });
    }
}

function updateFontPreview(fontFamily) {
    // Check if the font preview element exists
    if (!fontPreview) {
        console.error('Font preview element not found');
        return;
    }
    
    // Make sure we're loading the right font
    const fontFamilyStr = getFontFamily(fontFamily);
    fontPreview.style.fontFamily = fontFamilyStr;
    
    // Force a layout update to ensure font is applied
    fontPreview.style.opacity = '0.99';
    setTimeout(() => {
        if (fontPreview) {
            fontPreview.style.opacity = '1';
        }
    }, 10);
    
    // Add a class to enable specific font styling
    fontPreview.className = 'font-preview';
    fontPreview.classList.add(`preview-${fontFamily}`);
    
    saveSettings();
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
        case 'century-gothic':
            return 'Century Gothic, sans-serif';
        case 'comic-sans':
            return 'Comic Sans MS, sans-serif';
        case 'open-dyslexic':
            return 'OpenDyslexic, sans-serif';
        default:
            return 'sans-serif';
    }
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        showLoginError('Please enter both username and password');
        return;
    }
    
    try {
        const serverAvailable = await checkServerStatus();
        
        if (serverAvailable) {
            const response = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                isLoggedIn = true;
                currentUser = {
                    username: data.username,
                    email: data.email,
                    userId: data.userId
                };
                
                currentSettings.userId = data.userId;
                saveSettings();
                
                updateAuthUI();
            } else {
                const errorData = await response.json();
                showLoginError(errorData.message || 'Login failed');
            }
        } else {
            loginWithLocalFallback(username, password);
        }
    } catch (error) {
        console.error('Login error:', error);
        loginWithLocalFallback(username, password);
    }
}

function loginWithLocalFallback(username, password) {
    chrome.storage.local.get(['users'], (data) => {
        const users = data.users || {};
        
        if (users[username] && users[username].password === password) {
            isLoggedIn = true;
            currentUser = {
                username: username,
                email: users[username].email || '',
                userId: username
            };
            
            currentSettings.userId = username;
            saveSettings();
            
            updateAuthUI();
        } else {
            showLoginError('Invalid username or password. Using local auth.');
        }
    });
}

async function register() {
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    if (!username || !email || !password || !confirmPassword) {
        showRegisterError('Please fill in all fields');
        return;
    }
    
    if (password !== confirmPassword) {
        showRegisterError('Passwords do not match');
        return;
    }
    
    try {
        const serverAvailable = await checkServerStatus();
        
        if (serverAvailable) {
            const response = await fetch('http://localhost:3000/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });
            
            if (response.ok) {
                registerForm.style.display = 'none';
                loginForm.style.display = 'block';
                showLoginMessage('Registration successful! Please login.');
            } else {
                const errorData = await response.json();
                showRegisterError(errorData.message || 'Registration failed');
            }
        } else {
            registerWithLocalFallback(username, email, password);
        }
    } catch (error) {
        console.error('Registration error:', error);
        registerWithLocalFallback(username, email, password);
    }
}

function registerWithLocalFallback(username, email, password) {
    chrome.storage.local.get(['users'], (data) => {
        const users = data.users || {};
        
        if (users[username]) {
            showRegisterError('Username already exists. Using local auth.');
            return;
        }
        
        users[username] = {
            email: email,
            password: password
        };
        
        chrome.storage.local.set({users: users}, () => {
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
            showLoginMessage('Registration successful! Please login. Using local auth.');
        });
    });
}

async function logout() {
    try {
        const serverAvailable = await checkServerStatus();
        
        if (serverAvailable) {
            await fetch('http://localhost:3000/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        }
        
        isLoggedIn = false;
        currentUser = null;
        currentSettings.userId = null;
        saveSettings();
        
        updateAuthUI();
    } catch (error) {
        console.error('Logout error:', error);
        
        isLoggedIn = false;
        currentUser = null;
        currentSettings.userId = null;
        saveSettings();
        
        updateAuthUI();
    }
}

function updateAuthUI() {
    // Check for necessary DOM elements
    const authContainer = document.getElementById('auth-container');
    const profileUsername = document.getElementById('profile-username');
    const profileEmail = document.getElementById('profile-email');
    const profileEmailContainer = document.getElementById('profile-email-container');
    
    if (!authContainer || !userProfile || !loginForm || !registerForm) {
        console.error('Missing DOM elements for authentication UI');
        return;
    }
    
    if (isLoggedIn && currentUser) {
        authContainer.style.display = 'none';
        userProfile.style.display = 'block';
        
        if (profileUsername) {
            profileUsername.textContent = currentUser.username;
        }
        
        if (currentUser.email && profileEmail) {
            profileEmail.textContent = currentUser.email;
        } else if (profileEmailContainer) {
            profileEmailContainer.style.display = 'none';
        }
    } else {
        authContainer.style.display = 'block';
        userProfile.style.display = 'none';
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    }
}

function showLoginError(message) {
    const errorElement = document.getElementById('login-error');
    if (!errorElement) {
        console.error('Login error element not found');
        return;
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    setTimeout(() => {
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }, 5000);
}

function showLoginMessage(message) {
    if (!loginMessage) {
        console.error('Login message element not found');
        return;
    }
    
    loginMessage.textContent = message;
    loginMessage.style.display = 'block';
    loginMessage.className = 'auth-message success';
    
    setTimeout(() => {
        if (loginMessage) {
            loginMessage.style.display = 'none';
        }
    }, 5000);
}

function showRegisterError(message) {
    const errorElement = document.getElementById('register-error');
    if (!errorElement) {
        console.error('Register error element not found');
        return;
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    setTimeout(() => {
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }, 5000);
}

function saveSettings() {
    // Make sure we have valid settings to save
    if (!currentSettings) {
        console.error('No settings to save');
        return;
    }
    
    chrome.storage.sync.set({dyslexiaSettings: currentSettings});
    
    chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: currentSettings
    });
}

function saveApiKey() {
    if (!openaiKeyInput) {
        console.error('OpenAI key input element not found');
        return;
    }
    
    const apiKeys = {
        openai: openaiKeyInput.value.trim()
    };
    
    // Save to storage
    chrome.storage.sync.set({apiKeys: apiKeys});
    
    // Also update in the background script
    chrome.runtime.sendMessage({
        action: 'updateApiKeys',
        apiKeys: apiKeys
    });
    
    // Show confirmation
    const apiTabPane = document.getElementById('api-tab');
    if (apiTabPane) {
        const messageEl = document.createElement('div');
        messageEl.className = 'success-message';
        messageEl.textContent = 'API key saved successfully!';
        messageEl.style.marginTop = '10px';
        
        // Remove any existing messages
        const existingMessage = apiTabPane.querySelector('.success-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        apiTabPane.appendChild(messageEl);
        setTimeout(() => {
            if (messageEl && messageEl.parentNode) {
                messageEl.remove();
            }
        }, 3000);
    }
}

async function checkLoginStatus() {
    try {
        // First try to get server login status
        const serverAvailable = await checkServerStatus();
        
        if (serverAvailable) {
            try {
                const response = await fetch('http://localhost:3000/api/auth/status', {
                    method: 'GET',
                    credentials: 'include',
                    timeout: 3000 // 3 second timeout
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.isLoggedIn && data.userId) {
                        isLoggedIn = true;
                        currentUser = {
                            username: data.username,
                            email: data.email,
                            userId: data.userId
                        };
                        
                        currentSettings.userId = data.userId;
                        saveSettings();
                        
                        // Save as last logged in user for offline support
                        chrome.storage.local.set({
                            lastLoggedInUser: currentUser
                        });
                        
                        return true;
                    }
                }
            } catch (fetchError) {
                console.error('Fetch error when checking login status:', fetchError);
            }
        }
        
        // Fall back to local storage if server is unavailable or returned an error
        return new Promise((resolve) => {
            chrome.storage.local.get(['lastLoggedInUser'], (data) => {
                if (data.lastLoggedInUser) {
                    isLoggedIn = true;
                    currentUser = data.lastLoggedInUser;
                    
                    currentSettings.userId = currentUser.userId;
                    saveSettings();
                    
                    console.log('Using stored login data for:', currentUser.username);
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    } catch (error) {
        console.error('Error in checkLoginStatus:', error);
        return false;
    }
}