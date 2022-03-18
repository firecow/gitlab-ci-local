import {GitData} from "../git-data";
import {WriteStreams} from "./write-streams";
import {Argv} from "../argv";

export interface JobOptions {
    argv: Argv;
    writeStreams: WriteStreams;
    data: any;
    name: string;
    namePad: number;
    globals: any;
    pipelineIid: number;
    gitData: GitData;
    variablesFromFiles: { [name: string]: string|Record<string, string> };
}
