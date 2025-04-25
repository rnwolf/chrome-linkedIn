// c:\Users\rnwol\workspace\chrome-linkedIn\popup.js

const postBtn = document.getElementById('downloadPostBtn');
const contactBtn = document.getElementById('downloadContactBtn');

// Function to check URL and enable/disable contact button
function checkUrlAndUpdateButtons(url) {
    if (url && url.startsWith('https://www.linkedin.com/in/')) {
        contactBtn.disabled = false;
        postBtn.disabled = true; // Optionally disable post button on profile pages
    } else if (url && url.includes('linkedin.com')) {
        // Assume it might be a feed or other page where posts exist
        contactBtn.disabled = true;
        postBtn.disabled = false;
    } else {
        // Disable both if not on LinkedIn
        contactBtn.disabled = true;
        postBtn.disabled = true;
    }
}

// --- Event Listeners ---

postBtn.addEventListener('click', () => {
    handleActionRequest('downloadPostContent');
});

contactBtn.addEventListener('click', () => {
    handleActionRequest('downloadContactInfo');
});

// --- Initialization ---

// Get the current tab URL when the popup opens to set initial button states
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab && activeTab.url) {
        checkUrlAndUpdateButtons(activeTab.url);
    } else {
        // Default to disabled if URL not accessible
        contactBtn.disabled = true;
        postBtn.disabled = true;
    }
});


// --- Helper Functions ---

function handleActionRequest(actionName) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab || !activeTab.id) {
            console.error("Could not get active tab.");
            displayErrorInPopup("Could not access current tab.");
            return;
        }
        const tabId = activeTab.id;

        // Try sending a ping first
        chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
            if (chrome.runtime.lastError) {
                console.log("Content script not ready, injecting...");
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Error injecting script:", chrome.runtime.lastError.message);
                        displayErrorInPopup("Failed to inject script.");
                        return;
                    }
                    console.log("Script injected successfully, sending command:", actionName);
                    sendCommandToContentScript(tabId, actionName);
                });
            } else {
                console.log("Content script already active, sending command:", actionName);
                sendCommandToContentScript(tabId, actionName);
            }
        });
    });
}

function sendCommandToContentScript(tabId, action) {
    chrome.tabs.sendMessage(tabId, { action: action }, (response) => {
        if (chrome.runtime.lastError) {
            console.error(`Error sending ${action} command:`, chrome.runtime.lastError.message);
            displayErrorInPopup(`Error: ${chrome.runtime.lastError.message}`);
        } else if (response && response.status === "error") {
            console.error("Content script error:", response.message);
            displayErrorInPopup(`Error: ${response.message}`);
        } else if (response && response.status === "success") {
            console.log(`${action} command processed successfully by content script.`);
            window.close(); // Close popup on success
        } else {
            console.log(`Received response from content script for ${action}:`, response);
            // Potentially handle unexpected responses or provide feedback
        }
    });
}

// Optional: Function to display errors in the popup itself
function displayErrorInPopup(message) {
    let errorDiv = document.getElementById('error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
        errorDiv.style.color = 'red';
        errorDiv.style.marginTop = '10px';
        errorDiv.style.fontSize = '12px';
        document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
}
