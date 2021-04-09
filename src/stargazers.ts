import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";
import CsvStringify from "csv-stringify";
import parse from "csv-parse/lib/sync";

const COLUMNS: UserKeys[] = [
  "username",
  "name",
  "email",
  "emailType",
  "company",
  "twitter",
  "url",
];

interface User {
  username?: string;
  name?: string | null;
  email?: string | null;
  emailType?: string | null;
  company?: string | null;
  twitter?: string | null;
  url?: string | null;
  input?: { [column: string]: string };
}

type UserKeys = keyof User;

interface UserMap {
  [username: string]: User;
}

export async function cmd(argsv: { [key: string]: any }) {
  console.log(".......... start");
  const owner: string = process.env.REPO_OWNER ?? "grouparoo";
  const repo: string = process.env.REPO_NAME ?? "grouparoo";
  const auth: string = process.env.GITHUB_AUTH_TOKEN ?? "";
  const octokit = new Octokit({ auth });

  const parameters = {
    owner,
    repo,
    per_page: 100,
  };

  const { data, columns } = parseInput();

  console.log("\n.......... fetching stargazers");

  for await (const response of octokit.paginate.iterator(
    octokit.activity.listStargazersForRepo,
    parameters
  )) {
    const test = null; // [{ login: "bleonard" }];
    const stargazers = response.data;
    for (const gazer of test || stargazers) {
      if (gazer && gazer.login) {
        if (!data[gazer.login]) {
          const user = await processUser(octokit, gazer.login);
          data[gazer.login] = user;
        }
      }
    }
  }

  await writeToCsv(data, columns);
  console.log("\n.......... done");
}

function parseInput(): { data: UserMap; columns: string[] } {
  const data: UserMap = {};
  const filename = path.resolve(
    path.join(process.env.PWD || "./", "input.csv")
  );

  if (!fs.existsSync(filename)) {
    return { data, columns: COLUMNS };
  }

  console.log("\n.......... parsing input.csv");

  const rows = parse(fs.readFileSync(filename), {
    skip_empty_lines: true,
  });

  const inputColumns: string[] = rows[0];
  if (!inputColumns) {
    return { data, columns: COLUMNS };
  }
  if (!inputColumns.includes("username")) {
    throw new Error("input.csv needs a username");
  }

  for (let rowNum = 1; rowNum < rows.length; rowNum++) {
    const row = rows[rowNum];
    const user: User = {};
    for (let colNum = 0; colNum < inputColumns.length; colNum++) {
      const key = inputColumns[colNum];
      const value = row[colNum];
      switch (key) {
        case "username":
        case "name":
        case "email":
        case "emailType":
        case "company":
        case "twitter":
        case "url":
          user[key] = value;
          break;
        default:
          user["input"] = user["input"] || {};
          user["input"][key] = value;
          break;
      }
    }
    if (user.username) {
      console.log(user.username);
      data[user.username] = user;
    } else {
      console.log(`NO USERNAME: row ${rowNum}`);
    }
  }

  return { data, columns: inputColumns };
}

async function processUser(octokit: Octokit, username: string): Promise<User> {
  console.log(username);
  const { data: userData } = await octokit.users.getByUsername({ username });

  let email = userData.email || null;
  const name = userData.name || null;
  let emailType = null;
  const company = userData.company || null;
  const twitter = userData.twitter_username || null;
  const url = `https://www.github.com/${username}`;

  if (email) {
    emailType = "profile";
  } else {
    email = await emailFromEvents(octokit, username, name);
    // console.log({ username, found: email });
    if (email) {
      emailType = "events";
    }
  }

  return {
    name,
    username,
    email,
    emailType,
    url,
    twitter,
    company,
    input: {},
  };
}

async function emailFromEvents(
  octokit: Octokit,
  username: string,
  name: string | null
): Promise<string | null> {
  const emails: { [email: string]: number } = {};
  const { data: events } = await octokit.activity.listPublicEventsForUser({
    username,
    per_page: 100,
  });
  for (const event of events) {
    // console.log({ username, event });
    const payload: any = event.payload;
    const commits = payload?.commits ?? [];
    for (const commit of commits) {
      const email = commit?.author?.email;
      const authorName = commit?.author?.name;
      if (email) {
        if (email.match(/noreply/)) {
          continue;
        }
        emails[email] = emails[email] ?? 0;
        emails[email] += 1;

        if (authorName === username || authorName === name) {
          // more verified
          return email;
        }
      }
    }
  }

  // pick most popular email
  let email = null;
  let max = 0;

  for (const [key, value] of Object.entries(emails)) {
    if (value > max) {
      max = value;
      email = key;
    }
  }
  return email;
}

async function writeToCsv(data: UserMap, columns: string[]) {
  const filename = path.resolve(
    path.join(process.env.PWD || "./", "stargazers.csv")
  );

  if (fs.existsSync(filename)) fs.unlinkSync(filename);
  const fileStream = fs.createWriteStream(filename);
  const csvStream = CsvStringify({ header: true, columns });
  csvStream.pipe(fileStream);

  for (const username in data) {
    const user: any = Object.assign({}, data[username]);
    const inputs = user.input;
    delete user.input;
    const values = Object.assign(user, inputs);
    csvStream.write(values);
  }

  // wait for the file handle to close
  await new Promise((resolve) => {
    fileStream.once("close", resolve);
    csvStream.end();
  });
}
