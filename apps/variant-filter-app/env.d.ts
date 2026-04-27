import type { Env } from "./server";

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    env: Env;
    ctx: ExecutionContext;
  }
}
