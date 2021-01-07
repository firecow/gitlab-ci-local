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

    static printToStream(text: string, stream: string) {
        const colorize = (l: string) => {
            return stream === 'stderr' ? c.red(l) : l;
        }
        for (const line of text.split(/\r?\n/)) {
            if (line.length === 0) continue;
            // @ts-ignore
            process[stream].write(`${colorize(`${line}`)}\n`)
        }
    }
    static expandEnv(text: string, envs: { [key: string]: string | undefined } = process.env) {
        // tslint:disable-next-line:only-arrow-functions
        return text.replace(/[$][{]?\w*[}]?/g, function (match) {
            const sub = envs[match.replace(/^[$][{]?/, '').replace(/[}]?$/, '')];
            return sub || match;
        });
    }
}
