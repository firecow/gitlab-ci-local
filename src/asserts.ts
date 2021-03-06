import {ExitError} from "./types/exit-error";

export function assert(expression: boolean, exitMsg: string): asserts expression {
    if (!expression) {
        throw new ExitError(exitMsg);
    }
}
