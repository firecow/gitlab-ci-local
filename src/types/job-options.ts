import {GitData} from "../git-data";
import {WriteStreams} from "./write-streams";
import {Argv} from "../argv";
import {CICDVariable} from "../variables-from-files";

export interface JobOptions {
    argv: Argv;
    writeStreams: WriteStreams;
    data: any;
    name: string;
    namePad: number;
    globals: any;
    pipelineIid: number;
    gitData: GitData;
    variablesFromFiles: { [name: string]: CICDVariable };
}
