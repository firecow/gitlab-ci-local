#!/usr/bin/env node
import * as sourceMapSupport from "source-map-support";
import {runYargs} from "./yargs";

sourceMapSupport.install();

(() => {
    runYargs();
})();

