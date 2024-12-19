const fs = require('fs');
const { parse } = require('csv-parse/sync');
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

    // Read and parse CSV
    const csvContent = fs.readFileSync('scanned-items.csv', 'utf8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });
    console.log(`Parsed ${records.length} records from CSV.`);

    for (const record of records) {
      const itemName = record.Name ? record.Name.trim() : 'Unnamed Item';
      const quantity = parseFloat(record.Quantity) || 0;

      console.log(`Processing item: ${itemName}, Quantity: ${quantity}`);

      // Build the filter object
      const filter = {
        property: 'Name', // Must match exactly the property name from schema
        title: {
          equals: itemName
        }
      };

      console.log('Filter object:', JSON.stringify(filter, null, 2));

      // Query the database for an existing page with the same item name
      const existingPages = await notion.databases.query({
        database_id: databaseId,
        filter: filter
      });

      console.log(`Found ${existingPages.results.length} existing pages for item: ${itemName}`);

      if (existingPages.results.length > 0) {
        // If the item exists, update its Quantity
        const pageId = existingPages.results[0].id;
        await notion.pages.update({
          page_id: pageId,
          properties: {
            Quantity: {
              number: quantity
            }
          }
        });
        console.log(`Updated existing item: ${itemName}`);
      } else {
        // If the item does not exist, create a new page
        await notion.pages.create({
          parent: { database_id: databaseId },
          properties: {
            Name: {
              title: [{ text: { content: itemName } }]
            },
            Quantity: {
              number: quantity
            }
          }
        });
        console.log(`Created new item: ${itemName}`);
      }
    }

    console.log('Notion database updated without duplicating entries!');
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
