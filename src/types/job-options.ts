import {GitRemote} from "./git-remote";
import {GitUser} from "./git-user";

export interface JobOptions {
    jobData: any;
    name: string;
    cwd: string;
    globals: any;
    pipelineIid: number;
    jobId: number;
    maxJobNameLength: number;
    gitRemote: GitRemote;
    gitUser: GitUser;
    userVariables: { [name: string]: string }
}
