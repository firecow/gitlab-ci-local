import {GitRemote} from "./git-remote";
import {GitUser} from "./git-user";
import {WriteStreams} from "./write-streams";

export interface JobOptions {
    writeStreams: WriteStreams,
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
