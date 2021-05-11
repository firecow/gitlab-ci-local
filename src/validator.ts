import {Job} from "./job";
import {assert} from "./asserts";
import chalk from "chalk";
import {Utils} from "./utils";

export class Validator {

    static async validateNeedsTags(jobs: ReadonlyMap<string, Job>, stages: readonly string[]) {
        const jobNames = [...jobs.values()].map((j) => j.name);
        for (const [jobName, job] of jobs) {
            if (job.needs === null || job.needs.length === 0) {
                continue;
            }

            const undefNeedsJob = job.needs.filter((v) => !jobNames.includes(v));
            assert(
                undefNeedsJob.length !== job.needs.length,
                chalk`[ {blueBright ${undefNeedsJob.join(",")}} ] jobs are needed by {blueBright ${jobName}}, but they cannot be found`
            );

            for (const need of job.needs) {
                const needJob = Utils.getJobByName(jobs, need);
                const needJobStageIndex = stages.indexOf(needJob.stage);
                const jobStageIndex = stages.indexOf(job.stage);
                assert(
                    needJobStageIndex < jobStageIndex,
                    chalk`{blueBright ${needJob.name}} is needed by {blueBright ${job.name}}, but it is in the same or a future stage`,
                );
            }

        }
    }
}
