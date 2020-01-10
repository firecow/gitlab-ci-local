import {IKeyValue} from "./index";

export class Globals {

    public readonly variables: IKeyValue = {};
    public readonly beforeScripts: string[] | null;
    public readonly scripts: string[] | null;
    public readonly afterScripts: string[] | null;

}
