// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // Load saved items
  displaySavedItems();

  // Set up button listeners
  document.getElementById('saveProfile').addEventListener('click', saveProfile);
  document.getElementById('savePost').addEventListener('click', savePost);
  document.getElementById('saveCustom').addEventListener('click', saveCustomText);
  document.getElementById('createPost').addEventListener('click', createPost);

  // Set up saved posts button listeners
  document.getElementById('goToSavedPosts').addEventListener('click', goToSavedPostsPage);
  document.getElementById('downloadSavedPosts').addEventListener('click', downloadSavedPosts);

  //
  document.getElementById('debugSavedPosts').addEventListener('click', debugSavedPostsPage);
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

function goToSavedPostsPage() {
  chrome.tabs.create({ url: 'https://www.linkedin.com/my-items/saved-posts/' });
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


function extractSavedPosts(tabId, postsCount, downloadImages, statusElement) {
  statusElement.innerHTML = 'Extracting saved posts...';

  chrome.scripting.executeScript({
    target: {tabId: tabId},
    function: function(count) {
      console.log('Attempting to extract saved posts, requested count:', count);

      if (!window.location.href.includes('linkedin.com/my-items/saved-posts')) {
        return { error: 'Not on LinkedIn saved posts page', url: window.location.href };
      }

      // Function to get visible text content, avoiding hidden elements
      function getVisibleText(element) {
        if (!element) return '';

        // Check if element or its parents are hidden
        let currentEl = element;
        while (currentEl) {
          const style = window.getComputedStyle(currentEl);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return '';
          }
          currentEl = currentEl.parentElement;
        }

        // Get direct text of this element (excluding child elements)
        let text = '';
        for (const node of element.childNodes) {
          if (node.nodeType === 3) { // Text node
            text += node.textContent;
          }
        }

        // If no direct text, get all text content
        if (!text.trim()) {
          text = element.innerText || element.textContent || '';
        }

        return text.trim();
      }

      // Function to extract text content from an element and its children
      function extractTextContent(element) {
        if (!element) return '';

        // Try to get just the text without child elements first
        let text = getVisibleText(element);

        // If that didn't work, try to get text from paragraphs and other text elements
        if (!text) {
          const textElements = element.querySelectorAll('p, span, div[class*="text"], div[class*="content"]');
          for (const el of textElements) {
            const elText = getVisibleText(el);
            if (elText && elText.length > text.length) {
              text = elText;
            }
          }
        }

        return text;
      }

      // Wait for the content to load and try various selectors
      return new Promise((resolve) => {
        let checkInterval;
        let timeout;

        // Function to check if posts are loaded
        const checkForPosts = () => {
          // First, look for any scroll container that might contain posts
          const scrollContainers = document.querySelectorAll([
            '.scaffold-finite-scroll__content',
            '.feed-shared-update-v2',
            '.artdeco-card',
            '.scaffold-layout__main',
            '.search-results-container',
            '[data-view-name="myitems-saved-posts-entity-list"]',
            '.entity-result'
          ].join(', '));

          console.log(`Found ${scrollContainers.length} potential scroll containers`);

          if (scrollContainers.length > 0) {
            // Now try to find individual post items within these containers
            let allCandidatePostItems = [];

            scrollContainers.forEach(container => {
              // Strategy 1: Look for standard LinkedIn post containers
              const standardPosts = container.querySelectorAll([
                '.feed-shared-update-v2',
                '.occludable-update',
                '.artdeco-card',
                '.entity-result__item',
                '.update-components-actor',
                '.entity-result',
                '.update-components-post',
                '.entity-hovercard'
              ].join(', '));

              // Strategy 2: Look for divs that could be posts based on their structure
              // Find divs that have a substantial height and likely contain post content
              const contentDivs = Array.from(container.querySelectorAll('div'))
                .filter(div => {
                  // Check size - posts are usually substantial in size
                  const rect = div.getBoundingClientRect();
                  const hasSize = rect.height > 100 && rect.width > 200;

                  // Check for common post indicators
                  const hasImage = div.querySelector('img') !== null;
                  const hasText = div.innerText.length > 50;
                  const hasLink = div.querySelector('a') !== null;

                  return hasSize && (hasImage || hasText || hasLink);
                });

              allCandidatePostItems = [...allCandidatePostItems, ...Array.from(standardPosts), ...contentDivs];
            });

            // Remove duplicates (some items might be found by multiple strategies)
            const uniquePostItems = [...new Set(allCandidatePostItems)];

            console.log(`Found ${uniquePostItems.length} potential post items`);

            // If we found some potential posts, process them
            if (uniquePostItems.length > 0) {
              clearInterval(checkInterval);
              clearTimeout(timeout);

              const results = [];
              const processedItems = new Set(); // Track items we've processed to avoid duplicates

              // Process each potential post item up to the requested count
              uniquePostItems.forEach(item => {
                // Skip if we've already reached the desired count or if we've processed this item
                if (results.length >= count || processedItems.has(item)) {
                  return;
                }

                try {
                  processedItems.add(item);

                  // Extract author information - try various selectors
                  let authorElement = null;
                  const authorSelectors = [
                    '.feed-shared-actor__name',
                    '.update-components-actor__name',
                    '.entity-result__title-text',
                    '.update-components-actor__title',
                    '.entity-hovercard-content__main-content h3',
                    '.display-flex h3',
                    'a[data-control-name="actor"]',
                    '[data-test-app-aware-link]'
                  ];

                  for (const selector of authorSelectors) {
                    const found = item.querySelector(selector);
                    if (found) {
                      authorElement = found;
                      break;
                    }
                  }

                  // Extract content information - try various selectors
                  let contentElement = null;
                  const contentSelectors = [
                    '.feed-shared-update-v2__description',
                    '.update-components-text',
                    '.feed-shared-text',
                    '.entity-result__summary',
                    '.visually-hidden',
                    'p',
                    '[data-test-app-aware-link]',
                    '[class*="description"]',
                    '[class*="content"]',
                    '[class*="text"]'
                  ];

                  for (const selector of contentSelectors) {
                    const elements = item.querySelectorAll(selector);
                    if (elements.length > 0) {
                      // Find the element with the most substantial text
                      contentElement = Array.from(elements)
                        .filter(el => getVisibleText(el).length > 20) // At least 20 chars
                        .sort((a, b) => getVisibleText(b).length - getVisibleText(a).length)[0];

                      if (contentElement) break;
                    }
                  }

                  // If we still didn't find content, look for any substantial text
                  if (!contentElement) {
                    const allTextElements = item.querySelectorAll('p, span, div');
                    for (const el of allTextElements) {
                      const text = getVisibleText(el);
                      if (text && text.length > 30) { // At least 30 chars
                        contentElement = el;
                        break;
                      }
                    }
                  }

                  // Get the actual text content
                  const authorName = authorElement ? extractTextContent(authorElement) : 'Unknown Author';
                  const postContent = contentElement ? extractTextContent(contentElement) : '';

                  // If we don't have meaningful content, just get the general text of the item
                  const fullText = postContent || item.innerText.trim();

                  // If we have either author or some text, continue processing
                  if (authorName !== 'Unknown Author' || fullText.length > 30) {
                    // Try to get the post URL
                    let postUrl = '';
                    // First try links near the timestamp/content
                    const links = item.querySelectorAll('a');
                    for (const link of links) {
                      if (link.href && link.href.includes('linkedin.com/') &&
                         !link.href.includes('/in/') && // Not a profile
                         !link.href.includes('mynetwork')) { // Not a connection request
                        postUrl = link.href;
                        break;
                      }
                    }

                    // Find images in the post
                    const images = [];
                    const imageElements = item.querySelectorAll('img');

                    imageElements.forEach((img, index) => {
                      // Skip tiny images (likely icons)
                      if (img.width < 60 || img.height < 60) return;

                      // Get image URL
                      let imageSrc = img.getAttribute('data-delayed-url') ||
                                   img.currentSrc ||
                                   img.src;

                      if (imageSrc && !imageSrc.includes('data:image') &&
                          !imageSrc.includes('profile-displayphoto') && // Skip profile pics
                          imageSrc.length > 15) {
                        images.push({
                          src: imageSrc,
                          alt: img.alt || `Image ${index + 1}`,
                          width: img.width,
                          height: img.height
                        });
                      }
                    });

                    // Create a post object
                    const post = {
                      author: authorName,
                      content: fullText,
                      url: postUrl,
                      images: images,
                      savedAt: new Date().toISOString()
                    };

                    // Add to results
                    results.push(post);
                    console.log(`Processed post #${results.length}: ${authorName.substring(0, 30)}`);
                  }
                } catch (error) {
                  console.error('Error processing post:', error);
                }
              });

              console.log(`Successfully extracted ${results.length} posts`);
              resolve({
                posts: results,
                debugInfo: {
                  totalCandidates: uniquePostItems.length,
                  url: window.location.href,
                  title: document.title
                }
              });
            } else {
              console.log('Found containers but no post items yet. Waiting...');
            }
          } else {
            console.log('No scroll containers found yet. Waiting...');
          }
        };

        // Set an interval to check for posts
        checkInterval = setInterval(checkForPosts, 1000);

        // Set a timeout to resolve even if posts aren't found
        timeout = setTimeout(() => {
          clearInterval(checkInterval);

          // Final attempt before giving up
          checkForPosts();

          // If still no results, try one more approach - less restrictive
          const anyContentElements = document.querySelectorAll('div[class*="content"], div[class*="card"], div[class*="entity"]');
          console.log(`Last resort: found ${anyContentElements.length} potential content elements`);

          if (anyContentElements.length > 0) {
            const results = [];

            // Process the first few elements that seem substantive
            Array.from(anyContentElements)
              .filter(el => el.innerText.length > 100) // Has substantial text
              .slice(0, count) // Only take what we need
              .forEach((element, index) => {
                results.push({
                  content: element.innerText.substring(0, 1000), // Limit content length
                  savedAt: new Date().toISOString(),
                  notes: 'Extracted using fallback method, structure may be imperfect'
                });
              });

            if (results.length > 0) {
              console.log(`Found ${results.length} items using fallback method`);
              resolve({
                posts: results,
                debugInfo: {
                  method: 'fallback',
                  url: window.location.href
                }
              });
              return;
            }
          }

          // If we got here, we couldn't find anything useful
          resolve({
            posts: [],
            debugInfo: {
              error: 'Timeout reached without finding posts',
              html: document.documentElement.innerHTML.substring(0, 5000),
              url: window.location.href
            }
          });
        }, 15000); // 15 second timeout

        // Run the check immediately
        checkForPosts();
      });
    },
    args: [postsCount]
  }, (results) => {
    if (results && results[0].result) {
      const data = results[0].result;
      const posts = data.posts || [];

      if (posts.length === 0) {
        console.log('No posts found. Debug info:', data.debugInfo);
        statusElement.innerHTML = `No saved posts found. Debug details in console.`;
        return;
      }

      statusElement.innerHTML = `Found ${posts.length} saved posts!`;

      // Save the extracted posts
      posts.forEach(post => {
        saveItem('LinkedIn Saved Post', JSON.stringify(post, null, 2));
      });

      // Create a timestamp for the export
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const folderPrefix = 'linkedin_helper';

      // Download images if requested
      let imageCount = 0;
      if (downloadImages) {
        const downloadPromises = [];

        posts.forEach((post, postIndex) => {
          if (post.images && post.images.length > 0) {
            post.images.forEach((image, imgIndex) => {
              if (image.src) {
                try {
                  // Create a more descriptive filename
                  const author = (post.author || 'unknown').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
                  const filename = `${author}_post${postIndex+1}_image${imgIndex+1}.jpg`;

                  const imagePromise = downloadImage(image.src, `${folderPrefix}/${filename}`);
                  downloadPromises.push(imagePromise);
                  imageCount++;

                  // Add local reference to the image
                  image.localPath = `${folderPrefix}/${filename}`;
                } catch (e) {
                  console.error('Error preparing image download:', e);
                }
              }
            });
          }
        });

        statusElement.innerHTML = `Processing ${posts.length} posts with ${imageCount} images...`;

        // Export as JSON file
        const jsonBlob = new Blob([JSON.stringify({
          posts: posts,
          metadata: {
            extractedAt: new Date().toISOString(),
            totalPosts: posts.length,
            totalImages: imageCount,
            source: data.debugInfo?.url || window.location.href,
            title: data.debugInfo?.title || document.title
          }
        }, null, 2)], {type: 'application/json'});

        const jsonUrl = URL.createObjectURL(jsonBlob);

        chrome.downloads.download({
          url: jsonUrl,
          filename: `${folderPrefix}/saved_posts_${timestamp}.json`,
          saveAs: false
        }, () => {
          URL.revokeObjectURL(jsonUrl);
        });

        // Wait for all images to download
        Promise.allSettled(downloadPromises).then(results => {
          const successfulDownloads = results.filter(r => r.status === 'fulfilled').length;
          statusElement.innerHTML = `Downloaded ${posts.length} posts with ${successfulDownloads}/${imageCount} images successfully!`;
        }).catch(err => {
          console.error('Error downloading images:', err);
          statusElement.innerHTML = `Downloaded ${posts.length} posts, but some images failed to download.`;
        });
      } else {
        // Export only the JSON file without downloading images
        const jsonBlob = new Blob([JSON.stringify({
          posts: posts,
          metadata: {
            extractedAt: new Date().toISOString(),
            totalPosts: posts.length,
            source: data.debugInfo?.url || window.location.href,
            title: data.debugInfo?.title || document.title
          }
        }, null, 2)], {type: 'application/json'});

        const jsonUrl = URL.createObjectURL(jsonBlob);

        chrome.downloads.download({
          url: jsonUrl,
          filename: `${folderPrefix}/saved_posts_${timestamp}.json`,
          saveAs: false
        }, () => {
          URL.revokeObjectURL(jsonUrl);
          statusElement.innerHTML = `Downloaded ${posts.length} posts successfully!`;
        });
      }
    } else {
      statusElement.innerHTML = 'Error extracting posts. Check console for details.';
      console.error('Extraction error:', results);
    }
  });
}

