// background.js
chrome.runtime.onInstalled.addListener(function() {
    console.log('LinkedIn Helper extension installed');

    // Initialize storage
    chrome.storage.local.get('savedItems', function(data) {
      if (!data.savedItems) {
        chrome.storage.local.set({savedItems: []});
      }
    });
  });
