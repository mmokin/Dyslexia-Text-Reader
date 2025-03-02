// Global variables
let currentSettings = {};
let isLoggedIn = false;
let currentUser = null;

// DOM elements
const extensionToggle = document.getElementById('extension-toggle');
const toggleStatus = document.getElementById('toggle-status');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const fontSelect = document.getElementById('font-select');
const fontSizeSlider = document.getElementById('font-size');
const fontSizeValue = document.getElementById('font-size-value');
const letterSpacingSlider = document.getElementById('letter-spacing');
const letterSpacingValue = document.getElementById('letter-spacing-value');
const wordSpacingSlider = document.getElementById('word-spacing');
const wordSpacingValue = document.getElementById('word-spacing-value');
const lineSpacingSlider = document.getElementById('line-spacing');
const lineSpacingValue = document.getElementById('line-spacing-value');
const textColorPicker = document.getElementById('text-color');
const backgroundColorPicker = document.getElementById('background-color');
const aiModelSelect = document.getElementById('ai-model-select');
const rewriteToggle = document.getElementById('rewrite-toggle');
const ttsToggle = document.getElementById('tts-toggle');
const phoneticsToggle = document.getElementById('phonetics-toggle');
const simplificationLevel = document.getElementById('simplification-level');
const saveSettingsBtn = document.getElementById('save-settings');
const resetSettingsBtn = document.getElementById('reset-settings');
const openaiKeyInput = document.getElementById('openai-key');

// Authentication elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const userProfile = document.getElementById('user-profile');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginMessage = document.getElementById('login-message');
const registerMessage = document.getElementById('register-message');
const profileUsername = document.getElementById('profile-username');
const profileEmail = document.getElementById('profile-email');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    // Load settings and extension state
    await loadSettings();
    
    // Set up tab navigation
    setupTabs();
    
    // Set up event listeners
    setupEventListeners();
    
    // Check login status
    checkLoginStatus();
});

// Load settings from storage
async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['dyslexiaSettings', 'extensionEnabled', 'apiKeys'], (data) => {
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
            }
            
            // Update UI with current settings
            updateSettingsUI();
            
            // Set extension toggle state
            let extensionEnabled = data.extensionEnabled !== undefined ? data.extensionEnabled : false;
            extensionToggle.checked = extensionEnabled;
            toggleStatus.textContent = extensionEnabled ? 'On' : 'Off';
            
            // Set API key
            if (data.apiKeys && data.apiKeys.openai) {
                openaiKeyInput.value = data.apiKeys.openai || '';
            }
            
            resolve();
        });
    });
}