// Helper function to download an image
function downloadImage(imageUrl, filename) {
  return new Promise((resolve, reject) => {
    // For security reasons, we can't directly download cross-origin images
    // We'll use chrome.downloads API instead
    chrome.downloads.download({
      url: imageUrl,
      filename: filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download error:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve(downloadId);
      }
    });
  });
}

// This function should be added to your popup.js
function debugSavedPostsPage() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0].url.includes('linkedin.com/my-items/saved-posts')) {
      alert('Please navigate to your LinkedIn saved posts page first!');
      return;
    }

    // Execute debug script on the page
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      function: function() {
        console.clear();
        console.log('===== DEBUGGING LINKEDIN SAVED POSTS PAGE =====');

        // Helper function to safely get text content
        function getTextContent(element) {
          if (!element) return 'N/A';
          return element.textContent.trim().replace(/\s+/g, ' ').substring(0, 100);
        }

        // Helper to get a short summary of an element for logging
        function elementSummary(element, includeChildren = false) {
          if (!element) return 'null';

          const rect = element.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 &&
                            window.getComputedStyle(element).display !== 'none' &&
                            window.getComputedStyle(element).visibility !== 'hidden';

          const summary = {
            tagName: element.tagName,
            id: element.id || 'no-id',
            className: element.className || 'no-class',
            textContent: getTextContent(element),
            dimensions: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
            isVisible: isVisible,
            hasClickHandler: element.onclick !== null || element.getAttribute('data-control-name') !== null,
            attributes: {}
          };

          // Get key attributes
          ['data-control-name', 'data-test-app-aware-link', 'href', 'role', 'aria-label'].forEach(attr => {
            if (element.hasAttribute(attr)) {
              summary.attributes[attr] = element.getAttribute(attr);
            }
          });

          // If requested, include information about children
          if (includeChildren) {
            summary.children = {
              count: element.children.length,
              types: Array.from(element.children).map(child => child.tagName).join(', '),
              firstChildClass: element.firstElementChild ? element.firstElementChild.className : 'none'
            };
          }

          return summary;
        }

        // 1. Identify the main container for saved posts
        console.log('STEP 1: Looking for main saved posts container');
        const potentialContainers = [
          document.querySelector('[data-view-name="myitems-saved-posts-entity-list"]'),
          document.querySelector('.scaffold-finite-scroll__content'),
          document.querySelector('.search-results-container'),
          document.querySelector('.scaffold-layout__list'),
          document.querySelector('.artdeco-list')
        ].filter(Boolean);

        console.log(`Found ${potentialContainers.length} potential main containers`);
        potentialContainers.forEach((container, i) => {
          console.log(`Main container candidate ${i+1}:`, elementSummary(container, true));
        });

        // 2. Find all entity-result elements which likely represent saved posts
        console.log('\nSTEP 2: Looking for entity-result elements (saved posts)');
        const entityResults = document.querySelectorAll('.entity-result');
        console.log(`Found ${entityResults.length} entity-result elements`);

        // Log details of the first 3 entity results
        Array.from(entityResults).slice(0, 3).forEach((result, i) => {
          console.log(`Entity result ${i+1}:`, elementSummary(result, true));

          // Check for content container
          const contentContainer = result.querySelector('.entity-result__content-container');
          console.log(`  - Content container:`, elementSummary(contentContainer));

          // Check for title element
          const titleElement = result.querySelector('.entity-result__title');
          console.log(`  - Title element:`, elementSummary(titleElement));

          // Check for summary/preview content
          const summaryElement = result.querySelector('.entity-result__content-summary');
          console.log(`  - Summary content:`, elementSummary(summaryElement));

          // Look for any links that might open the post
          const links = result.querySelectorAll('a');
          console.log(`  - Found ${links.length} links`);
          Array.from(links).slice(0, 3).forEach((link, j) => {
            console.log(`    Link ${j+1}:`, elementSummary(link));
          });
        });

        // 3. Find any clickable elements that might be used to open posts
        console.log('\nSTEP 3: Looking for clickable elements to open posts');
        const potentialClickers = [
          ...document.querySelectorAll('.entity-result__title-text a'),
          ...document.querySelectorAll('.entity-result__content-summary'),
          ...document.querySelectorAll('[data-control-name="view_detail"]'),
          ...document.querySelectorAll('[data-test-app-aware-link]')
        ];

        console.log(`Found ${potentialClickers.length} potential clickable elements`);
        Array.from(potentialClickers).slice(0, 5).forEach((clicker, i) => {
          console.log(`Clickable element ${i+1}:`, elementSummary(clicker));
        });

        // 4. Analyze the overall page structure
        console.log('\nSTEP 4: Analyzing overall page structure');
        // Find all major sections
        const majorSections = document.querySelectorAll('.scaffold-layout__content section');
        console.log(`Found ${majorSections.length} major sections on the page`);

        // Check for infinite scroll functionality
        const infiniteScrollElements = document.querySelectorAll('[data-infinite-scroll]');
        console.log(`Found ${infiniteScrollElements.length} infinite scroll elements`);

        // 5. Provide guidance on next steps
        console.log('\nSTEP 5: Suggested next steps');

        if (entityResults.length > 0) {
          const firstLink = entityResults[0].querySelector('a[href*="linkedin.com"]');
          if (firstLink) {
            console.log('RECOMMENDATION: Try clicking this link to open the first post:');
            console.log(elementSummary(firstLink));

            // Create a highlight on the element to make it visible
            const highlight = document.createElement('div');
            highlight.style.position = 'absolute';
            highlight.style.border = '3px solid red';
            highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
            highlight.style.zIndex = '10000';
            highlight.style.pointerEvents = 'none';

            const rect = firstLink.getBoundingClientRect();
            highlight.style.top = (rect.top + window.scrollY) + 'px';
            highlight.style.left = (rect.left + window.scrollX) + 'px';
            highlight.style.width = rect.width + 'px';
            highlight.style.height = rect.height + 'px';

            document.body.appendChild(highlight);
            setTimeout(() => highlight.remove(), 5000); // Remove after 5 seconds

            console.log('The recommended element has been highlighted in red for 5 seconds');
          }
        }

        // Check if we need to implement scrolling to load more posts
        if (entityResults.length < 5) {
          console.log('RECOMMENDATION: You may need to implement scrolling to load more posts');
        }

        // 6. Gather additional data about post structure
        console.log('\nSTEP 6: Gathering additional data about post structure');

        // Try to open a post and analyze its structure
        console.log('To analyze an individual post, we would need to:');
        console.log('1. Click on a post to open it');
        console.log('2. Wait for the post content to load');
        console.log('3. Extract the content from the post detail page');

        // Provide a clickable function to extract data from the current page
        console.log('\nYou can extract data from the current page by running this in the console:');
        console.log('extractCurrentPostData()');

        // Define the extraction function in the global scope
        window.extractCurrentPostData = function() {
          console.log('Extracting data from current page...');

          // Check if we're on a post detail page
          const isPostPage = window.location.href.includes('posts/') ||
                            window.location.href.includes('activity/') ||
                            window.location.href.includes('pulse/');

          if (!isPostPage) {
            console.log('Not on a post detail page. Please navigate to a post first.');
            return;
          }

          // Look for post content
          const postContainers = [
            document.querySelector('.feed-shared-update-v2'),
            document.querySelector('.reader-article-content'),
            document.querySelector('.pulse-old-detail-redesign'),
            document.querySelector('[data-test-id="article-content"]')
          ].filter(Boolean);

          if (postContainers.length === 0) {
            console.log('Could not find post content container');
            return;
          }

          const container = postContainers[0];
          console.log('Found post container:', elementSummary(container));

          // Extract post components
          const authorElement = container.querySelector('.feed-shared-actor__name') ||
                                container.querySelector('.article-author-name');

          const contentElement = container.querySelector('.feed-shared-update-v2__description') ||
                                 container.querySelector('.reader-article-content__body') ||
                                 container.querySelector('[data-test-id="article-content"]');

          const imageElements = container.querySelectorAll('img');
          const images = Array.from(imageElements)
            .filter(img => img.width > 100 && img.height > 100) // Filter out icons
            .map((img, i) => ({
              index: i,
              src: img.src,
              alt: img.alt || '',
              dimensions: `${img.width}x${img.height}`
            }));

          // Compile the data
          const postData = {
            url: window.location.href,
            author: authorElement ? getTextContent(authorElement) : 'Unknown',
            content: contentElement ? getTextContent(contentElement) : 'No content found',
            contentLength: contentElement ? contentElement.textContent.length : 0,
            images: images,
            containerSelector: container.tagName + (container.className ? '.' + container.className.split(' ')[0] : '')
          };

          console.log('Extracted post data:', postData);
          console.log('Full content:', contentElement ? contentElement.textContent : 'None');

          // Return the data for use in the extension
          return postData;
        };

        return {
          pageTitle: document.title,
          url: window.location.href,
          entityResultsCount: entityResults.length,
          recommendedSelectors: {
            mainContainer: potentialContainers.length > 0 ?
                          potentialContainers[0].tagName + '.' + potentialContainers[0].className.split(' ')[0] :
                          'None found',
            postItems: '.entity-result',
            clickableLinks: '.entity-result__title-text a, .entity-result__content-summary a'
          }
        };
      }
    }, (results) => {
      if (results && results[0].result) {
        console.log('Page analysis complete. Check the console for detailed results.');
        console.log('Summary:', results[0].result);

        // Add a button to the popup to run the next level of debugging
        const debugContainer = document.createElement('div');
        debugContainer.innerHTML = `
          <div style="margin-top: 20px; padding: 10px; background: #f0f0f0; border-radius: 4px;">
            <h4>Debugging Results</h4>
            <p>Found ${results[0].result.entityResultsCount} potential saved posts.</p>
            <p>Recommended selectors:</p>
            <ul>
              <li>Main container: ${results[0].result.recommendedSelectors.mainContainer}</li>
              <li>Post items: ${results[0].result.recommendedSelectors.postItems}</li>
              <li>Clickable links: ${results[0].result.recommendedSelectors.clickableLinks}</li>
            </ul>
            <button id="extractFirstPost" style="background: #0a66c2; color: white; padding: 8px; border: none; border-radius: 4px; cursor: pointer;">
              Extract First Post
            </button>
          </div>
        `;

        document.body.appendChild(debugContainer);

        // Add functionality to extract the first post
        document.getElementById('extractFirstPost').addEventListener('click', function() {
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.scripting.executeScript({
              target: {tabId: tabs[0].id},
              function: function() {
                // Find the first post link
                const firstLink = document.querySelector('.entity-result__title-text a');
                if (firstLink) {
                  console.log('Clicking on first post link:', firstLink);
                  firstLink.click();

                  // Set up a listener to extract data once the post is loaded
                  setTimeout(() => {
                    console.log('Checking if post has loaded...');
                    if (typeof extractCurrentPostData === 'function') {
                      const data = extractCurrentPostData();
                      console.log('Post data:', data);
                    } else {
                      console.log('extractCurrentPostData function not available yet');
                    }
                  }, 5000); // Wait 5 seconds for the post to load
                } else {
                  console.log('No post link found to click');
                }
              }
            });
          });
        });
      }
    });
  });
}

