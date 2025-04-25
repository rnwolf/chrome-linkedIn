// c:\Users\rnwol\workspace\chrome-linkedIn\content.js

// --- Post Selectors ---
const POST_SELECTOR = ".feed-shared-update-v2";
const POST_TEXT_SELECTOR = ".update-components-text";
const POST_IMAGE_SELECTOR = ".update-components-image__image";
const POST_IMAGE_SRC_ATTRIBUTE = "src";
const POST_AUTHOR_SELECTOR = ".update-components-actor__title span[aria-hidden='true']";
const POST_TIME_SELECTOR = ".update-components-actor__sub-description";

// --- Profile Selectors (EXAMPLES - MUST BE VERIFIED/UPDATED) ---
// Use Developer Tools (Inspect Element) on a profile page!
const PROFILE_NAME_SELECTOR = "h1"; // Often the main H1
const PROFILE_LOCATION_SELECTOR = ".text-body-small.inline.t-black--light.break-words"; // Usually a span near headline
const PROFILE_FOLLOWERS_SELECTOR = "text-body-small t-black--light inline-block"; // This is tricky, might be part of "X followers" or "Y connections" text. Inspect carefully. Might need more complex logic if combined.
const PROFILE_CONNECTIONS_SELECTOR = "span.link-without-visited-state"; // Often used for 500+ connections link
const PROFILE_CONTACT_INFO_LINK_SELECTOR = "#top-card-text-details-contact-info"; // Link to open contact info modal
const PROFILE_WEBSITE_SELECTOR = ".ci-websites .pv-contact-info__contact-link"; // Inside contact info modal
const PROFILE_ABOUT_SECTION_SELECTOR = "section[data-field='skill_details'] + div.display-flex.full-width + div"; // Example: Find the section *after* skills, might need adjustment based on profile layout. Look for the div containing the text.
const PROFILE_ABOUT_TEXT_SELECTOR = ".inline-show-more-text span[aria-hidden='true']"; // Selector for the actual text within the about section, handling "see more"
const PROFILE_SKILLS_SECTION_SELECTOR = "section[data-field='skill_details']"; // The main skills section
const PROFILE_SKILL_SELECTOR = ".visually-hidden"; // Often skills are within spans like this inside the section

// --- Function to extract Post data ---
function extractPostContent() {
    console.log("Content script: Trying to extract post content...");
    let targetPost = null;
    const posts = document.querySelectorAll(POST_SELECTOR);
    // ... (rest of the post finding logic remains the same) ...
    if (!posts.length) return { status: "error", message: "Could not find any LinkedIn posts." };
    for (const post of posts) { /* ... find visible post ... */ }
    if (!targetPost) targetPost = posts[0];

    const authorElement = targetPost.querySelector(POST_AUTHOR_SELECTOR);
    const authorName = authorElement ? authorElement.innerText.trim() : "Author not found";
    const timeElement = targetPost.querySelector(POST_TIME_SELECTOR);
    const publishedTimeText = timeElement ? timeElement.innerText.trim() : "Time not found";
    const postUrl = window.location.href;
    const textElement = targetPost.querySelector(POST_TEXT_SELECTOR);
    const postText = textElement ? textElement.innerText : "No text found.";
    const imageElements = targetPost.querySelectorAll(POST_IMAGE_SELECTOR);
    const imageUrls = [];
    imageElements.forEach(img => { /* ... extract image URLs ... */ });

    chrome.runtime.sendMessage({
        action: "processExtractedContent", // Action for posts
        data: { text: postText, imageUrls, author: authorName, publishedTimeText, postUrl }
    });
    return { status: "success" };
}

