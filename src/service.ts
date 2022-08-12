import {Utils} from "./utils";
import {assert} from "./asserts";

export class Service {
    private readonly data: any;
    public readonly index: number;

    constructor (data: any, index: number) {
        this.data = data;
        this.index = index;
    }

    public getName (expandedVariables: {[key: string]: string}): string {
        assert(this.data.name, "Service should always have an image name");
        const name = Utils.expandText(this.data.name, expandedVariables);
        return name.includes(":") ? name : `${name}:latest`;
    }

    public getEntrypoint (): string[] | null {
        if (!this.data || !this.data.entrypoint) {
            return null;
        }
        assert(Array.isArray(this.data.entrypoint), "services:entrypoint must be an array");
        return this.data.entrypoint;
    }

    public getCommand (): string[] | null {
        if (!this.data || !this.data.command) {
            return null;
        }
        assert(Array.isArray(this.data.command), "service:command must be an array");
        return this.data.command;
    }

    public getAlias (expandedVariables: {[key: string]: string}): string | null {
        if (!this.data || !this.data.alias) {
            return null;
        }

        return Utils.expandText(this.data.alias, expandedVariables);
    }

}
