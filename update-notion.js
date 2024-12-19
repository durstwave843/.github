const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { Client } = require('@notionhq/client');

(async () => {
  try {
    // Initialize Notion client
    const notionToken = process.env.NOTION_TOKEN;
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!notionToken) {
      throw new Error('NOTION_TOKEN is not defined.');
    }
    if (!databaseId) {
      throw new Error('NOTION_DATABASE_ID is not defined.');
    }

    const notion = new Client({ auth: notionToken });
    console.log('Initialized Notion client.');
    console.log(`Using database ID: ${databaseId}`);

    // Read and parse CSV
    const csvPath = 'scanned-items.csv';
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file "${csvPath}" does not exist.`);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });
    console.log(`Parsed ${records.length} records from CSV.`);

    for (const [index, record] of records.entries()) {
      const itemNameRaw = record.Name;
      const itemName = itemNameRaw ? itemNameRaw.trim() : 'Unnamed Item';
      const quantityRaw = record.Quantity;
      const quantity = parseFloat(quantityRaw) || 0;

      console.log(`\nRecord ${index + 1}: Processing item: "${itemName}", Quantity: ${quantity}`);

      // Validate itemName
      if (typeof itemName !== 'string' || itemName.length === 0) {
        console.warn(`Skipping record ${index + 1} due to invalid name: "${itemName}"`);
        continue;
      }

      // Construct the filter object
      const filter = {
        property: 'Name', // Must match exactly the property name from schema
        title: {
          equals: itemName
        }
      };

      console.log('Constructed filter:', JSON.stringify(filter, null, 2));

      // Query the database for existing pages with the same name
      let existingPages;
      try {
        existingPages = await notion.databases.query({
          database_id: databaseId,
          filter: filter
        });
      } catch (queryError) {
        console.error(`Error querying database for item "${itemName}":`, queryError.message);
        throw queryError;
      }

      console.log(`Found ${existingPages.results.length} existing page(s) for item: "${itemName}"`);

      if (existingPages.results.length > 0) {
        // Update the first matching page's Quantity
        const pageId = existingPages.results[0].id;
        console.log(`Updating page ID: ${pageId}`);

        try {
          await notion.pages.update({
            page_id: pageId,
            properties: {
              Quantity: {
                number: quantity
              }
            }
          });
          console.log(`Updated Quantity for item: "${itemName}"`);
        } catch (updateError) {
          console.error(`Error updating page ID "${pageId}":`, updateError.message);
          throw updateError;
        }
      } else {
        // Create a new page for the item
        console.log(`Creating new page for item: "${itemName}"`);

        try {
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
          console.log(`Created new item: "${itemName}"`);
        } catch (createError) {
          console.error(`Error creating page for item "${itemName}":`, createError.message);
          throw createError;
        }
      }
    }

    console.log('\nNotion database updated without duplicating entries!');
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
