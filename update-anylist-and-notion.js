const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { Client } = require('@notionhq/client');
const AnyList = require('anylist');

(async () => {
  try {
    // **AnyList Integration**

    // Initialize AnyList client
    const anyListEmail = process.env.ANYLIST_EMAIL;
    const anyListPassword = process.env.ANYLIST_PASSWORD;

    if (!anyListEmail) {
      throw new Error('ANYLIST_EMAIL is not defined.');
    }
    if (!anyListPassword) {
      throw new Error('ANYLIST_PASSWORD is not defined.');
    }

    const any = new AnyList({
      email: anyListEmail,
      password: anyListPassword
    });

    console.log('Logging into AnyList...');
    await any.login();
    console.log('Logged into AnyList successfully.');

    console.log('Fetching lists from AnyList...');
    await any.getLists();
    console.log('Fetched lists successfully.');

    // Get the "Scanned" list
    const scannedList = any.getListByName('Scanned');

    if (!scannedList) {
      throw new Error('List named "Scanned" not found in AnyList.');
    }

    console.log('Extracting items from the "Scanned" list...');
    const items = scannedList.items;

    if (!items || items.length === 0) {
      console.warn('No items found in the "Scanned" list.');
    } else {
      console.log(`Found ${items.length} item(s) in the "Scanned" list.`);
    }

    // Create CSV header
    const csvHeader = 'Name,Quantity\n';

    // Create CSV rows by mapping items to a string
    const csvRows = items.map(item => {
      // Assuming item._name is the item name and item._quantity is the quantity
      const name = item._name ? `"${item._name.replace(/"/g, '""')}"` : '""'; // Escape double quotes
      const quantity = item._quantity !== null && item._quantity !== undefined ? item._quantity : '';
      return `${name},${quantity}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Write CSV content to a file
    fs.writeFileSync('scanned-items.csv', csvContent, 'utf8');
    console.log('CSV file exported as scanned-items.csv');

    any.teardown();
    console.log('Logged out of AnyList.');

    // **Notion Integration**

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

    const csvContentRead = fs.readFileSync(csvPath, 'utf8');
    const records = parse(csvContentRead, { columns: true, skip_empty_lines: true });
    console.log(`Parsed ${records.length} records from CSV.`);

    for (const [index, record] of records.entries()) {
      const itemNameRaw = record.Name;
      const itemName = itemNameRaw ? itemNameRaw.trim().replace(/^"|"$/g, '').replace(/""/g, '"') : 'Unnamed Item';
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
