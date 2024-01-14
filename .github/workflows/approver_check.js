
const fs = require('fs');


console.log("Hello, World!");

//const acls = '/home/runner/work/oauth-kafka/oauth-kafka/output/to_do.json';
const acls = 'acls_to_add.json';
const meta_table_url = 'https://raw.githubusercontent.com/hrvoje459/oauth-kafka/main/kafka-meta-table.csv';
let headers = new Headers();
headers.append('Authorization', 'Bearer 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');
headers.append("Content-Type", "application/json")



const fileName = '/home/runner/work/oauth-kafka/oauth-kafka/output/to_do.json';

/*fs.readFile(fileName, 'utf8', (err, data) => {
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
  
  

  fields.push(currentField.trim());
  return fields;
}*/


async function populate_prefix_approver_map() {
  const prefix_approver_mapping = new Map();
  await fetch(meta_table_url, { headers: headers })
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
  const requiredPrefixes = new Set();
  const result = await fs.readFile(acls, 'utf8')
  try {
    // Parse the JSON data
    const jsonData = JSON.parse(result);

    jsonData.forEach(element => {
      if (element.action == "ADD") {
        requiredPrefixes.add(element.principal.principal_name.split("_")[0] + "_")
        requiredPrefixes.add(element.resource.resource_name.split("_")[0] + "_")
      }
      if (element.action == "REMOVE") {
        requiredPrefixes.add(element.principal.principal_name.split("_")[0] + "_")
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
    listOfApproverSets.push(new Set(prefix_approver_map.get(element)))
  });
  return listOfApproverSets
}

async function getRequestedApprovers() {
  let PR_NUMBER = process.env.PR_NUMBER
  if (process.env.PR_NUMBER == undefined) {
    PR_NUMBER = 7
  }
  let requestedApprovers = [];
  const result = await fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER + "/requested_reviewers", { headers: headers }).
    then(response => response.json())

  result.users.forEach(element => {
    requestedApprovers.push(element.login)
  });

  return requestedApprovers
}

async function getPullRequestOpener() {
  let PR_NUMBER = process.env.PR_NUMBER
  if (process.env.PR_NUMBER == undefined) {
    PR_NUMBER = 7
  }

  const result = await fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER, { headers: headers }).
    then(response => response.json())
  return result.user.login
}

async function getPrApprovals() {
  let PR_NUMBER = process.env.PR_NUMBER
  if (process.env.PR_NUMBER == undefined) {
    PR_NUMBER = 7
  }
  const result = await fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER + "/reviews", { headers: headers }).
    then(response => response.json())
  let mapOfReviews = new Map();

  result.forEach(element => {
    if (element.state == "CHANGES_REQUESTED" || element.state == "APPROVED") {
      mapOfReviews.set(element.user.login, element.state)
    }
  });

  let approvalsSet = [];

  mapOfReviews.forEach((value, key) => {
    if (value == "APPROVED") {
      approvalsSet.push(key)
    }
  });

  return approvalsSet
}

async function requestApprovals(approverSetList, existingRequestedApprovers) {
  console.log("APPROVER SET: ", approverSetList)



  let temp_approver_array = new Set()
  approverSetList.forEach(approverSet => {
    approverSet.forEach(approver => {
      temp_approver_array.add(approver)
    });
  });


  existingRequestedApprovers.forEach(existingReviewer => {
    if(!temp_approver_array.has(existingReviewer)){
      console.log("OVAJ NAM NE TREBA ", existingReviewer)
      let body = JSON.stringify({"reviewers" : existingReviewer})
      console.log("BODY: ", body)
      let PR_NUMBER = 7
      const result = fetch(
        "https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER + "/requested_reviewers", 
      { 
        method: "DELETE", 
        headers: headers,
        body: body
      }
      ).then(response => response.json()
      ).then(response => console.log("RESULT DELETE PR APPROVER: ", response))
  
    }
  });

  console.log("APPROVERS ", temp_approver_array)

  let approverArray =  Array.from(temp_approver_array.keys())
  let body = JSON.stringify({"reviewers" : approverArray})
  console.log("BODY: ", body)
  let PR_NUMBER = 7
  const result = await fetch(
    "https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER + "/requested_reviewers", 
    { 
      method: "POST", 
      headers: headers,
      body: body
    }
  ).then(response => response.json()
  ).then(response => console.log("RESULT REQUEST PR: ", response))
  
/*
  approverSetList.forEach(element => {
    let approverArray =  Array.from(element.keys())
    let body = JSON.stringify({"reviewers" : approverArray})
    console.log("BODY: ", body)
    let PR_NUMBER = 7
    const result = fetch(
      "https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER + "/requested_reviewers", 
      { 
        method: "POST", 
        headers: headers,
        body: body
      }
    ).then(response => response.json()
    ).then(response => console.log("RESULT REQUEST PR: ", response))
    

  });*/
  console.log("A WAIT")
}

async function approvalProcess() {
  try {

    // Fetch and parse meta table for prefix->approver mapping
    const prefix_approver_map = await populate_prefix_approver_map();
    console.log('Fetch complete, result:', prefix_approver_map);

    // Determine required approvals based on prefixes in TO-ADD list
    const requiredPrefixApprovals = await fetchRequiredPrefixes();
    console.log("Required prefix approvals:", requiredPrefixApprovals)

    let approverSet = await approverSetList(prefix_approver_map, requiredPrefixApprovals);
    console.log("Required approvers", approverSet)


    // Check if pull request opener is approver and remove him from approverSet
    const prOpener = await getPullRequestOpener()
    console.log("PR Opener: ", prOpener)


    console.log("APPROVER SET PRIJE MICANJA OPENERA", approverSet )
    approverSet = approverSet.filter(
      element => !element.has(prOpener)
    )
    console.log("APPROVER SET POSLJE MICANJA OPENERA", approverSet)

    // Check if there are already given approvals and remove them from approverSet
    // list all approvals, get last per person to see if approved or changes requested
    // if approved remove person from approverSet
    // if changes requested leave person in approverSet (re-request approval)
    const approvals = await getPrApprovals()
    console.log("Approvals given", approvals)
    approvals.forEach(approval => {
      approverSet.filter(
        element => !element.has(approval)
      )
    });
    console.log("Approver set bez danih approvala", approverSet)
    // NOT DOING, REQUEST APPROVAL FROM ALL PERSONS IN APPROVERS SET EVEN IF ALREADY REQUESTED
    // Check if there are already requested approvers and remove them from the approverSet
    //const requestedApprovers = await getRequestedApprovers();
    //console.log("Pending requesters: ", requestedApprovers)
    // if approverSet set is not empty request review for each user

    // REMOVE PEOPLE WHICH ARE NOT REQUIRED FOR APPROVAL ANYMORE (e.g. meta table changed in the backchannel seperate from MR)
    const existingRequestedApprovers = await getRequestedApprovers()
    console.log("THEY EXIST ", existingRequestedApprovers)


    const requestApprovalsGH = await requestApprovals(approverSet, existingRequestedApprovers)
    console.log("Approvals requested", requestApprovalsGH)

  } catch (error) {
    // Handle errors from function1 or subsequent operations
    console.error('Error in approvalProcess:', error);
  }
}

approvalProcess()



