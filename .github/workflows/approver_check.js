
const fs = require('fs').promises;

console.log("Hello, World!");

// ACLs todo file generated in previous step by the custom KSM
const acls = '/home/runner/work/oauth-kafka/oauth-kafka/output/to_do.json';
// URL of the meta table with the prefix approvers
const meta_table_url = 'https://raw.githubusercontent.com/hrvoje459/oauth-kafka/main/kafka-meta-table.csv';

// USE authentication for github api to avoid rate limits of 1 request per minute
let headers = new Headers();
headers.append('Authorization', 'Bearer ' + process.env.GHA_TOKEN);
headers.append("Content-Type", "application/json")

// Get PULL REQUEST number from environment variable
let PR_NUMBER = process.env.PR_NUMBER

// Custom CSV parser to enable values to have commas (',')  (e.g. multiple approvers, multiple prefixes, ...)
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

// Create map of prefixes and approvers as defined in meta table
async function populate_prefix_approver_map() {
  const prefix_approver_mapping = new Map();
  await fetch(meta_table_url, { headers: headers })
    .then(response => response.text())
    .then(data => {
      let rows = data.split("\n");
      for (let i = 0; i < rows.length; i++) {
        let parsed_row = parseCSVRow(rows[i])
        let team_prefixes = parsed_row[2].split(",");
        for (let j = 0; j < team_prefixes.length; j++) {
          prefix_approver_mapping.set(team_prefixes[j], parsed_row[3].split(","))
        }
      }
    })
    .catch(error => console.log(error));

  return prefix_approver_mapping;
}

// Read todo file and fetch all prefixes that occur in acls to be added or removed
async function fetchRequiredPrefixes() {
  const requiredPrefixes = new Set();
  try {
    const result = await fs.readFile(acls, 'utf8')
    const jsonData = JSON.parse(result);

    jsonData.forEach(element => {
      if (element.action == "ADD") {
        requiredPrefixes.add(element.principal.principal_name.split("_")[0] + "_")
        requiredPrefixes.add(element.resource.resource_name.split("_")[0] + "_")
      }
      if (element.action == "REMOVE") {
        requiredPrefixes.add(element.principal.principal_name.split("_")[0] + "_")
      }
    });
  } catch (jsonError) {
    requiredPrefixes.add("")
    console.error(`Error parsing JSON from file ${acls}:`, jsonError);
  }

  return requiredPrefixes
}

// Create list of sets of approvers based on required prefixes
async function approverSetList(prefix_approver_map, requiredPrefixApprovals) {
  let listOfApproverSets = []
  requiredPrefixApprovals.forEach(element => {
    listOfApproverSets.push(new Set(prefix_approver_map.get(element)))
  });
  return listOfApproverSets
}

// Fetch requested approvers for PR
async function getRequestedApprovers() {
  let requestedApprovers = [];
  const result = await fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER + "/requested_reviewers", { headers: headers }).
    then(response => response.json())

  result.users.forEach(element => {
    requestedApprovers.push(element.login)
  });

  return requestedApprovers
}

// Check if PR contains files that require admin approval
async function requiresAdminApproval() {
  const pr_details = await fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER + "/files", { headers: headers })
    .then(response => response.json())

  let changed_files = []

  pr_details.forEach(element => {
    changed_files.push(element.filename)
  });

  // Needs reconfiguration for when production acls are added
  // or match folder when admin approval not required
  if (changed_files.length == 1 && changed_files[0] != "acls/preprod/main.yml") {
    return true
  }
  if (changed_files.length > 1) {
    return true
  }
  return false
}

// Fetch PULL REQUEST opener, if approver opened the pull request, additional approval from that approver is not needed
async function getPullRequestOpener() {
  const result = await fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER, { headers: headers }).
    then(response => response.json())
  return result.user.login
}

// For each approver check last status of approval 
// Check if approval was given after the last commit 
// Return set of users that gave their approval
async function getPrApprovals() {
  const result = await fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER + "/reviews", { headers: headers }).
    then(response => response.json())

  const pr_details = await fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER, { headers: headers }).
    then(response => response.json())

  let last_commit = pr_details.head.sha

  // Fetch last commit info
  const last_commit_details = await fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/commits/" + last_commit, { headers: headers }).
    then(response => response.json())

  // usporedi vrijeme zadnjeg reviewa i zadnjeg commita, ako je review nastao nakon zadnjeg commita, ne moras ponovo traziti approval
  // Compare timestamps of each review and last commit, save last review for each reviewer that occured after the last commit
  let mapOfReviews = new Map();
  result.forEach(element => {
    if (element.state == "CHANGES_REQUESTED" || element.state == "APPROVED") {
      if (Date.parse(element.submitted_at) > Date.parse(last_commit_details.commit.committer.date)) {
        mapOfReviews.set(element.user.login, element.state)
      }
    }
  });

  let approvalsSet = [];

  // If the result of review was APPROVED add user to set of approvals
  mapOfReviews.forEach((value, key) => {
    if (value == "APPROVED") {
      approvalsSet.push(key)
    }
  });

  return approvalsSet
}

