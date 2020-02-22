import { Job } from "./job";

export class Stage {

    public readonly name: string;
    private readonly jobs: Job[] = [];

    public constructor(name: string) {
        this.name = name;
    }

    public addJob(job: Job) {
        this.jobs.push(job);
    }

    public getJobs(): ReadonlyArray<Job> {
        return this.jobs;
    }

    public isFinished(): boolean {
        return this.jobs.filter((j) => j.isFinished()).length === this.jobs.length;
    }

    public isRunning(): boolean {
        return this.jobs.filter((j) => j.isRunning()).length > 0;
    }

    public isSuccess(): boolean {
        return this.jobs.filter((j) => j.isSuccess()).length === this.jobs.length;
    }
}
