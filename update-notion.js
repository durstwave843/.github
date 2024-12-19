const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { Client } = require('@notionhq/client');

(async () => {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const databaseId = process.env.NOTION_DATABASE_ID;

  // Read and parse CSV
  const csvContent = fs.readFileSync('scanned-items.csv', 'utf8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });
  // records will be an array of objects like: [{ Name: 'Bananas', Quantity: '5' }, { Name: 'Apples', Quantity: '10' }, ...]

  // Insert each row into the Notion database
  for (const record of records) {
    // Convert Quantity to a number if needed
    const quantity = parseFloat(record.Quantity) || 0;

    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: record.Name || 'Unnamed Item'
              }
            }
          ]
        },
        Quantity: {
          number: quantity
        }
      }
    });
  }

  console.log('Notion database updated with CSV contents!');
})();
