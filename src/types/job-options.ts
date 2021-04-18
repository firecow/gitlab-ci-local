import {GitRemote} from "./git-remote";
import {GitUser} from "./git-user";
import {WriteStreams} from "./write-streams";

export interface JobOptions {
    writeStreams: WriteStreams;
    data: any;
    name: string;
    namePad: number;
    cwd: string;
    globals: any;
    pipelineIid: number;
    id: number;
    gitRemote: GitRemote;
    gitUser: GitUser;
    homeVariables: { [name: string]: string };
}
