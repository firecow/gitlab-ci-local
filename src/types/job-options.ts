import {GitData} from "./git-data";
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
    gitData: GitData;
    extraHosts: string[];
    homeVariables: { [name: string]: string };
}
