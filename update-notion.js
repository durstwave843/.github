const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { Client } = require('@notionhq/client');

(async () => {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const databaseId = process.env.NOTION_DATABASE_ID;

  const csvContent = fs.readFileSync('scanned-items.csv', 'utf8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });

  for (const record of records) {
    const itemName = record.Name || 'Unnamed Item';
    const quantity = parseFloat(record.Quantity) || 0;

    // Query the database for an existing page with the same item name
    const existingPages = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Name',       // Property name in Notion
        title: {
          equals: itemName      // Since it's a title property, use the "title" filter
        }
      }
    });

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
})();
