// c:\Users\rnwol\workspace\chrome-linkedIn\content.js

// --- Post Selectors ---
// ... (keep post selectors) ...

// --- Profile Selectors (EXAMPLES - MUST BE VERIFIED/UPDATED) ---
const PROFILE_NAME_SELECTOR = "h1";
const PROFILE_LOCATION_SELECTOR = ".text-body-small.inline.t-black--light.break-words"; // Usually a span near headline

// --- More Specific Profile Selectors ---
// Find the container for the main profile content to narrow down searches
const PROFILE_MAIN_CONTAINER_SELECTOR = "main"; // Or a more specific ID/class if available

// About Section Selectors
const ABOUT_SECTION_HEADING_SELECTOR = "h2#about"; // Find the H2 with id="about"
// Find the div containing the text, often a sibling or nested sibling of the heading's parent div
const ABOUT_SECTION_TEXT_SELECTOR = "section[aria-labelledby='about'] div.inline-show-more-text"; // Try finding section labelled by 'about', then the text container

// Services Section Selectors (if present)
const SERVICES_SECTION_HEADING_SELECTOR = "h2#services"; // Example ID, might differ
const SERVICES_SECTION_TEXT_SELECTOR = "section[aria-labelledby='services'] ul"; // Example: list within the section

// Skills Section Selectors
const SKILLS_SECTION_HEADING_SELECTOR = "h2#skills"; // Example ID, might differ
// Look for the list items specifically within the skills section
const ACTUAL_SKILL_ITEM_SELECTOR = "section[aria-labelledby='skills'] ul > li div.mr1 span[aria-hidden='true']"; // Example: Drill down to the skill text span

// Selector to capture raw text (as requested, though less reliable)
const RAW_CONTENT_SELECTOR = ".visually-hidden";


// --- Function to extract Post data ---
// ... (extractPostContent remains the same) ...


