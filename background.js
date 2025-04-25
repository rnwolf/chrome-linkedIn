// c:\Users\rnwol\workspace\chrome-linkedIn\background.js

// Helper function to convert Blob to data URL
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.onabort = () => reject(new Error("Blob reading was aborted."));
    reader.readAsDataURL(blob);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processExtractedContent") {
    console.log("Background script received data:", request.data);
    // *** Destructure the new fields from the received data ***
    const { text, imageUrls, author, publishedTimeText, postUrl } = request.data;

    // Use an async function to handle the promises from blobToDataURL
    (async () => {
      try {
        // 1. Generate Timestamp and Base Filename
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const baseFilename = `linkedin-post-${timestamp}`;
        const downloadSubfolder = `linkedin/${baseFilename}`;

        // 2. Prepare JSON Data (including new fields)
        const postData = {
          downloadTimestamp: now.toISOString(), // Keep original download time
          postUrl: postUrl,                     // Add post URL
          author: author,                       // Add author
          publishedTimeText: publishedTimeText, // Add published time text
          text: text,
          imageUrls: imageUrls,
        };
        const jsonDataString = JSON.stringify(postData, null, 2); // Pretty print JSON
        const jsonBlob = new Blob([jsonDataString], { type: 'application/json;charset=utf-8' }); // Ensure UTF-8
        const jsonUrl = await blobToDataURL(jsonBlob);

        // 3. Download JSON File
        chrome.downloads.download({
          url: jsonUrl,
          filename: `${downloadSubfolder}/${baseFilename}-metadata.json`,
          saveAs: false
        }).then(downloadId => {
           console.log(`JSON metadata download started with ID: ${downloadId}`);
        }).catch(error => {
           console.error("JSON metadata download failed:", error);
        });

        // 4. Download Text File (if exists)
        if (text && text !== "No text found.") {
          const textBlob = new Blob([text], { type: 'text/plain;charset=utf-8' });
          const textUrl = await blobToDataURL(textBlob);
          chrome.downloads.download({
            url: textUrl,
            filename: `${downloadSubfolder}/${baseFilename}-text.txt`,
            saveAs: false
          }).then(downloadId => {
             console.log(`Text download started with ID: ${downloadId}`);
          }).catch(error => {
             console.error("Text download failed:", error);
          });
        } else {
            console.log("No text content to download.");
        }

        // 5. Download Images
        imageUrls.forEach((imageUrl, index) => {
          let extension = ".jpg";
          try {
              const urlPath = new URL(imageUrl).pathname;
              const lastDot = urlPath.lastIndexOf('.');
              if (lastDot !== -1 && lastDot > urlPath.lastIndexOf('/')) {
                  extension = urlPath.substring(lastDot);
              }
          } catch (e) {
              console.warn("Could not parse image URL for extension:", imageUrl, e);
          }
          const imageFilename = `${downloadSubfolder}/${baseFilename}-image-${index + 1}${extension}`;
          chrome.downloads.download({
            url: imageUrl,
            filename: imageFilename,
            saveAs: false
          }).then(downloadId => {
             console.log(`Image download started for ${imageUrl} with ID: ${downloadId}`);
          }).catch(error => {
             console.error(`Image download failed for ${imageUrl}:`, error);
          });
        });

      } catch (error) {
        console.error("Error processing blobs or downloading:", error);
      }
    })(); // Immediately invoke the async function

  }
  // Return true because we are performing async operations
  return true;
});

console.log("LinkedIn Post Downloader background script loaded.");
