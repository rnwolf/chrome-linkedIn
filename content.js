// c:\Users\rnwol\workspace\chrome-linkedIn\content.js

// --- IMPORTANT ---
// These selectors are EXAMPLES and WILL LIKELY need to be updated.
// Use your browser's Developer Tools (right-click -> Inspect) on a LinkedIn post
// to find the correct selectors for the elements containing the text and images.
// Look for stable attributes like 'data-test-id', ARIA roles, or specific class structures.

const POST_SELECTOR = ".feed-shared-update-v2"; // Example: A common container for posts
const TEXT_SELECTOR = ".update-components-text"; // Example: Selector for the main text block
const IMAGE_SELECTOR = ".update-components-image__image"; // Example: Selector for images within a post
const IMAGE_SRC_ATTRIBUTE = "src"; // Usually 'src', but could be 'data-src' etc.

// --- NEW SELECTORS (Verify these with Developer Tools!) ---
const AUTHOR_SELECTOR = ".update-components-actor__title span[aria-hidden='true']"; // More specific selector for the name itself
const TIME_SELECTOR = ".update-components-actor__sub-description"; // Selector for the time/metadata line
const PERMALINK_SELECTOR = ".feed-shared-update-v2__control-menu .feed-shared-control-menu__item[role='button']"; // Example: Trying to find a link/button that might contain the permalink or lead to it. Often the "Copy link to post" option reveals it. Another common place is the timestamp link itself.
const TIMESTAMP_LINK_SELECTOR = "a.app-aware-link"; // A common selector for links, check if one within the time element holds the permalink

function extractPostContent() {
  console.log("Content script: Trying to extract post content...");

  let targetPost = null;
  const posts = document.querySelectorAll(POST_SELECTOR);
  if (!posts.length) {
    console.error("Content script: No posts found with selector:", POST_SELECTOR);
    return { status: "error", message: "Could not find any LinkedIn posts on the page." };
  }

  // Find the first post reasonably visible in the viewport
  for (const post of posts) {
      const rect = post.getBoundingClientRect();
      // Adjust visibility check if needed
      if (rect.top >= -100 && rect.top < window.innerHeight * 0.75 && rect.height > 50) { // Example: Allow slightly offscreen top, mostly visible, minimum height
          targetPost = post;
          console.log("Content script: Found target post:", targetPost);
          break;
      }
  }

  if (!targetPost) {
      targetPost = posts[0]; // Fallback
      console.log("Content script: No ideally positioned post found, falling back to the first one:", targetPost);
  }

  // --- Extract Author ---
  const authorElement = targetPost.querySelector(AUTHOR_SELECTOR);
  const authorName = authorElement ? authorElement.innerText.trim() : "Author not found";
  console.log("Content script: Extracted author:", authorName);

  // --- Extract Time Since Published ---
  const timeElement = targetPost.querySelector(TIME_SELECTOR);
  const publishedTimeText = timeElement ? timeElement.innerText.trim() : "Time not found";
  console.log("Content script: Extracted time text:", publishedTimeText);

  // --- Extract Post URL (Attempt 1: Timestamp Link) ---
  // let postUrl = "URL not found";
  // const timeLinkElement = timeElement?.querySelector(TIMESTAMP_LINK_SELECTOR); // Look for a link within the time element
  // if (timeLinkElement && timeLinkElement.href && timeLinkElement.href.includes('/activity/')) {
  //     postUrl = timeLinkElement.href;
  // } else {
  //     // --- Extract Post URL (Attempt 2: Look for a general permalink indicator if Attempt 1 failed) ---
  //     // This is less reliable and might need significant adjustment based on inspection
  //     const permalinkElement = targetPost.querySelector('a[href*="/feed/update/urn:li:activity:"]'); // Look for any link matching the activity URN pattern
  //     if (permalinkElement && permalinkElement.href) {
  //         postUrl = permalinkElement.href;
  //     }
  //     // Add more attempts here if needed based on inspecting different posts
  // }
  // console.log("Content script: Extracted post URL:", postUrl);

  // --- Extract Post URL (Get from browser address bar) ---
  const postUrl = window.location.href; // Get the current page URL
  console.log("Content script: Using current page URL as post URL:", postUrl);

  // --- Extract Text ---
  const textElement = targetPost.querySelector(TEXT_SELECTOR);
  // Handle potential "See more..." expansion if needed (more complex)
  const postText = textElement ? textElement.innerText : "No text found.";
  console.log("Content script: Extracted text:", postText.substring(0, 100) + "...");

  // --- Extract Image URLs ---
  const imageElements = targetPost.querySelectorAll(IMAGE_SELECTOR);
  const imageUrls = [];
  imageElements.forEach(img => {
    const src = img.getAttribute(IMAGE_SRC_ATTRIBUTE) || img.getAttribute('src'); // Check both src and potential data-src
    if (src) {
      try {
        imageUrls.push(new URL(src, window.location.origin).href);
      } catch (e) {
        console.warn("Could not parse image source into URL:", src, e);
      }
    }
  });
  console.log("Content script: Extracted image URLs:", imageUrls);

  // Send data (including new fields) to the background script
  chrome.runtime.sendMessage({
    action: "processExtractedContent",
    data: {
      text: postText,
      imageUrls: imageUrls,
      author: authorName,
      publishedTimeText: publishedTimeText,
      postUrl: postUrl
    }
  });

  return { status: "success" };
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    console.log("Content script received ping");
    sendResponse({ status: "ready" }); // Respond to confirm it's loaded
    return true; // Keep channel open for async response
  } else if (request.action === "downloadPostContent") {
    console.log("Content script received request:", request.action);
    // Ensure the DOM is ready or wait briefly if necessary for dynamic content
    setTimeout(() => {
        const result = extractPostContent();
        sendResponse(result); // Send status back to popup
    }, 100); // Small delay might help with dynamically loaded content, adjust if needed
    return true; // Indicates response will be sent asynchronously
  }
});

console.log("LinkedIn Post Downloader content script loaded.");
