require('dotenv').config(); // Load environment variables from .env

const AnyList = require('anylist');
const WebSocket = require('ws');
const axios = require('axios');

const GITHUB_REPO_OWNER = 'your-github-username'; // Replace with your GitHub username
const GITHUB_REPO_NAME = 'your-repo-name'; // Replace with your repository name
const GITHUB_EVENT_TYPE = 'anylist-update'; // Custom event type
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Personal Access Token with repo scope

if (!GITHUB_TOKEN) {
  throw new Error('GITHUB_TOKEN is not defined in environment variables.');
}

const anyListEmail = process.env.ANYLIST_EMAIL;
const anyListPassword = process.env.ANYLIST_PASSWORD;

if (!anyListEmail || !anyListPassword) {
  throw new Error('ANYLIST_EMAIL and/or ANYLIST_PASSWORD are not defined.');
}

const any = new AnyList({
  email: anyListEmail,
  password: anyListPassword
});

async function triggerGitHubWorkflow() {
  const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/dispatches`;
  
  try {
    await axios.post(
      url,
      {
        event_type: GITHUB_EVENT_TYPE,
        client_payload: {
          message: 'AnyList list updated'
        }
      },
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.everest-preview+json',
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('GitHub Actions workflow triggered successfully.');
  } catch (error) {
    console.error('Error triggering GitHub Actions workflow:', error.response ? error.response.data : error.message);
  }
}

async function startListener() {
  try {
    console.log('Logging into AnyList...');
    await any.login();
    console.log('Logged into AnyList successfully.');

    console.log('Fetching lists from AnyList...');
    await any.getLists();
    console.log('Fetched lists successfully.');

    // Set up WebSocket connection
    console.log('Setting up WebSocket connection...');
    any._setupWebSocket();

    // Listen to 'lists-update' events
    any.on('lists-update', async (updatedLists) => {
      console.log('Received lists-update event:', updatedLists.map(list => list.name));
      await triggerGitHubWorkflow();
    });

    console.log('WebSocket listener is running and awaiting updates...');
  } catch (error) {
    console.error('Error setting up AnyList listener:', error.message);
    process.exit(1);
  }
}

startListener();
