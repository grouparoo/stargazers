import { Octokit } from "@octokit/rest";
import { string } from "yargs";

export async function cmd(argsv: { [key: string]: any }) {
  console.log(".......... start");
  const owner: string = process.env.REPO_OWNER ?? "";
  const repo: string = process.env.REPO_NAME ?? "";
  const auth: string = process.env.GITHUB_AUTH_TOKEN ?? "";
  const octokit = new Octokit({ auth });

  const parameters = {
    owner,
    repo,
    per_page: 100,
  };

  for await (const response of octokit.paginate.iterator(
    octokit.activity.listStargazersForRepo,
    parameters
  )) {
    const test = null; // [{ login: "bleonard" }];
    const stargazers = response.data;
    for (const gazer of test || stargazers) {
      if (gazer) {
        console.log(await processUser(octokit, gazer.login));
      }
    }
  }
}

interface User {
  name: string | null;
  username: string;
  email: string | null;
}

async function processUser(octokit: Octokit, username: string): Promise<User> {
  const { data: userData } = await octokit.users.getByUsername({ username });

  let email = userData.email;
  const name = userData.name;
  const company = userData.company;
  const twitter = userData.twitter_username;
  const url = userData.url;

  if (!email) {
    email = await emailFromEvents(octokit, username, name);
    // console.log({ username, found: email });
  }

  return {
    name,
    username,
    email,
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
  // console.log({ username, emails });

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
