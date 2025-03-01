chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "dyslexiaFriendly",
        title: "Make Dyslexia Friendly",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "dyslexiaFriendly") {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: processText,
            args: [info.selectionText]
        });
    }
});

async function processText(selectedText) {
    if (!selectedText) return;

    alert("Rewriting to be Dyslexia Friendly"); // Show popup

    const apiKey = "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"; // Replace with your actual OpenAI API key

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o", // If you have access to gpt-4o
                messages: [
                    { role: "system", content: "You are a helpful assistant that rewrites text to be more readable and dyslexia-friendly." },
                    { role: "user", content: `Rewrite this text to be more readable and dyslexia-friendly. Text should be summarized, written in active voice: "${selectedText}"` }
                ],
                max_tokens: 1000
            })
        });
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();

        if (data.choices && data.choices[0].message) {
            replaceHighlightedText(data.choices[0].message.content, "sans-serif");
        }
    } catch (error) {
        console.log("starting");
        console.error("Error:", error);
        console.log("ended");

        replaceHighlightedText(selectedText, "sans-serif");
    }


    // Define replaceHighlightedText function
    function replaceHighlightedText(newText, newFont) {
        console.log("Running with ");
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
    
        console.log("Replacing text with ", newText);
    
        const range = selection.getRangeAt(0);
        const span = document.createElement("span");
        span.textContent = newText.trim();
        span.style.fontFamily = newFont; // Change font
    
        range.deleteContents();
        range.insertNode(span);
    }
}


