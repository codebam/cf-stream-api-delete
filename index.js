process.removeAllListeners("warning");
// disable experimental fetch warning

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
    .then(async (results) => {
      if (!(await results.result?.[0]?.uid)) {
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
      ids
        .map((id) => ({
          id,
          request: new Request(
            new URL(`https://${url}/accounts/${account_id}/stream/${id}`),
            {
              method: "DELETE",
              headers: new Headers({
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
              }),
            }
          ),
        }))
        .map(
          (request) => async () =>
            ((fetch_handler) => fetch_handler(request, fetch_handler))(
              async (request, fetch_handler) =>
                fetch(request.request).then(
                  async (response) =>
                    console.log(await response.clone().json()) ||
                    (response.clone().json().errors ??
                      Promise.reject({ fetch_handler, request }))
                ) || response
            )
        )
    )
).then((requests) =>
  Promise.allSettled(requests.map((request) => request()))
    .then((results) => results.filter((result) => result.status === "rejected"))
    .then(async (rejected) => {
      for await (const _ of rejected.map((rejected) =>
        rejected.reason
          .fetch_handler(rejected.reason.request, rejected.reason.fetch_handler)
          .catch((e) =>
            console.error(
              `request to delete ${e.request.id} failed both async and serial`
            )
          )
      )) {
      }
    })
) || console.log("specify how many to delete\nnode index.js 1");
