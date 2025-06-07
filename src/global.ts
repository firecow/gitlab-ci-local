import {RE2JS} from "re2js";

declare global {
    interface String {
        matchRE2JS(o: RE2JS): Array<string> | null;
    }
}
String.prototype.matchRE2JS = function (o: RE2JS): Array<string> | null {
    let results: string[] | null = null;
    const matcher = o.matcher(this.toString());
    while (matcher.find()) {
        const g = matcher.group();
        if (g == "") continue;
        results = results == null ? [] : results;
        results.push(g);
    }
    return results;
};
