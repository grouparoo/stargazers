import { Octokit } from "@octokit/rest";

export async function cmd(argsv: { [key: string]: any }) {
  console.log(".......... start");
  const owner = "grouparoo";
  const repo = "grouparoo";
  const octokit = new Octokit();
  // const stargazers = await octokit.activity.listStargazersForRepo({
  //   owner,
  //   repo,
  //   per_page: 100,
  // });

  // console.log({ stargazers });

  const parameters = {
    owner,
    repo,
    per_page: 10,
  };
  for await (const response of octokit.paginate.iterator(
    octokit.activity.listStargazersForRepo,
    parameters
  )) {
    const stargazers = response.data;
    for (const gazer of stargazers) {
      if (gazer) {
        console.log(gazer.login);
      }
    }
  }
}
