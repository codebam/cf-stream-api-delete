process.removeAllListeners("warning");
// disable experimental fetch warning

const url = "api.cloudflare.com/client/v4";
const email = "";
const account_id = "";
const key = "";

const catch_handler = (exception, exit = false) =>
  console.error(...exception) || (exit && process.exit(1));

(process.argv[2] &&
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
    .then((response) => response.json().catch(catch_handler))
    .then(async (results) => {
      if (!(await results.result?.[0]?.uid)) {
        throw "uid not found in response. can't continue, exiting.";
      } else {
        return results.result.reduce(
          (previous, current) => [...previous, current.uid],
          []
        );
      }
    })
    .catch((e) => catch_handler([e], true))
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
                    console.log(
                      (response.status === 200 && `deleted ${request.id}`) ||
                        `failed to delete ${request.id}.`
                    ) ??
                    (response.status != 200 &&
                      (console.error(
                        (
                          await response
                            .clone()
                            .json()
                            .catch((e) => catch_handler([response.clone(), e]))
                        ).messages?.[0].message
                      ) ||
                        Promise.reject({ fetch_handler, request, response })))
                )
            ) || response
        )
    )
    .then((requests) =>
      Promise.allSettled(requests.map((request) => request()))
        .then((results) =>
          results.filter((result) => result.status === "rejected")
        )
        .then(async (rejected) => {
          for await (const _ of rejected.map((rejected) =>
            rejected.reason
              .fetch_handler(
                rejected.reason.request,
                rejected.reason.fetch_handler
              )
              .catch(async (e) =>
                catch_handler([
                  await e.response
                    .json()
                    .catch((e) => catch_handler([e.response.clone(), e])),
                  `request to delete ${e.request.id} failed.`,
                ])
              )
          )) {
          }
        })
    )) ||
  console.log("specify how many to delete\nnode index.js 1");
