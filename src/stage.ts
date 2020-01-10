import {Job} from "./job";

export class Stage {

    public readonly name: string;
    private readonly jobs: Job[] = [];

    constructor(name: string) {
        this.name = name;
    }

    public addJob(job: Job) {
        this.jobs.push(job);
    }

    public getJobs(): ReadonlyArray<Job> {
        return this.jobs;
    }
}
