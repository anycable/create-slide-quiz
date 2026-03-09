#!/usr/bin/env node
import { main } from "./lib.mjs";
import * as p from "@clack/prompts";

main().catch(err => {
  p.log.error(err.message);
  process.exit(1);
});
