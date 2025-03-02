// Simple test script to debug tab switching
console.log('Test tabs script loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
    
    // Directly select the tab buttons and panes
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    console.log('Found tab buttons:', tabButtons.length);
    console.log('Found tab panes:', tabPanes.length);

    // Log each tab button and its data-tab attribute
    tabButtons.forEach(button => {
        console.log('Tab button:', button.textContent.trim(), 'data-tab:', button.getAttribute('data-tab'));
    });

    // Log each tab pane and its id
    tabPanes.forEach(pane => {
        console.log('Tab pane id:', pane.id, 'classes:', pane.className);
    });
    
    // Add click event listeners to tab buttons
    tabButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            console.log('Tab clicked:', button.getAttribute('data-tab'));
            
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                console.log('Removed active class from button:', btn.textContent.trim());
            });
            
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                console.log('Removed active class from pane:', pane.id);
            });
            
            // Add active class to current button
            button.classList.add('active');
            console.log('Added active class to button:', button.textContent.trim());
            
            // Get the tab ID and add active class to corresponding pane
            const tabId = button.getAttribute('data-tab');
            const targetPane = document.getElementById(tabId);
            
            if (targetPane) {
                targetPane.classList.add('active');
                console.log('Added active class to pane:', tabId);
            } else {
                console.error('Tab pane not found for id:', tabId);
            }
        });
    });
});
