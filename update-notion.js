const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { Client } = require('@notionhq/client');

(async () => {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const databaseId = process.env.NOTION_DATABASE_ID;

  // First, verify the property name and type in the database
  const db = await notion.databases.retrieve({ database_id: databaseId });
  console.log('Database schema:', JSON.stringify(db, null, 2));

  // Assuming the title property is indeed named "Name" and is of type "title"
  const csvContent = fs.readFileSync('scanned-items.csv', 'utf8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });

  for (const record of records) {
    const itemName = record.Name || 'Unnamed Item';
    const quantity = parseFloat(record.Quantity) || 0;

    // Use the exact property name from the schema; make sure it's the title property
    const existingPages = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Name', // EXACT name from the schema
        title: {
          equals: itemName
        }
      }
    });

    if (existingPages.results.length > 0) {
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
