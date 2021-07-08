import {WriteStreams} from "./write-streams";

export interface ParserOptions {
    cwd: string;
    writeStreams: WriteStreams;
    pipelineIid: number;
    showInitMessage?: boolean;
    fetchIncludes?: boolean;
    extraHosts?: string[];
    volumes?: string[];
    home?: string;
    file?: string;
}
