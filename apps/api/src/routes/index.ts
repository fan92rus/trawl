import { Elysia } from "elysia"
import pkg from "../../package.json"
import { startTime } from "../config"

// FlareSolverr-style root status message — same intent as FlareSolverr's own `/`
// (announces the service is up, with a version + uptime, instead of 404ing).
// /ping is part of the FlareSolverr surface: Prowlarr's proxy validation
// requests {host}/ping and refuses to save the proxy without it.
export function indexRoute() {
  return new Elysia()
    .get("/", () => ({
      msg: "TRAWL is ready!",
      version: pkg.version,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    }))
    .get("/ping", () => "Pong")
}
