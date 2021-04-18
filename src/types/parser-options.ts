import {WriteStreams} from "./write-streams";

export interface ParserOptions {
    cwd: string;
    writeStreams: WriteStreams;
    pipelineIid: number;
    tabCompletionPhase: boolean;
    extraHosts?: string[];
    home?: string;
    file?: string;
}