// Update settings UI with current values
function updateSettingsUI() {
    // Features tab
    rewriteToggle.checked = currentSettings.rewriteEnabled;
    ttsToggle.checked = currentSettings.textToSpeechEnabled;
    phoneticsToggle.checked = currentSettings.phoneticsEnabled;
    simplificationLevel.value = currentSettings.simplificationLevel;
    
    // Settings tab
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

// Set up tab navigation
function setupTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to current button and corresponding pane
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Set up event listeners
function setupEventListeners() {
    // Main extension toggle
    extensionToggle.addEventListener('change', () => {
        const enabled = extensionToggle.checked;
        toggleStatus.textContent = enabled ? 'On' : 'Off';
        
        // Update extension state in background
        chrome.runtime.sendMessage({
            action: 'toggleExtension',
            enabled: enabled
        });
        
        // Save state to storage
        chrome.storage.sync.set({extensionEnabled: enabled});
    });
    
    // Feature toggles
    rewriteToggle.addEventListener('change', () => {
        currentSettings.rewriteEnabled = rewriteToggle.checked;
        saveSettings();
    });
    
    ttsToggle.addEventListener('change', () => {
        currentSettings.textToSpeechEnabled = ttsToggle.checked;
        saveSettings();
    });
    
    phoneticsToggle.addEventListener('change', () => {
        currentSettings.phoneticsEnabled = phoneticsToggle.checked;
        saveSettings();
    });
    
    simplificationLevel.addEventListener('change', () => {
        currentSettings.simplificationLevel = simplificationLevel.value;
        saveSettings();
    });
    
    // Settings changes
    fontSelect.addEventListener('change', () => {
        currentSettings.font = fontSelect.value;
    });
    
    fontSizeSlider.addEventListener('input', () => {
        currentSettings.fontSize = parseInt(fontSizeSlider.value);
        fontSizeValue.textContent = `${currentSettings.fontSize}px`;
    });
    
    letterSpacingSlider.addEventListener('input', () => {
        currentSettings.letterSpacing = parseFloat(letterSpacingSlider.value);
        letterSpacingValue.textContent = `${currentSettings.letterSpacing}em`;
    });
    
    wordSpacingSlider.addEventListener('input', () => {
        currentSettings.wordSpacing = parseFloat(wordSpacingSlider.value);
        wordSpacingValue.textContent = `${currentSettings.wordSpacing}em`;
    });
    
    lineSpacingSlider.addEventListener('input', () => {
        currentSettings.lineSpacing = parseFloat(lineSpacingSlider.value);
        lineSpacingValue.textContent = currentSettings.lineSpacing;
    });
    
    textColorPicker.addEventListener('change', () => {
        currentSettings.textColor = textColorPicker.value;
    });
    
    backgroundColorPicker.addEventListener('change', () => {
        currentSettings.backgroundColor = backgroundColorPicker.value;
    });
    
    aiModelSelect.addEventListener('change', () => {
        currentSettings.aiModel = aiModelSelect.value;
    });
    
    // Save and reset buttons
    saveSettingsBtn.addEventListener('click', () => {
        saveSettings();
        saveApiKey();
        
        // Show saved message
        const messageEl = document.createElement('div');
        messageEl.className = 'success-message';
        messageEl.textContent = 'Settings saved successfully!';
        document.querySelector('.buttons').prepend(messageEl);
        
        // Remove message after 3 seconds
        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    });
    
    resetSettingsBtn.addEventListener('click', () => {
        // Ask for confirmation
        if (confirm('Are you sure you want to reset all settings to default values?')) {
            // Reset settings to default
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
            
            // Update UI
            updateSettingsUI();
            
            // Save settings
            saveSettings();
            
            // Show reset message
            const messageEl = document.createElement('div');
            messageEl.className = 'success-message';
            messageEl.textContent = 'Settings reset to default!';
            document.querySelector('.buttons').prepend(messageEl);
            
            // Remove message after 3 seconds
            setTimeout(() => {
                messageEl.remove();
            }, 3000);
        }
    });
    
    // Authentication events
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        loginMessage.textContent = '';
    });
    
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        registerMessage.textContent = '';
    });
    
    loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        if (!username || !password) {
            loginMessage.textContent = 'Please enter both username and password';
            loginMessage.className = 'message error';
            return;
        }
        
        loginBtn.disabled = true;
        loginMessage.textContent = 'Logging in...';
        loginMessage.className = 'message info';
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'login',
                username: username,
                password: password
            });
            
            if (response.success) {
                isLoggedIn = true;
                currentUser = {
                    username: username,
                    userId: response.userId
                };
                
                showUserProfile();
                loginMessage.textContent = '';
            } else {
                loginMessage.textContent = response.error || 'Login failed';
                loginMessage.className = 'message error';
            }
        } catch (error) {
            loginMessage.textContent = 'An error occurred during login';
            loginMessage.className = 'message error';
        } finally {
            loginBtn.disabled = false;
        }
    });
    
    registerBtn.addEventListener('click', async () => {
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        
        if (!username || !email || !password) {
            registerMessage.textContent = 'Please fill out all fields';
            registerMessage.className = 'message error';
            return;
        }
        
        registerBtn.disabled = true;
        registerMessage.textContent = 'Creating account...';
        registerMessage.className = 'message info';
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'register',
                username: username,
                email: email,
                password: password
            });
            
            if (response.success) {
                registerMessage.textContent = 'Account created successfully! You can now log in.';
                registerMessage.className = 'message success';
                
                // Switch to login form after successful registration
                setTimeout(() => {
                    showLoginLink.click();
                }, 2000);
            } else {
                registerMessage.textContent = response.error || 'Registration failed';
                registerMessage.className = 'message error';
            }
        } catch (error) {
            registerMessage.textContent = 'An error occurred during registration';
            registerMessage.className = 'message error';
        } finally {
            registerBtn.disabled = false;
        }
    });
    
    logoutBtn.addEventListener('click', async () => {
        try {
            await chrome.runtime.sendMessage({action: 'logout'});
            isLoggedIn = false;
            currentUser = null;
            
            loginForm.style.display = 'block';
            userProfile.style.display = 'none';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
}

// Save settings to storage and send to background script
function saveSettings() {
    // Save settings to storage
    chrome.storage.sync.set({dyslexiaSettings: currentSettings});
    
    // Update background script with new settings
    chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: currentSettings
    });
}

// Save API key
function saveApiKey() {
    const apiKeys = {
        openai: openaiKeyInput.value.trim()
    };
    
    // Save API keys to storage
    chrome.storage.sync.set({apiKeys: apiKeys});
}

// Check login status
async function checkLoginStatus() {
    try {
        // Use message passing to background script instead of direct fetch
        const response = await chrome.runtime.sendMessage({
            action: 'checkLoginStatus'
        });
        
        if (response && response.isLoggedIn) {
            isLoggedIn = true;
            currentUser = {
                username: response.username,
                email: response.email,
                userId: response.userId
            };
            
            showUserProfile();
        }
    } catch (error) {
        console.error('Error checking login status:', error);
    }
}

// Show user profile
function showUserProfile() {
    if (currentUser) {
        profileUsername.textContent = currentUser.username;
        profileEmail.textContent = currentUser.email || 'Not provided';
        
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        userProfile.style.display = 'block';
    }
}