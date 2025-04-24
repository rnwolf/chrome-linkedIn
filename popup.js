// popup.js
document.addEventListener('DOMContentLoaded', function() {
    // Load saved items
    displaySavedItems();

    // Set up button listeners
    document.getElementById('saveProfile').addEventListener('click', saveProfile);
    document.getElementById('savePost').addEventListener('click', savePost);
    document.getElementById('saveCustom').addEventListener('click', saveCustomText);
    document.getElementById('createPost').addEventListener('click', createPost);
  });

  function displaySavedItems() {
    chrome.storage.local.get('savedItems', function(data) {
      const savedItems = data.savedItems || [];
      const container = document.getElementById('saved-items');
      container.innerHTML = '';

      if (savedItems.length === 0) {
        container.innerHTML = '<p>No saved items yet.</p>';
        return;
      }

      savedItems.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'saved-item';

        // Truncate text if too long
        const displayText = item.text.length > 100
          ? item.text.substring(0, 100) + '...'
          : item.text;

        itemElement.innerHTML = `
          <div><strong>${item.type}</strong> - ${new Date(item.date).toLocaleString()}</div>
          <div>${displayText}</div>
          <div class="saved-item-actions">
            <button class="copy-item" data-index="${index}">Copy</button>
            <button class="delete-item" data-index="${index}">Delete</button>
          </div>
        `;
        container.appendChild(itemElement);
      });

      // Add listeners to the new buttons
      document.querySelectorAll('.copy-item').forEach(button => {
        button.addEventListener('click', function() {
          const index = this.getAttribute('data-index');
          copyToClipboard(savedItems[index].text);
        });
      });

      document.querySelectorAll('.delete-item').forEach(button => {
        button.addEventListener('click', function() {
          const index = this.getAttribute('data-index');
          deleteSavedItem(index);
        });
      });
    });
  }

  function saveProfile() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: extractProfileInfo
      }, (results) => {
        if (results && results[0].result) {
          saveItem('Profile', results[0].result);
        }
      });
    });
  }

  function savePost() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: extractPostInfo
      }, (results) => {
        if (results && results[0].result) {
          saveItem('Post', results[0].result);
        }
      });
    });
  }

  function saveCustomText() {
    const text = document.getElementById('customText').value.trim();
    if (text) {
      saveItem('Custom', text);
      document.getElementById('customText').value = '';
    }
  }

  function saveItem(type, text) {
    chrome.storage.local.get('savedItems', function(data) {
      const savedItems = data.savedItems || [];
      savedItems.push({
        type: type,
        text: text,
        date: new Date().toISOString()
      });
      chrome.storage.local.set({savedItems: savedItems}, function() {
        displaySavedItems();
      });
    });
  }

  function deleteSavedItem(index) {
    chrome.storage.local.get('savedItems', function(data) {
      const savedItems = data.savedItems || [];
      savedItems.splice(index, 1);
      chrome.storage.local.set({savedItems: savedItems}, function() {
        displaySavedItems();
      });
    });
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }

  function createPost() {
    const postContent = document.getElementById('postContent').value.trim();
    if (!postContent) {
      alert('Please enter content for your post');
      return;
    }

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0].url.includes('linkedin.com')) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          args: [postContent],
          function: createLinkedInPost
        });
      } else {
        chrome.tabs.create({url: 'https://www.linkedin.com/feed/'}, function(tab) {
          // Wait for the page to load before injecting
          setTimeout(() => {
            chrome.scripting.executeScript({
              target: {tabId: tab.id},
              args: [postContent],
              function: createLinkedInPost
            });
          }, 3000);
        });
      }
    });
  }

  // Content script functions to be injected

  function extractProfileInfo() {
    if (!window.location.href.includes('/in/')) {
      return 'Not on a LinkedIn profile page';
    }

    // Get profile information
    const nameElement = document.querySelector('h1.text-heading-xlarge');
    const titleElement = document.querySelector('div.text-body-medium.break-words');
    const locationElement = document.querySelector('span.text-body-small.inline.t-black--light.break-words');

    // Get about section
    const aboutElement = document.querySelector('div.display-flex.ph5.pv3 div.pv-shared-text-with-see-more');

    let result = '';

    if (nameElement) result += 'Name: ' + nameElement.innerText + '\n';
    if (titleElement) result += 'Title: ' + titleElement.innerText + '\n';
    if (locationElement) result += 'Location: ' + locationElement.innerText + '\n';
    if (aboutElement) result += 'About: ' + aboutElement.innerText + '\n';

    // Get experience
    const experienceItems = document.querySelectorAll('li.artdeco-list__item.pvs-list__item--line-separated');
    if (experienceItems.length > 0) {
      result += '\nExperience:\n';
      experienceItems.forEach(item => {
        const title = item.querySelector('span[aria-hidden="true"]');
        if (title) {
          result += '- ' + title.innerText + '\n';
        }
      });
    }

    // Profile URL
    result += '\nProfile URL: ' + window.location.href;

    return result;
  }

  function extractPostInfo() {
    // Check for posts on the feed or articles
    const postElements = document.querySelectorAll('div.feed-shared-update-v2');

    if (postElements.length === 0) {
      return 'No posts found on this page';
    }

    // Get the first visible post (or the one in focus if possible)
    const mainPost = postElements[0];

    // Get post author
    const authorElement = mainPost.querySelector('span.feed-shared-actor__name');
    const authorName = authorElement ? authorElement.innerText : 'Unknown author';

    // Get post content
    const contentElement = mainPost.querySelector('div.feed-shared-update-v2__description');
    const postContent = contentElement ? contentElement.innerText : 'No content found';

    // Get post URL if possible
    let postUrl = '';
    const timestampElement = mainPost.querySelector('span.feed-shared-actor__sub-description a');
    if (timestampElement && timestampElement.href) {
      postUrl = timestampElement.href;
    }

    let result = `Post by: ${authorName}\n\nContent:\n${postContent}\n`;

    if (postUrl) {
      result += `\nPost URL: ${postUrl}`;
    }

    return result;
  }

  function createLinkedInPost(postContent) {
    // Find the post composer
    let postButton = document.querySelector('button.share-actions__primary-action') ||
                    document.querySelector('button.artdeco-button--primary:not([disabled])');

    if (!postButton) {
      // Try to open the post composer if it's not already open
      const startPostButton = document.querySelector('button[aria-label="Start a post"]') ||
                              document.querySelector('button.share-box-feed-entry__trigger');

      if (startPostButton) {
        startPostButton.click();

        // Give it a moment to open
        setTimeout(() => {
          // Find the post text area
          const postTextArea = document.querySelector('div[aria-placeholder="What do you want to talk about?"]') ||
                               document.querySelector('div[role="textbox"]');

          if (postTextArea) {
            // Set the content
            postTextArea.innerHTML = postContent;

            // Find the post button in the modal
            setTimeout(() => {
              postButton = document.querySelector('button.share-actions__primary-action') ||
                           document.querySelector('button.artdeco-button--primary:not([disabled])');

              if (postButton) {
                postButton.click();
              }
            }, 1000);
          }
        }, 1000);
      }
    } else {
      // The composer is already open
      const postTextArea = document.querySelector('div[aria-placeholder="What do you want to talk about?"]') ||
                           document.querySelector('div[role="textbox"]');

      if (postTextArea) {
        // Set the content
        postTextArea.innerHTML = postContent;

        // Now click the post button
        setTimeout(() => {
          postButton.click();
        }, 500);
      }
    }
  }
