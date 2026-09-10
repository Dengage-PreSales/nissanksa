# Deploying these functions

## The setting that is not in this repository

Four of these functions are called directly from the browser, by a page with no
Supabase session. They are deployed with **JWT verification off**, and that
setting lives in the Supabase project, not in any file here. Deploy one with
the default and every call from the site returns 401: the forms stop recording,
no message is sent, and the site otherwise looks completely normal.

| Function | `verify_jwt` | Called by |
|---|---|---|
| `nissan-booking-confirm` | **false** | the storefront, on every moment that earns a message |
| `nissan-lead-relay` | **false** | the storefront, on every lead form |
| `nissan-dengage-tables` | **false** | the verification console at `/verify/` |
| `nissan-persona-seed` | **false** | run by hand to create the eight presenter contacts |
| `nissan-contact-peek` | true | never from a page |

## Deploying

With the Supabase MCP connector, `deploy_edge_function` takes the slug, the
file, and the flag:

```
project_id     raextqlludkagdntyzwn
name           nissan-booking-confirm
verify_jwt     false
files          supabase/functions/nissan-booking-confirm/index.ts
```

With the CLI:

```
supabase functions deploy nissan-booking-confirm --no-verify-jwt --project-ref raextqlludkagdntyzwn
supabase functions deploy nissan-lead-relay      --no-verify-jwt --project-ref raextqlludkagdntyzwn
supabase functions deploy nissan-dengage-tables  --no-verify-jwt --project-ref raextqlludkagdntyzwn
supabase functions deploy nissan-persona-seed    --no-verify-jwt --project-ref raextqlludkagdntyzwn
supabase functions deploy nissan-contact-peek                    --project-ref raextqlludkagdntyzwn
```

## Proving a deploy worked

```
curl -s 'https://raextqlludkagdntyzwn.supabase.co/functions/v1/nissan-booking-confirm?health=1'
```

A JSON body listing eleven moments means the function is live and JWT
verification is off. A 401 means it is on, and the deploy has to be repeated
with the flag.

## One function has no source here

`nissan-api-probe` is deployed in the project and is not in this repository. It
was a one-off diagnostic for checking Dengage API reachability, nothing calls
it, and it is left alone rather than redeployed. Do not delete it: nothing in
this project deletes anything without being asked to.
