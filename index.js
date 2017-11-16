#!/usr/bin/env node

const { exec } = require("child_process");
const inquirer = require("inquirer");
const co = require("co");
inquirer.registerPrompt("autocomplete", require('inquirer-autocomplete-prompt'));

const showHelp = process.argv.includes("-h");
const includeOrigin = process.argv.includes("-o") ? " -a" : ""

if (showHelp) {
	console.log(`
Command: gitcheckout [-o]
Select a branch using the keyboard arrows, hit Enter, and watch the magic as it happens.
The current checked out branch is the default selection.

-o: include remote branches in branches list	
`)
	process.exit(0);
}

function execute(cmd, pipe = true) {
	return new Promise((resolve, reject) => {
		const proc = exec(cmd, (err, stdin) => {
			if (err) {
				return reject(err);
			}
			resolve(stdin);
		});
		if (pipe) {
			proc.stderr.pipe(process.stderr);
			proc.stdout.pipe(process.stdout);
		}
	});
}

co(function* run() {
	const gitBranchOut = yield execute(`git branch --sort=-committerdate${includeOrigin}`, false);
	let checkedOutBranch = 0;
	let branches = gitBranchOut
		// removed output whitespace
		.trim()
		// deal with windows
		.replace(/\r/, "")
		// split to rows - each one is a branch
		.split("\n")
		// removed the checked out branch indicator '*', origin/ if branch -a was executed and trim whitespace
		.map((n, i) => {
			if (n.match(/^\s*\*/)) {
				checkedOutBranch = i;
			}
			return n.replace(/^\s*\*|^\s*remotes\/origin\//g, "").trim()
		});

	// dedup (if local was or is checked out and origins are included)
	branches = [...new Set(branches)];
	const { branch } = yield inquirer.prompt([
		{
			type: "autocomplete",
			message: "Select branch to checkout:",
			name: "branch",
			source: (answersSoFar, input) => {
				return Promise.resolve(null === input ? branches : branches.filter(n => n.includes(input)));
			},
			pageSize: 10,
			default: checkedOutBranch,
		}
	]);
	yield execute(`git checkout ${branch}`);
})
	.catch((e) => {
		console.error("Failed to execute:");
		console.error(e);
		process.exit(1);
	});
