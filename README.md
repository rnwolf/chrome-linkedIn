LinkedIn Chrome Extension
I've created a Chrome extension that allows you to save information from LinkedIn profiles and posts, as well as create and publish posts directly to LinkedIn. Here's how it works:
Features

Save LinkedIn content:

Save profile information (name, title, location, about section, experience)
Save post content (author, text, URL)
Save custom text for reference


Manage saved content:

View all saved items
Copy items to clipboard
Delete items


Post to LinkedIn:

Create and publish new posts directly from the extension
Use saved content in your posts



How to Install

Download the code from the artifact
Create a new folder on your computer for the extension
Create the following files in the folder with the content from the artifact:

manifest.json
popup.html
popup.js
background.js
content.js


Create an "images" folder and add icon images (16x16, 48x48, 128x128 px)
Open Chrome, go to chrome://extensions/
Enable "Developer mode" (toggle in top-right)
Click "Load unpacked" and select your extension folder

How to Use

Navigate to any LinkedIn page
Click the extension icon in your browser toolbar
Use the buttons to:

Save the current profile data
Save the current post
Save custom text
Create and publish a new post

New Feature: Download LinkedIn Saved Posts
The extension now includes functionality to:

Navigate to your LinkedIn saved posts page
Download a specified number of recent saved posts
Save them both within the extension and export them as a JSON file
Make these posts available for your local AI service to help craft comments

How the New Feature Works

UI Additions:

Added a "LinkedIn Saved Posts" section with buttons to navigate to saved posts page or download posts
Added a number input to specify how many posts to download (default: 5)
Added a status display area to show download progress


New Functionality:

The extension will navigate to your saved posts page if you're not already there
It extracts post content, author information, timestamps, and post URLs
The downloaded posts are saved in your extension's local storage
Posts are also exported as a JSON file for easy use with your AI service


Technical Implementation:

Added content script functionality to extract posts from the saved posts page
Extended permissions to include "downloads" and "tabs" in the manifest
Added status feedback throughout the download process



How to Use

Click on "Go to Saved Posts Page" to navigate to your LinkedIn saved posts page
Enter the number of recent posts you want to download (e.g., 5, 10, etc.)
Click "Download Recent Saved Posts"
Wait for the status to show "Downloaded X posts successfully!"
The posts will be:

Saved in your extension's storage (viewable in the Saved Information section)
Downloaded as a JSON file named "linkedin_saved_posts.json"



You can now use this JSON file with your local AI service to help craft comments for these saved posts.

ability to download images from LinkedIn saved posts. Here are the enhancements I've made:
New Image Download Features

Image Detection and Capture:

The extension now scans each saved post for images
It identifies actual post images while filtering out UI elements, profile pictures, and reaction icons
It attempts to get the highest quality version of each image using data attributes and srcset


Image Download Management:

Added a checkbox to toggle image downloading (on by default)
Images are saved to a dedicated "linkedin_images" folder
Each image filename includes the timestamp, author name, and position information
The JSON file includes references to the local image paths


Improved User Experience:

Better status updates during the download process
Shows successful vs. failed image downloads
Adds timestamps to downloaded files
Properly handles permissions for cross-origin image downloads


Document Attachment Support:

Also detects and captures information about document attachments in posts
Stores document title and URL in the JSON data



Sample JSON Output Structure
The updated JSON format for each saved post now looks like this:
json{
  "author": "John Smith",
  "content": "Here's my latest post with important information...",
  "timestamp": "2d",
  "url": "https://www.linkedin.com/posts/johnsmith_specific-post-activity-id",
  "images": [
    {
      "src": "https://media.linkedin.com/image/url.jpg",
      "alt": "Post image description",
      "localPath": "linkedin_images/2025-04-24T12-34-56-789Z_John_Smith_post1_image1.jpg"
    }
  ],
  "documents": [
    {
      "title": "Quarterly Report",
      "url": "https://www.linkedin.com/document-url"
    }
  ],
  "savedAt": "2025-04-24T12:34:56.789Z"
}


This comprehensive post data will be perfect for feeding into your local AI service to help craft comments, as it includes all the visual context from the post as well as the text content.


All extension downloads will be saved to a dedicated subfolder called linkedin_helper in your default Chrome downloads directory. Within this folder, content is organized into:

linkedin_helper/
├── images/
│   └── [author]_post1_image1.jpg
│   └── [author]_post1_image2.jpg
│   └── ...
└── json/
    └── saved_posts_[timestamp].json