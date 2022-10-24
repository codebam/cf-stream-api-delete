const url = "api.cloudflare.com/client/v4";
const email = "";
const account_id = "";
const key = "";

(
  process.argv[2] &&
  fetch(
    new Request(
      new URL(
        `https://${url}/accounts/${account_id}/stream?` +
          new URLSearchParams({ limit: process.argv[2] })
      ),
      {
        headers: new Headers({
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        }),
      }
    )
  )
    .then((response) => response.json())
    .then((results) => {
      if (!results.result?.[0]?.uid) {
        console.error("uid not found in response. can't continue, exiting.");
        process.exit(1);
      } else {
        return results.result.reduce(
          (previous, current) => [...previous, current.uid],
          []
        );
      }
    })
    .then((ids) =>
      ids.map(
        (id) =>
          new Request(
            new URL(`https://${url}/accounts/${account_id}/stream/${id}`),
            {
              method: "DELETE",
              headers: new Headers({
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
              }),
            }
          )
      )
    )
    .then((requests) =>
      requests.map((request) =>
        fetch(request).then(
          async (response) =>
            ((response.clone().json().status != 200 ??
              console.error(
                `received status ${
                  response.clone().json().status
                }, trying serially...`
              )) &&
              Promise.reject()) ||
            response
        )
      )
    )
    .then((responses) =>
      Promise.all(responses).catch(async () => {
        for await (const _ of responses) {
        }
      })
    )
).then((responses) =>
  responses.forEach(async (response) => console.log(await response.json()))
) || console.log("specify how many to delete\nnode index.js 1");
