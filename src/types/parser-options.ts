import {WriteStreams} from "./write-streams";

export interface ParserOptions {
    cwd: string;
    writeStreams: WriteStreams;
    pipelineIid: number;
    variables: { [key: string]: string };
    showInitMessage?: boolean;
    fetchIncludes?: boolean;
    extraHosts?: string[];
    volumes?: string[];
    home?: string;
    file?: string;
    shellIsolation?: boolean;
}