// Request reviews from required users
async function requestApprovals(approverSetList, existingRequestedApprovers) {

  let temp_approver_set = new Set()
  approverSetList.forEach(approverSet => {
    approverSet.forEach(approver => {
      temp_approver_set.add(approver)
    });
  });

  // Remove review requests for users from whom review is not needed
  existingRequestedApprovers.forEach(existingReviewer => {
    if (!temp_approver_set.has(existingReviewer)) {
      let temp_array = []
      temp_array.push(existingReviewer)
      let body = JSON.stringify({ "reviewers": temp_array })

      const result = fetch(
        "https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER + "/requested_reviewers",
        {
          method: "DELETE",
          headers: headers,
          body: body
        }
      ).then(response => response.json())

    }
  });

  // Request review from required users
  let approverArray = Array.from(temp_approver_set.keys())
  let body = JSON.stringify({ "reviewers": approverArray })
  const result = await fetch(
    "https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER + "/requested_reviewers",
    {
      method: "POST",
      headers: headers,
      body: body
    }
  ).then(response => response.json())

  return result.requested_reviewers.length == 0
}

// Rerun job that was triggered by "pull_request" workflow trigger
// This job is not otherwise run because it is not triggered when reviews are submitted, needs to be rerun to pass status checks
async function rerunWorkflowOnPullRequestTrigger() {
  const pr_details = await fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/pulls/" + PR_NUMBER, { headers: headers })
    .then(response => response.json())
  const pr_workflows = await fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/actions/runs?event=pull_request&branch=" + pr_details.head.ref, { headers: headers })
    .then(response => response.json())

  const pr_workflows_rerun = await
    fetch("https://api.github.com/repos/hrvoje459/oauth-kafka/actions/runs/" + pr_workflows.workflow_runs[0].id + "/rerun",
      { method: "POST", headers: headers })
      .then(response => response.json())

  return pr_workflows_rerun
}

// High level approval process steps
async function approvalProcess() {
  try {

    // Fetch and parse meta table for prefix->approver mapping
    const prefix_approver_map = await populate_prefix_approver_map();
    console.log('Fetch complete, result:', prefix_approver_map);

    // Determine required prefix approvals based on prefixes in TO-ADD list
    const requiredPrefixApprovals = await fetchRequiredPrefixes();
    console.log("Required prefix approvals:", requiredPrefixApprovals)

    // Determine required reviewers from the required prefix list
    let approverSet = await approverSetList(prefix_approver_map, requiredPrefixApprovals);
    console.log("Required approvers", approverSet)

    // Add admin to approverSet if there are more files changed than just acl file
    let requireAdmin = await requiresAdminApproval()
    if (requireAdmin) {
      approverSet.push(new Set(prefix_approver_map.get("ADM_")))
    }

    // Check if pull request opener is approver and remove him from approverSet
    const prOpener = await getPullRequestOpener()

    approverSet = approverSet.filter(
      element => !element.has(prOpener)
    )

    // Check if there are already given approvals and remove them from approverSet
    // list all approvals, get last per person to see if approved or changes requested
    // if approved remove person from approverSet
    // if changes requested leave person in approverSet (re-request approval)
    const approvals = await getPrApprovals()
    approvals.forEach(approval => {
      approverSet = approverSet.filter(
        element => !element.has(approval)
      )
    });

    // NOT DOING, REQUEST APPROVAL FROM ALL PERSONS IN APPROVERS SET EVEN IF ALREADY REQUESTED
    // Check if there are already requested approvers and remove them from the approverSet
    //const requestedApprovers = await getRequestedApprovers();
    //console.log("Pending requesters: ", requestedApprovers)
    // if approverSet set is not empty request review for each user

    // REMOVE PEOPLE WHICH ARE NOT REQUIRED FOR APPROVAL ANYMORE (e.g. meta table changed in the backchannel seperate from MR) 
    // THEN REQUEST APPROVAL FROM REST
    const existingRequestedApprovers = await getRequestedApprovers()
    const requestApprovalsGH = await requestApprovals(approverSet, existingRequestedApprovers)

    if (requestApprovalsGH) {
      // RERUN "ksm-run (pull_request)" to succesfully pass all status checks
      if (process.env.TRIGGER_ACTION == "submitted" || process.env.TRIGGER_ACTION == "dismissed") {
        const rerun = await rerunWorkflowOnPullRequestTrigger();
        console.log("RERUN: ", rerun)
      }
      // if there are no additional reviews needed, return successful status code and pipeline passes 
      process.exit(0);
    } else {
      // otherwise fail pipeline and block merge
      process.exit(1);
    }

  } catch (error) {
    console.error('Error in approvalProcess:', error);
  }
}

approvalProcess()



