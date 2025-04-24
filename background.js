// background.js
chrome.runtime.onInstalled.addListener(function() {
  console.log('LinkedIn Helper extension installed');

  // Initialize storage
  chrome.storage.local.get('savedItems', function(data) {
    if (!data.savedItems) {
      chrome.storage.local.set({savedItems: []});
    }
  });

  // Create dedicated folders for downloads
  chrome.downloads.download({
    url: 'data:text/plain;charset=utf-8,',
    filename: 'linkedin_helper/.keep',
    saveAs: false
  });

  chrome.downloads.download({
    url: 'data:text/plain;charset=utf-8,',
    filename: 'linkedin_helper/images/.keep',
    saveAs: false
  });

  chrome.downloads.download({
    url: 'data:text/plain;charset=utf-8,',
    filename: 'linkedin_helper/json/.keep',
    saveAs: false
  });
});
