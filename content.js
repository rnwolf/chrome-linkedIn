// content.js
console.log('LinkedIn Helper content script loaded');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getProfileInfo") {
    const profileInfo = extractProfileInfo();
    sendResponse({data: profileInfo});
  }
  else if (request.action === "getPostInfo") {
    const postInfo = extractPostInfo();
    sendResponse({data: postInfo});
  }
  else if (request.action === "createPost") {
    createLinkedInPost(request.content);
    sendResponse({success: true});
  }
  return true;  // Indicates we will send a response asynchronously
});

function extractProfileInfo() {
  // Same function as in popup.js, duplicated here for content script
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
  // Same function as in popup.js, duplicated here for content script
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
  // Same function as in popup.js, duplicated here for content script
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