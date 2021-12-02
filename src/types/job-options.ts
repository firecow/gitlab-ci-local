import {GitData} from "../git-data";
import {WriteStreams} from "./write-streams";

export interface JobOptions {
    writeStreams: WriteStreams;
    data: any;
    name: string;
    namePad: number;
    cwd: string;
    globals: any;
    pipelineIid: number;
    gitData: GitData;
    extraHosts: string[];
    volumes: string[];
    variablesFromFiles: { [name: string]: string };
    cliVariables: { [name: string]: string };
    shellIsolation: boolean;
    mountCache: boolean;
}
