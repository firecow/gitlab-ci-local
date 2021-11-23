import {GitData} from "../git-data";
import {WriteStreams} from "./write-streams";

export interface JobOptions {
    writeStreams: WriteStreams;
    data: any;
    name: string;
    cwd: string;
    globals: any;
    pipelineIid: number;
    gitData: GitData;
    extraHosts: string[];
    volumes: string[];
    homeVariables: { [name: string]: string };
    projectVariables: { [name: string]: string };
    shellIsolation: boolean;
}
