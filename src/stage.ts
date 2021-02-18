import {Job} from "./job";

export class Stage {

    readonly name: string;
    private readonly jobs: Job[] = [];

    constructor(name: string) {
        this.name = name;
    }

    addJob(job: Job) {
        this.jobs.push(job);
    }

    getJobs(): ReadonlyArray<Job> {
        return this.jobs;
    }

    isFinished(): boolean {
        return this.jobs.filter((j) => j.isFinished()).length === this.jobs.length;
    }

    isSuccess(): boolean {
        return this.jobs.filter((j) => j.isSuccess()).length === this.jobs.length;
    }
}
