import * as c from "ansi-colors";
import {Job} from "./job";

export class Utils {
    static printJobNames(job: Job, i: number, arr: Job[]) {
        if (i === arr.length - 1) {
            process.stdout.write(`${c.blueBright(`${job.name}`)}`);
        } else {
            process.stdout.write(`${c.blueBright(`${job.name}`)}, `);
        }
    }
}
