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
  else if (request.action === "getSavedPosts") {
    const savedPosts = extractSavedPosts(request.count);
    sendResponse({data: savedPosts});
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

function extractLinkedInSavedPosts(postsCount) {
  console.log('Extracting saved posts, count:', postsCount);

  if (!window.location.href.includes('linkedin.com/my-items/saved-posts')) {
    return ['Not on LinkedIn saved posts page'];
  }

  // Wait for the content to load
  return new Promise((resolve) => {
    let checkInterval;
    let timeout;

    // Function to check if posts are loaded
    const checkForPosts = () => {
      // Look for saved post containers
      const postContainers = document.querySelectorAll('.artdeco-card, .artdeco-list__item');

      if (postContainers.length > 0) {
        clearInterval(checkInterval);
        clearTimeout(timeout);

        const results = [];
        let count = 0;

        // Process each post container up to the requested count
        for (const container of postContainers) {
          if (count >= postsCount) break;

          // Try different selectors to find post content
          const authorElement = container.querySelector('.feed-shared-actor__name, .update-components-actor__name');
          const contentElement = container.querySelector('.feed-shared-update-v2__description, .update-components-text');
          const timestampElement = container.querySelector('.feed-shared-actor__sub-description, .update-components-actor__sub-description');

          // Only process if we found content
          if (contentElement) {
            // Get the author name
            const authorName = authorElement ? authorElement.innerText.trim() : 'Unknown Author';

            // Get the post content
            const postContent = contentElement.innerText.trim();

            // Get the timestamp if available
            const timestamp = timestampElement ? timestampElement.innerText.trim() : '';

            // Get the post URL if possible
            let postUrl = '';
            const linkElement = container.querySelector('a.app-aware-link');
            if (linkElement && linkElement.href) {
              postUrl = linkElement.href;
            }

            // Find images in the post
            const images = [];
            const imageElements = container.querySelectorAll('img.feed-shared-image__image, img.update-components-image__image, img.embed-image__image');

            imageElements.forEach((img, index) => {
              // Skip profile pictures and reaction icons (usually smaller)
              if (img.width < 100 || img.height < 100) return;

              // Get the image src, prefer data-delayed-url (full quality) or srcset for best image
              let imageSrc = img.getAttribute('data-delayed-url') ||
                             img.currentSrc ||
                             img.src;

              // If there's a srcset, try to get the highest resolution version
              if (img.srcset) {
                const srcsetItems = img.srcset.split(',');
                if (srcsetItems.length > 0) {
                  // Get the last item (usually highest resolution)
                  const highestRes = srcsetItems[srcsetItems.length - 1].trim().split(' ')[0];
                  if (highestRes) imageSrc = highestRes;
                }
              }

              if (imageSrc && !imageSrc.includes('data:image')) {
                // Don't include LinkedIn UI images or tiny images
                if (!imageSrc.includes('linkedin.com/dms/image') &&
                    !imageSrc.includes('linkedin.com/media/') &&
                    !imageSrc.includes('ghost-image')) {
                  images.push({
                    src: imageSrc,
                    alt: img.alt || `Image ${index + 1}`
                  });
                }
              }
            });

            // Check for document attachments
            const documents = [];
            const documentElements = container.querySelectorAll('.feed-shared-document, .update-components-document');

            documentElements.forEach((doc, index) => {
              const titleElement = doc.querySelector('.feed-shared-document__title, .update-components-document__title');
              const title = titleElement ? titleElement.innerText.trim() : `Document ${index + 1}`;

              const docLinkElement = doc.querySelector('a');
              const docUrl = docLinkElement && docLinkElement.href ? docLinkElement.href : '';

              if (docUrl) {
                documents.push({
                  title: title,
                  url: docUrl
                });
              }
            });

            // Create a post object
            const post = {
              author: authorName,
              content: postContent,
              timestamp: timestamp,
              url: postUrl,
              images: images,
              documents: documents,
              savedAt: new Date().toISOString()
            };

            // Add to results
            results.push(post);
            count++;
          }
        }

        resolve(results);
      }
    };

    // Set an interval to check for posts
    checkInterval = setInterval(checkForPosts, 500);

    // Set a timeout to resolve even if posts aren't found
    timeout = setTimeout(() => {
      clearInterval(checkInterval);
      resolve([]);
    }, 10000); // 10 second timeout

    // Run the check immediately
    checkForPosts();
  });
}