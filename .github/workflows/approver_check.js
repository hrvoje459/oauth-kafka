
const fs = require('fs').promises;

const acls = '/home/runner/work/oauth-kafka/oauth-kafka/output/to_do.json';
//const acls = 'acls_to_add.json';
const meta_table_url = 'https://raw.githubusercontent.com/hrvoje459/oauth-kafka/main/kafka-meta-table.csv';

function parseCSVRow(csvRow) {
  const fields = [];
  let currentField = '';
  let insideQuotes = false;

  for (const char of csvRow) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      fields.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }

  fields.push(currentField.trim());
  return fields;
}


async function populate_prefix_approver_map() {
  const prefix_approver_mapping = new Map();
  await fetch(meta_table_url)
    .then(response => response.text())
    .then(data => {
      //console.log(data)
      let rows = data.split("\n");
      for (let i = 0; i < rows.length; i++) {
        let parsed_row = parseCSVRow(rows[i])
        //console.log("ROWS:",parsed_row)
        let team_prefixes = parsed_row[2].split(",");
        //console.log("Prefixes:",team_prefixes)
        for (let j = 0; j < team_prefixes.length; j++) {
          //console.log("Prefix:", team_prefixes[j], " Approvers:", parsed_row[3].split(","))
          prefix_approver_mapping.set(team_prefixes[j], parsed_row[3].split(","))
        }

      }
      //console.log("Mapping:", prefix_approver_mapping)
    })
    .catch(error => console.log(error));
  return prefix_approver_mapping;
}

async function fetchRequiredPrefixes() {
  const requiredPrefixes = [];
  const result = await fs.readFile(acls, 'utf8')
  try {
    // Parse the JSON data
    const jsonData = JSON.parse(result);

    jsonData.forEach(element => {
      if (element.action == "ADD") {
        requiredPrefixes.push(element.principal.principal_name.split("_")[0] + "_")
        requiredPrefixes.push(element.resource.resource_name.split("_")[0] + "_")
      }
      if (element.action == "REMOVE") {
        requiredPrefixes.push(element.principal.principal_name.split("_")[0] + "_")
      }
      //console.log(element)
      //console.log(element.principal.principal_name)
      //console.log(element.resource.resource_name)
      //console.log(element.principal.principal_name.split("_")[0])
      //console.log(element.resource.resource_name.split("_")[0])
    });


    console.log(requiredPrefixes)

    // Access and print specific properties
    //console.log('Message:', jsonData);
  } catch (jsonError) {
    console.error(`Error parsing JSON from file ${fileName}:`, jsonError);
  }

  return requiredPrefixes
}

async function approverSetList(prefix_approver_map, requiredPrefixApprovals) {
  let listOfApproverSets = []
  requiredPrefixApprovals.forEach(element => {
    listOfApproverSets.push(prefix_approver_map.get(element))
  });
  return listOfApproverSets
}

async function getApprovalsForPR(){
  let PR_NUMBER = process.env.PR_NUMBER
  const result = await fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER + "/requested_reviewers").
    then(response => response.json())
  console.log(result)
}

async function approvalProcess() {
  try {
    const prefix_approver_map = await populate_prefix_approver_map();
    console.log('Fetch complete, result:', prefix_approver_map);

    const requiredPrefixApprovals = await fetchRequiredPrefixes();
    console.log("Required prefix approvals:", requiredPrefixApprovals)

    const approverSet = await approverSetList(prefix_approver_map, requiredPrefixApprovals);
    console.log("Required approvers", approverSet)

    const existingApprovals = await getApprovalsForPR();

    // Check if pull request opener is approver and remove him from approverSet
    // Check if there are already given approvals and remove them from approverSet
          // list all approvals, get last per person to see if approved or changes requested
          // if approved remove person from approverSet
          // if changes requested leave person in approverSet (re-request approval)
    // Check if there are already requested approvers and remove them from the approverSet
    // if approverSet set is not empty request review for each user

  } catch (error) {
    // Handle errors from function1 or subsequent operations
    console.error('Error in approvalProcess:', error);
  }
}

approvalProcess()



