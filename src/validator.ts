import Ajv from "ajv";
import {Job} from "./job.js";
import assert from "assert";
import chalk from "chalk";
import schema from "./schema/index.js";
import {betterAjvErrors} from "./schema-error.js";
import terminalLink from "terminal-link";

const MAX_ERRORS = 5;

export class Validator {
    static jsonSchemaValidation ({pathToExpandedGitLabCi, gitLabCiConfig}: {
        pathToExpandedGitLabCi: string;
        gitLabCiConfig: object;
    }) {
        const ajv = new Ajv({
            verbose: true,
            allErrors: true,
            allowUnionTypes: true,
            validateFormats: false,
            strictTypes: false, // to suppress the missing types defined in the gitlab-ci json schema
            keywords: ["markdownDescription"],
        });
        const validate = ajv.compile(schema);
        const valid = validate(gitLabCiConfig);
        if (!valid) {
            const betterErrors = betterAjvErrors({
                data: gitLabCiConfig,
                errors: validate.errors,
            });

            let e: string = "";
            for (let i = 0, len = betterErrors.length; i < len; i++) {
                if (i + 1 > MAX_ERRORS) {
                    e += `\t... and ${len - MAX_ERRORS} more`;
                    break;
                }
                e += chalk`\t• {redBright ${betterErrors[i].message}} at {blueBright ${betterErrors[i].path}}\n`;
            }

            assert(valid, chalk`
{reset Invalid .gitlab-ci.yml configuration!
${e.trimEnd()}

For further troubleshooting, consider either of the following:
\t• Copy the content of {blueBright ${terminalLink(".gitlab-ci-local/expanded-gitlab-ci.yml", pathToExpandedGitLabCi)}} to the ${terminalLink("pipeline editor", "https://docs.gitlab.com/ee/ci/pipeline_editor/")} to debug it
\t• Use --json-schema-validation=false to disable schema validation (not recommended)}
`);
        }
    }

    private static needs (jobs: ReadonlyArray<Job>, stages: readonly string[]): string[] {
        const warnings: string[] = [];
        for (const job of jobs) {
            if (job.needs === null || job.needs.length === 0) continue;

            for (const [i, need] of job.needs.entries()) {
                if (need.pipeline) {
                    warnings.push(`${job.name}.needs[${i}].job:${need.job} ignored, pipeline key not supported`);
                    continue;
                }
                if (need.project) {
                    warnings.push(`${job.name}.needs[${i}] ignored, project key not supported`);
                    continue;
                }
                const needJob = jobs.find(j => j.baseName === need.job);
                if (need.optional && !needJob) continue;
                assert(needJob != null, chalk`needs: [{blueBright ${need.job}}] for {blueBright ${job.baseName}} could not be found`);
                const needJobStageIndex = stages.indexOf(needJob.stage);
                const jobStageIndex = stages.indexOf(job.stage);
                assert(needJobStageIndex <= jobStageIndex, chalk`needs: [{blueBright ${needJob.name}}] for {blueBright ${job.name}} is in a future stage`);
            }

        }
        return warnings;
    }

    private static dependencies (jobs: ReadonlyArray<Job>, stages: readonly string[]) {
        for (const job of jobs) {
            if (job.dependencies === null || job.dependencies.length === 0) continue;

            const undefDeps = job.dependencies.filter((j) => !jobs.some(n => n.baseName === j));
            assert(undefDeps.length !== job.dependencies.length, chalk`dependencies: [{blueBright ${undefDeps.join(",")}}] for {blueBright ${job.name}} cannot be found`);

            for (const dep of job.dependencies) {
                const depJob = jobs.find(j => j.baseName === dep);
                assert(depJob != null, chalk`dependencies: [{blueBright ${dep}}] for {blueBright ${job.baseName}} could not be found`);
                const depJobStageIndex = stages.indexOf(depJob.stage);
                const jobStageIndex = stages.indexOf(job.stage);
                assert(depJobStageIndex <= jobStageIndex, chalk`dependencies: [{blueBright ${depJob.name}}] for {blueBright ${job.name}} is in a future stage`);
            }
        }
    }

    private static dependenciesContainment (jobs: ReadonlyArray<Job>) {
        for (const job of jobs) {
            const needs = job.needs;
            const dependencies = job.dependencies;
            if (needs && needs.length === 0) continue;
            if (!dependencies || !needs) continue;


            const everyIncluded = dependencies.every((dep: string) => {
                return needs.some(n => n.job === dep);
            });
            const assertMsg = `${job.formattedJobName} needs: '${needs.map(n => n.job).join(",")}' doesn't fully contain dependencies: '${dependencies.join(",")}'`;
            assert(everyIncluded, assertMsg);
        }
    }

    /**
     * These jobs named are reserved keywords in GitLab CI but does not prevent the pipeline from running
     * https://github.com/firecow/gitlab-ci-local/issues/1263
     * @param jobsNames
     * @private
     */
    private static potentialIllegalJobName (jobsNames: string[]) {
        const warnings = [];
        for (const jobName of jobsNames) {
            if (new Set(["types", "true", "false", "nil"]).has(jobName)) {
                warnings.push(`Job name "${jobName}" is a reserved keyword. (https://docs.gitlab.com/ee/ci/jobs/#job-name-limitations)`);
            }
        }
        return warnings;
    }

    private static scriptBlank (jobs: ReadonlyArray<Job>) {
        for (const job of jobs) {
            if (job.trigger) continue; // Jobs with trigger are allowed to have empty script
            assert(job.scripts.length > 0, chalk`{blue ${job.name}} has empty script`);
        }
    }

    private static arrayOfStrings (jobs: ReadonlyArray<Job>) {
        for (const job of jobs) {
            if (job.trigger) continue;
            job.beforeScripts.forEach((s: any) => assert(typeof s === "string", chalk`{blue ${job.name}} before_script contains non string value`));
            job.afterScripts.forEach((s: any) => assert(typeof s === "string", chalk`{blue ${job.name}} after_script contains non string value`));
            job.scripts.forEach((s: any) => assert(typeof s === "string", chalk`{blue ${job.name}} script contains non string value`));
        }
    }

    static async run (jobs: ReadonlyArray<Job>, stages: readonly string[]) {
        const warnings: string[] = [];
        this.scriptBlank(jobs);
        this.arrayOfStrings(jobs);
        warnings.push(...this.needs(jobs, stages));
        this.dependencies(jobs, stages);
        this.dependenciesContainment(jobs);
        warnings.push(...this.potentialIllegalJobName(jobs.map(j => j.baseName)));
        warnings.push(...this.artifacts(jobs));
        return warnings;
    }

    private static artifacts (jobs: ReadonlyArray<Job>) {
        const warnings: string[] = [];
        for (const job of jobs) {
            if (job.artifacts === null) {
                warnings.push(`${job.name}.artifacts is null, ignoring.`);
            }
        }
        return warnings;
    }
}
