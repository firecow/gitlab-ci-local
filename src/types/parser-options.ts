import {WriteStreams} from "./write-streams";

export interface ParserOptions {
    cwd: string;
    writeStreams: WriteStreams;
    pipelineIid: number;
    variables: { [key: string]: string };
    extraHosts?: string[];
    volumes?: string[];
    home?: string;
    file?: string;
    shellIsolation?: boolean;
    mountCache?: boolean;
}