// --- Function to extract Contact data ---
function extractContactInfo() {
    console.log("Content script: Trying to extract contact info...");

    // Basic check
    if (!window.location.href.startsWith('https://www.linkedin.com/in/')) {
        return { status: "error", message: "Not on a valid LinkedIn profile page (/in/)." };
    }

    const profileUrl = window.location.href;

    // Helper to safely get text content
    const getText = (selector) => {
        const element = document.querySelector(selector);
        // Check for "See more" pattern in About section
        if (selector === PROFILE_ABOUT_TEXT_SELECTOR && element?.parentNode?.classList.contains('inline-show-more-text--is-collapsed')) {
             // If collapsed, try clicking the "see more" button first (more complex, omitted for simplicity here)
             // For now, just get the visible part or indicate it's potentially truncated.
             console.warn("About section might be truncated ('See more').");
        }
        return element ? element.innerText.trim() : null; // Return null if not found
    };

     // Helper to safely get multiple elements' text
    const getAllText = (selector) => {
        const elements = document.querySelectorAll(selector);
        return elements.length > 0 ? Array.from(elements).map(el => el.innerText.trim()) : [];
    };

    // Helper to safely get href attribute
     const getAllHrefs = (selector) => {
        const elements = document.querySelectorAll(selector);
        return elements.length > 0 ? Array.from(elements).map(el => el.href) : [];
    };

    const name = getText(PROFILE_NAME_SELECTOR);
    const location = getText(PROFILE_LOCATION_SELECTOR);

    // Followers/Connections needs careful inspection - might be one or the other, or combined
    //let followers = getText(PROFILE_FOLLOWERS_SELECTOR);
    //if (!followers) {
    //    followers = getText(PROFILE_CONNECTIONS_SELECTOR); // Fallback attempt
    //}

    // --- Extract Followers/Connections (More Robust Method) ---
    let followersConnectionsText = "Followers/Connections not found"; // Default value
    // Try to find a container for the top card stats (adjust selector as needed)
    const topCardStatsContainer = document.querySelector('main section:first-of-type ul'); // Example: First UL in the first section of main

    if (topCardStatsContainer) {
        const listItems = topCardStatsContainer.querySelectorAll('li');
        for (const item of listItems) {
            const itemText = item.innerText || "";
            if (itemText.includes('follower')) { // Check for "follower" (case-insensitive might be better)
                const countElement = item.querySelector('span'); // Assume number is in a span
                if (countElement) {
                    followersConnectionsText = countElement.innerText.trim() + " followers"; // Grab number and add label
                    break; // Stop searching once found
                }
            } else if (itemText.includes('connection')) { // Fallback check for connections
                 const countElement = item.querySelector('span'); // Might be a span or link text
                 const linkElement = item.querySelector('a');
                 if (countElement) {
                     followersConnectionsText = countElement.innerText.trim() + " connections";
                     break;
                 } else if (linkElement) {
                     // Handle cases like "500+ connections" where it's link text
                     followersConnectionsText = linkElement.innerText.trim();
                     break;
                 }
            }
        }
    } else {
        console.warn("Could not find the top card stats container reliably.");
        // Optional: Fallback to less reliable class-based selector if needed
        // followersConnectionsText = getText(PROFILE_FOLLOWERS_SELECTOR) || getText(PROFILE_CONNECTIONS_SELECTOR) || "Followers/Connections not found";
    }


    // Websites often require clicking "Contact info" - this basic version won't do that.
    // To get websites reliably, you'd need to:
    // 1. Find PROFILE_CONTACT_INFO_LINK_SELECTOR and click it.
    // 2. Wait for the contact info modal to appear.
    // 3. Use PROFILE_WEBSITE_SELECTOR within the modal.
    // 4. Close the modal.
    // For now, we'll leave it potentially empty or try a simpler approach if websites are sometimes visible directly.
    let websites = []; // Placeholder - requires modal interaction for reliability
    console.warn("Website extraction requires clicking 'Contact info' - skipping for now.");

    const aboutText = getText(PROFILE_ABOUT_TEXT_SELECTOR) || "About section not found or empty."; // Provide default

    // Skills
    const skills = getAllText(PROFILE_SKILL_SELECTOR);

    // Construct data object, handling nulls
    const contactData = {
        profileUrl: profileUrl,
        name: name || "Name not found",
        location: location || "Location not found",
        followersConnections: followersConnectionsText || "Followers/Connections not found", // Combined field for simplicity
        websites: websites, // Will be empty array for now
        about: aboutText,
        topSkills: skills.length > 0 ? skills : ["Skills not found or empty"] // Provide default
    };

    console.log("Content script: Extracted contact data:", contactData);

    // Send data to background script with a different action
    chrome.runtime.sendMessage({
        action: "processContactContent", // Distinct action for contacts
        data: contactData
    });

    return { status: "success" };
}


// --- Message Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received action:", request.action);
    let result;
    switch (request.action) {
        case "ping":
            sendResponse({ status: "ready" });
            break;
        case "downloadPostContent":
            // Using setTimeout might still be useful if posts load dynamically
            setTimeout(() => {
                result = extractPostContent();
                sendResponse(result);
            }, 100);
            break; // Important: Add break
        case "downloadContactInfo":
            // Profile info might also benefit from a slight delay
             setTimeout(() => {
                result = extractContactInfo();
                sendResponse(result);
            }, 100);
            break; // Important: Add break
        default:
            console.warn("Unknown action received:", request.action);
            sendResponse({ status: "error", message: "Unknown action" });
            break; // Important: Add break
    }
    // Return true to indicate asynchronous response for download actions
    return (request.action === "downloadPostContent" || request.action === "downloadContactInfo" || request.action === "ping");
});

console.log("LinkedIn Post/Contact Downloader content script loaded.");
