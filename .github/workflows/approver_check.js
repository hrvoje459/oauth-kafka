
const fs = require('fs');

console.log("Hello, World!");

const fileName = '/home/runner/work/oauth-kafka/oauth-kafka/output/to_do.json';

fs.readFile(fileName, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading file ${fileName}:`, err);
      return;
    }
  
    try {
      // Parse the JSON data
      const jsonData = JSON.parse(data);
  
      // Access and print specific properties
      console.log('Message:', jsonData);
    } catch (jsonError) {
      console.error(`Error parsing JSON from file ${fileName}:`, jsonError);
    }
  });
  