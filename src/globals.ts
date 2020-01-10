import {IKeyValue} from "./index";

export class Globals {

    public readonly variables: IKeyValue = {};

    /** @deprecated Gitlab CI 12.7 */
    public readonly beforeScripts: string[] | null;

    /** @deprecated Gitlab CI 12.7 */
    public readonly afterScripts: string[] | null;

}
