import OpenAI from "openai";
const openai = new OpenAI();

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

    const apiKey = "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"; // Replace with your API key

    try {
        const data = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "developer", content: "You are a helpful assistant." },
                {
                    role: "user",
                    content: "Write a haiku about recursion in programming.",
                },
            ],
            store: true,
        });
        
        /*
        const response = await fetch("https://api.openai.com/v1/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                prompt: `Rewrite this text to be more readable and dyslexia-friendly. Text should be summarised, written in active voice: "${selectedText}"`,
                max_tokens: 100
            })
        });
        */

        //const data = await response.json();

        if (data.choices && data.choices[0].text) {
            replaceHighlightedText(data.choices[0].text, "Arial");
        }
    } catch (error) {
        printf("starting");
        console.error("Error:", error);
        printf("ended");

        replaceHighlightedText(selectedText, "Sans Serif");
    }
}

function replaceHighlightedText(newText, newFont) {
    printf("Running with %s", newFont);
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const span = document.createElement("span");
    span.textContent = newText.trim();
    span.style.fontFamily = newFont; // Change font

    range.deleteContents();
    range.insertNode(span);
}
