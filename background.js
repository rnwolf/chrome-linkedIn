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
  // --- Handler for Post Content ---
  if (request.action === "processExtractedContent") {
      console.log("Background script received POST data:", request.data);
      const { text, imageUrls, author, publishedTimeText, postUrl } = request.data;

      (async () => {
          try {
              const now = new Date();
              const timestamp = now.toISOString().replace(/[:.]/g, '-');
              const baseFilename = `linkedin-post-${timestamp}`;
              // Organize posts into a subfolder
              const downloadSubfolder = `linkedin/posts/${baseFilename}`;

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
                  let extension = ".jpg";
                  try {
                      const urlPath = new URL(imageUrl).pathname;
                      const lastDot = urlPath.lastIndexOf('.');
                      if (lastDot !== -1 && lastDot > urlPath.lastIndexOf('/')) {
                          extension = urlPath.substring(lastDot);
                      }
                  } catch (e) { console.warn("Could not parse image URL for extension:", imageUrl, e); }
                  const imageFilename = `${downloadSubfolder}/${baseFilename}-image-${index + 1}${extension}`;
                  chrome.downloads.download({ url: imageUrl, filename: imageFilename, saveAs: false })
                      .catch(error => console.error(`Image download failed for ${imageUrl}:`, error));
              });

          } catch (error) {
              console.error("Error processing post blobs or downloading:", error);
          }
      })();
      // ** REMOVED 'return true;' ** - No response needed back to content script
  }

  // --- Handler for Contact Content ---
  else if (request.action === "processContactContent") {
      console.log("Background script received CONTACT data:", request.data);
      const contactDataWithTimestamp = {
          downloadTimestamp: new Date().toISOString(),
          ...request.data
      };

      (async () => {
          try {
              const now = new Date();
              const timestamp = now.toISOString().replace(/[:.]/g, '-');
              const baseFilename = `linkedin-contact-${timestamp}`;
               // Organize contacts into a subfolder
              const downloadSubfolder = `linkedin/contacts/${baseFilename}`;

              // Prepare Contact JSON data
              const jsonDataString = JSON.stringify(contactDataWithTimestamp, null, 2);
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
       // ** REMOVED 'return true;' ** - No response needed back to content script
  }

  // Return false or nothing if the action wasn't handled here.
  // The ping action in content.js correctly returns true and sends a response.
  return false;
});

console.log("LinkedIn Post/Contact Downloader background script loaded.");