// --- Function to extract Contact data ---
function extractContactInfo() {
    console.log("Content script: Trying to extract contact info...");
    if (!window.location.href.startsWith('https://www.linkedin.com/in/')) {
        return { status: "error", message: "Not on a valid LinkedIn profile page (/in/)." };
    }

    const profileUrl = window.location.href;
    const mainContainer = document.querySelector(PROFILE_MAIN_CONTAINER_SELECTOR) || document; // Fallback to document

    // Helper to safely get text content from a specific element or within the main container
    const getText = (selector, baseElement = mainContainer) => {
        const element = baseElement.querySelector(selector);
        return element ? element.innerText.trim() : null;
    };

     // Helper to safely get multiple elements' text
    const getAllText = (selector, baseElement = mainContainer) => {
        const elements = baseElement.querySelectorAll(selector);
        return elements.length > 0 ? Array.from(elements).map(el => el.innerText.trim()).filter(Boolean) : []; // Filter out empty strings
    };

    // --- Extract Basic Info ---
    const name = getText(PROFILE_NAME_SELECTOR, document); // H1 is likely outside main container sometimes
    const location = getText(PROFILE_LOCATION_SELECTOR);

    // --- Extract Raw Content (as requested) ---
    const rawContent = getAllText(RAW_CONTENT_SELECTOR, document); // Get all visually-hidden text across the page

    // --- Extract Followers/Connections (from Raw Content) ---
    let followersConnectionsText = "Followers/Connections not found";
    const followerRegex = /([\d,]+)\s+followers?/i; // Regex to find number + "followers"
    for (const text of rawContent) {
        const match = text.match(followerRegex);
        if (match && match[1]) {
            followersConnectionsText = `${match[1]} followers`;
            break;
        }
        // Add similar check for connections if needed
    }
    console.log("Found Followers/Connections:", followersConnectionsText);


    // --- Extract About Section Text (More Targeted) ---
    let aboutText = "About section not found or empty.";
    const aboutTextElement = mainContainer.querySelector(ABOUT_SECTION_TEXT_SELECTOR);
    if (aboutTextElement) {
        // Check for collapsed state and click "see more" if necessary (Advanced)
        const seeMoreButton = aboutTextElement.querySelector('button.inline-show-more-text__button');
        if (seeMoreButton && aboutTextElement.classList.contains('inline-show-more-text--is-collapsed')) {
            console.log("Clicking 'see more' for About section...");
            seeMoreButton.click();
            // NOTE: Need to wait briefly after click for content to expand before extracting
            // This requires making this function async and adding a delay, or using MutationObserver
            // For simplicity now, we'll just grab what's visible or potentially expanded text
            // await new Promise(resolve => setTimeout(resolve, 200)); // Example if async
            aboutText = aboutTextElement.querySelector('span[aria-hidden="true"]')?.innerText.trim() || aboutTextElement.innerText.trim();
        } else {
             aboutText = aboutTextElement.querySelector('span[aria-hidden="true"]')?.innerText.trim() || aboutTextElement.innerText.trim();
        }
    } else {
        console.warn("Could not find About section text using selector:", ABOUT_SECTION_TEXT_SELECTOR);
        // Fallback: Try finding "About" in rawContent and taking the next significant string (less reliable)
        const aboutIndex = rawContent.findIndex(text => text.toLowerCase() === 'about');
        if (aboutIndex !== -1 && rawContent[aboutIndex + 1]?.length > 50) { // Check next item looks like content
            aboutText = rawContent[aboutIndex + 1];
            console.log("Used fallback method for About text.");
        }
    }
    console.log("Found About Text:", aboutText.substring(0, 100) + "...");


    // --- Extract Services Text (More Targeted) ---
    let servicesText = "Services section not found or empty.";
    const servicesListElement = mainContainer.querySelector(SERVICES_SECTION_TEXT_SELECTOR);
    if (servicesListElement) {
        servicesText = servicesListElement.innerText.trim().replace(/\n+/g, ' • '); // Clean up list items
    } else {
         console.warn("Could not find Services section text using selector:", SERVICES_SECTION_TEXT_SELECTOR);
         // Fallback from rawContent
         const servicesIndex = rawContent.findIndex(text => text.toLowerCase() === 'services');
         if (servicesIndex !== -1 && rawContent[servicesIndex + 1]) {
             servicesText = rawContent[servicesIndex + 1];
             console.log("Used fallback method for Services text.");
         }
    }
    console.log("Found Services Text:", servicesText);


    // --- Extract Actual Skills (More Targeted) ---
    let actualSkills = getAllText(ACTUAL_SKILL_ITEM_SELECTOR);
    if (actualSkills.length === 0) {
        console.warn("Could not find skills using selector:", ACTUAL_SKILL_ITEM_SELECTOR);
        // Fallback: Try finding "Skills" in rawContent and taking subsequent items (less reliable)
        const skillsIndex = rawContent.findIndex(text => text.toLowerCase() === 'skills');
        if (skillsIndex !== -1) {
            // Take a few items after "Skills" that don't look like endorsements
            actualSkills = rawContent.slice(skillsIndex + 1, skillsIndex + 11) // Take up to 10 items
                                     .filter(text => text && !text.toLowerCase().includes('endorse'));
            console.log("Used fallback method for Skills.");
        }
    }
     if (actualSkills.length === 0) {
        actualSkills = ["Skills not found or empty"]; // Default if still empty
     }
    console.log("Found Actual Skills:", actualSkills);


    // --- Construct data object ---
    const contactData = {
        profileUrl: profileUrl,
        name: name || "Name not found",
        location: location || "Location not found",
        followersConnections: followersConnectionsText, // Specifically extracted
        websites: [], // Still requires modal interaction
        about: aboutText, // Specifically extracted
        services: servicesText, // Specifically extracted
        skills: actualSkills, // Specifically extracted skills
        content: rawContent // The full dump from .visually-hidden
    };

    console.log("Content script: Sending contact data:", contactData);

    // Send data to background script
    chrome.runtime.sendMessage({
        action: "processContactContent",
        data: contactData
    });

    return { status: "success" };
}


// --- Message Listener ---
// ... (Message listener remains the same, calling extractContactInfo for the right action) ...
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received action:", request.action);
    let result;
    switch (request.action) {
        case "ping":
            sendResponse({ status: "ready" });
            break;
        case "downloadPostContent":
            setTimeout(() => {
                result = extractPostContent();
                sendResponse(result);
            }, 100);
            break;
        case "downloadContactInfo":
             setTimeout(() => {
                result = extractContactInfo();
                sendResponse(result);
            }, 100); // Delay might help with potential "see more" clicks
            break;
        default:
            console.warn("Unknown action received:", request.action);
            sendResponse({ status: "error", message: "Unknown action" });
            break;
    }
    return (request.action === "downloadPostContent" || request.action === "downloadContactInfo" || request.action === "ping");
});

console.log("LinkedIn Post/Contact Downloader content script loaded.");