// Add this function to your popup.js file
function extractEntityResults(tabId, postsCount, downloadImages, statusElement) {
  statusElement.innerHTML = 'Analyzing LinkedIn saved posts page...';

  chrome.scripting.executeScript({
    target: {tabId: tabId},
    function: function(count) {
      console.log('Starting extraction of entity-result posts, count:', count);

      // Helper function to get clean text
      function cleanText(text) {
        if (!text) return '';
        return text.trim().replace(/\s+/g, ' ');
      }

      // First, find all entity-result elements
      const entityResults = document.querySelectorAll('.entity-result');
      console.log(`Found ${entityResults.length} entity results`);

      if (entityResults.length === 0) {
        return {
          error: 'No entity-result elements found',
          pageContent: document.body.innerHTML.substring(0, 1000)
        };
      }

      // Track which URLs we've processed to avoid duplicates
      const processedUrls = new Set();

      // Extract information about each entity result
      const entityData = [];

      // Only take up to the requested number of posts
      let processedCount = 0;

      for (const result of entityResults) {
        if (processedCount >= count) break;

        try {
          // Get the title and link
          const titleElement = result.querySelector('.entity-result__title-text');
          const linkElement = result.querySelector('.entity-result__title-text a');

          // Skip if no link found
          if (!linkElement || !linkElement.href) continue;

          // Check for duplicate URLs
          const url = linkElement.href;
          if (processedUrls.has(url)) continue;
          processedUrls.add(url);

          // Get the summary
          const summaryElement = result.querySelector('.entity-result__content-summary');

          // Create entity object
          entityData.push({
            index: processedCount,
            title: titleElement ? cleanText(titleElement.textContent) : 'No title',
            summary: summaryElement ? cleanText(summaryElement.textContent) : 'No summary',
            url: url,
            // We'll keep just the summary for now - we won't open each post
            content: summaryElement ? cleanText(summaryElement.textContent) : 'No content available',
            images: []
          });

          processedCount++;
        } catch (error) {
          console.error(`Error processing entity result:`, error);
        }
      }

      return {
        posts: entityData,
        totalEntityResults: entityResults.length,
        processedCount: entityData.length
      };
    },
    args: [postsCount]
  }, (results) => {
    if (results && results[0].result) {
      const data = results[0].result;

      if (data.error) {
        statusElement.innerHTML = `Error: ${data.error}`;
        console.error('Extraction error:', data);
        return;
      }

      const posts = data.posts || [];

      if (posts.length === 0) {
        statusElement.innerHTML = 'No saved posts could be extracted.';
        return;
      }

      statusElement.innerHTML = `Found ${posts.length} saved posts!`;

      // Save the extracted posts
      posts.forEach(post => {
        saveItem('LinkedIn Saved Post', JSON.stringify(post, null, 2));
      });

      // Create a timestamp for the export
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const folderPrefix = 'linkedin_helper';

      // Export as JSON file
      const jsonBlob = new Blob([JSON.stringify({
        posts: posts,
        metadata: {
          extractedAt: new Date().toISOString(),
          totalPosts: posts.length,
          totalEntityResults: data.totalEntityResults,
          processedCount: data.processedCount
        }
      }, null, 2)], {type: 'application/json'});

      const jsonUrl = URL.createObjectURL(jsonBlob);

      chrome.downloads.download({
        url: jsonUrl,
        filename: `${folderPrefix}/saved_posts_${timestamp}.json`,
        saveAs: false
      }, () => {
        URL.revokeObjectURL(jsonUrl);
        statusElement.innerHTML = `Downloaded ${posts.length} posts successfully!`;
      });
    } else {
      statusElement.innerHTML = 'Error: Failed to execute script on the page';
      console.error('Script execution failed:', results);
    }
  });
}

// Update your downloadSavedPosts function to use this new extractor
function downloadSavedPosts() {
  const postsCount = parseInt(document.getElementById('postsCount').value) || 5;
  const downloadImages = document.getElementById('downloadImages').checked;
  const statusElement = document.getElementById('downloadStatus');

  statusElement.innerHTML = 'Navigating to saved posts page...';

  // First check if we're already on the saved posts page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0].url.includes('linkedin.com/my-items/saved-posts')) {
      // Already on the saved posts page
      extractEntityResults(tabs[0].id, postsCount, downloadImages, statusElement);
    } else {
      // Navigate to the saved posts page
      chrome.tabs.create({url: 'https://www.linkedin.com/my-items/saved-posts/'}, function(tab) {
        // Wait for the page to load before extracting posts
        statusElement.innerHTML = 'Waiting for page to load...';
        setTimeout(() => {
          extractEntityResults(tab.id, postsCount, downloadImages, statusElement);
        }, 5000); // Give more time for the page to fully load
      });
    }
  });
}