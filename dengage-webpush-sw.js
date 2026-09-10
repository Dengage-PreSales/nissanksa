/* Dengage web push service worker.
 *
 * This file has to sit at the ORIGIN ROOT and be served with a root scope. The
 * SDK bundle asks for exactly "/dengage-webpush-sw.js" with scope "/", both
 * baked into the bundle rather than configurable, so a copy at any other path
 * is never registered and push silently never arms.
 *
 * While the demo lived under a subpath the root belonged to another
 * repository, so this file could not be kept beside the site it serves. At its
 * own origin the root is ours and it lives here, which is why the publish step
 * copies it to the top of dist/.
 *
 * It is Dengage's, copied byte for byte from a published origin, and only this
 * comment has been added. It takes the account and application from its own
 * query string and imports the real worker from the CDN, so it is account
 * agnostic: changing Dengage accounts needs no change here.
 */
var a=new URL(location),b="searchParams",c="get",d=a[b][c]("account_id"),e=a[b][c]("app_guid"),f=a[b][c]("version"),g=a[b][c]("hash");if(d&&e){importScripts("https://pcdn.dengage.com/p/push/"+d+"/"+e+(f?("/sdk/"+f):"")+"/dengage_sw"+(g?("."+g):"")+".js")}
