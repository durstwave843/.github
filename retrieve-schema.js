const { Client } = require('@notionhq/client');

(async () => {
  try {
    // Initialize Notion client
    if (!process.env.NOTION_TOKEN) {
      throw new Error('NOTION_TOKEN is not defined.');
    }
    if (!process.env.NOTION_DATABASE_ID) {
      throw new Error('NOTION_DATABASE_ID is not defined.');
    }

    const notion = new Client({ auth: process.env.NOTION_TOKEN });
    const databaseId = process.env.NOTION_DATABASE_ID;

    console.log('Fetching database schema...');
    const db = await notion.databases.retrieve({ database_id: databaseId });
    console.log('Database schema retrieved successfully.');
    console.log(JSON.stringify(db, null, 2));

    process.exit(0); // Exit after printing schema
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
