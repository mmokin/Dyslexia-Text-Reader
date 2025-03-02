// Debug script to be loaded in popup.html
document.addEventListener('DOMContentLoaded', () => {
    // Add a debug button to the popup
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Debug Tabs';
    debugButton.style.position = 'absolute';
    debugButton.style.top = '5px';
    debugButton.style.right = '5px';
    debugButton.style.zIndex = '9999';
    debugButton.style.fontSize = '10px';
    debugButton.style.padding = '2px 5px';
    
    debugButton.onclick = function() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');
        
        console.clear();
        console.log('=== TAB DEBUG INFO ===');
        console.log('Tab Buttons:');
        tabButtons.forEach(btn => {
            console.log(`- ${btn.textContent.trim()}: data-tab=${btn.getAttribute('data-tab')}, active=${btn.classList.contains('active')}`);
        });
        
        console.log('\nTab Panes:');
        tabPanes.forEach(pane => {
            const computed = window.getComputedStyle(pane);
            console.log(`- ${pane.id}: active=${pane.classList.contains('active')}, display=${computed.display}, visibility=${computed.visibility}`);
        });
        
        // Force the active tab to be visible using inline styles
        const activePane = document.querySelector('.tab-pane.active');
        if (activePane) {
            activePane.style.display = 'block';
            console.log(`Forced display:block on active pane: ${activePane.id}`);
        }
        
        return false;
    };
    
    document.body.appendChild(debugButton);
    
    // Add direct click handlers to all tab buttons
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.onclick = function() {
            console.log(`Direct tab click: ${this.getAttribute('data-tab')}`);
            const tabId = this.getAttribute('data-tab');
            
            // Deactivate all tabs
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => {
                p.classList.remove('active');
                p.style.display = 'none';
            });
            
            // Activate selected tab
            this.classList.add('active');
            const pane = document.getElementById(tabId);
            if (pane) {
                pane.classList.add('active');
                pane.style.display = 'block';
                console.log(`Activated tab: ${tabId}`);
            }
            
            return false;
        };
    });
});
