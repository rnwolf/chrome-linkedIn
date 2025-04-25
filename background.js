// c:\Users\rnwol\workspace\chrome-linkedIn\background.js

// Helper function to convert Blob to data URL (remains the same)
function blobToDataURL(blob) {
  // ... (implementation as before) ...
  return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.onabort = () => reject(new Error("Blob reading was aborted."));
      reader.readAsDataURL(blob);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // --- Handler for Post Content ---
  if (request.action === "processExtractedContent") {
      console.log("Background script received POST data:", request.data);
      const { text, imageUrls, author, publishedTimeText, postUrl } = request.data;

      (async () => {
          try {
              const now = new Date();
              const timestamp = now.toISOString().replace(/[:.]/g, '-');
              const baseFilename = `linkedin-post-${timestamp}`;
              const downloadSubfolder = `linkedin/posts/${baseFilename}`; // Added 'posts' subfolder

              // Prepare Post JSON Data
              const postData = {
                  downloadTimestamp: now.toISOString(),
                  postUrl, author, publishedTimeText, text, imageUrls,
              };
              const jsonDataString = JSON.stringify(postData, null, 2);
              const jsonBlob = new Blob([jsonDataString], { type: 'application/json;charset=utf-8' });
              const jsonUrl = await blobToDataURL(jsonBlob);

              // Download Post JSON
              chrome.downloads.download({
                  url: jsonUrl,
                  filename: `${downloadSubfolder}/${baseFilename}-metadata.json`,
                  saveAs: false
              }).catch(error => console.error("Post JSON download failed:", error));

              // Download Post Text
              if (text && text !== "No text found.") {
                  const textBlob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                  const textUrl = await blobToDataURL(textBlob);
                  chrome.downloads.download({
                      url: textUrl,
                      filename: `${downloadSubfolder}/${baseFilename}-text.txt`,
                      saveAs: false
                  }).catch(error => console.error("Post Text download failed:", error));
              }

              // Download Post Images
              imageUrls.forEach((imageUrl, index) => {
                  // ... (image download logic remains the same, using downloadSubfolder) ...
                  let extension = ".jpg";
                  try { /* ... get extension ... */ } catch (e) { /* ... handle error ... */ }
                  const imageFilename = `${downloadSubfolder}/${baseFilename}-image-${index + 1}${extension}`;
                  chrome.downloads.download({ url: imageUrl, filename: imageFilename, saveAs: false })
                      .catch(error => console.error(`Image download failed for ${imageUrl}:`, error));
              });

          } catch (error) {
              console.error("Error processing post blobs or downloading:", error);
          }
      })();
      return true; // Indicate async work
  }

  // --- Handler for Contact Content ---
  else if (request.action === "processContactContent") {
      console.log("Background script received CONTACT data:", request.data);
      const contactData = request.data; // Contains profileUrl, name, location, etc.

      (async () => {
          try {
              const now = new Date();
              const timestamp = now.toISOString().replace(/[:.]/g, '-');
              // Use a different base filename pattern for contacts
              const baseFilename = `linkedin-contact-${timestamp}`;
              // Use a different subfolder for contacts
              const downloadSubfolder = `linkedin/contacts/${baseFilename}`; // Added 'contacts' subfolder

              // Prepare Contact JSON data (already an object)
              const jsonDataString = JSON.stringify({
                  downloadTimestamp: now.toISOString(), // Add download timestamp
                  ...contactData // Spread the received contact data
              }, null, 2);
              const jsonBlob = new Blob([jsonDataString], { type: 'application/json;charset=utf-8' });
              const jsonUrl = await blobToDataURL(jsonBlob);

              // Download Contact JSON File
              chrome.downloads.download({
                  url: jsonUrl,
                  filename: `${downloadSubfolder}/${baseFilename}-metadata.json`,
                  saveAs: false
              }).then(downloadId => {
                  console.log(`Contact JSON metadata download started with ID: ${downloadId}`);
              }).catch(error => {
                  console.error("Contact JSON metadata download failed:", error);
              });

          } catch (error) {
              console.error("Error processing contact blob or downloading:", error);
          }
      })();
      return true; // Indicate async work
  }

  // Return false if the action wasn't handled here (or true if ping needs async response elsewhere)
  return false; // Default for unhandled actions
});

console.log("LinkedIn Post/Contact Downloader background script loaded.");
