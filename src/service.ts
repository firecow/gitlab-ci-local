import {Utils} from "./utils";
import {assert} from "./asserts";

export class Service {
    private readonly serviceData: any;

    constructor(serviceData: any) {
        this.serviceData = serviceData;
    }

    public getName(expandedVariables: { [key: string]: string }): string {
        assert(this.serviceData.name, "Service should always have an image name");
        const servicesName = Utils.expandText(this.serviceData.name, expandedVariables);
        return servicesName.includes(":") ? servicesName : `${servicesName}:latest`;
    }

    public getEntrypoint(): string[] | null {
        if (!this.serviceData || !this.serviceData.entrypoint) {
            return null;
        }
        assert(Array.isArray(this.serviceData.entrypoint), "services:entrypoint must be an array");
        return this.serviceData.entrypoint;
    }

    public getCommand(expandedVariables: { [key: string]: string }): string | null {
        if (!this.serviceData || !this.serviceData.command) {
            return null;
        }

        return Utils.expandText(this.serviceData.command, expandedVariables);
    }

    public getAlias(expandedVariables: { [key: string]: string }): string | null {
        if (!this.serviceData || !this.serviceData.alias) {
            return null;
        }

        return Utils.expandText(this.serviceData.alias, expandedVariables);
    }

}
