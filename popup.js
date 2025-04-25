document.getElementById('downloadBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.id) {
      console.error("Could not get active tab.");
      // Optionally display an error message in the popup here
      return;
    }

    const tabId = activeTab.id;

    // 1. Try sending a message first to see if the content script is already injected
    chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
      if (chrome.runtime.lastError) {
        // Error sending message - likely content script isn't injected yet
        console.log("Content script not ready, injecting...");
        // 2. Inject the script if the message failed
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error injecting script:", chrome.runtime.lastError.message);
            // Handle injection error (e.g., show message in popup)
            return;
          }
          // 3. Script injected, now send the actual download command
          console.log("Script injected successfully, sending download command.");
          sendDownloadCommand(tabId);
        });
      } else {
        // Message sent successfully, content script is already there
        console.log("Content script already active, sending download command.");
        // 3. Send the actual download command
        sendDownloadCommand(tabId);
      }
    });
  });
});

function sendDownloadCommand(tabId) {
  chrome.tabs.sendMessage(tabId, { action: "downloadPostContent" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending download command:", chrome.runtime.lastError.message);
      // Handle error (e.g., show message in popup)
    } else if (response && response.status === "error") {
      console.error("Content script error:", response.message);
      // Handle error reported by content script (e.g., show message in popup)
    } else if (response && response.status === "success") {
      console.log("Download command processed successfully by content script.");
      // Optionally close the popup or show a success message
      window.close();
    } else {
        console.log("Received response from content script:", response);
    }
  });
}