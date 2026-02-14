import {RE2JS} from "re2js";

declare global {
    interface String {
        matchRE2JS(o: RE2JS): Array<string> | null;
        matchAllRE2JS(o: RE2JS): IterableIterator<RegExpMatchAll>;
    }
}

interface RegExpMatchAll extends Array<string | null> {
    index?: number;
    input?: string;
    groups: Record<string, string> | undefined;
}

String.prototype.matchRE2JS = function (o: RE2JS): Array<string> | null {
    let results: string[] | null = null;
    const matcher = o.matcher(this.toString());
    while (matcher.find()) {
        const g = matcher.group();
        if (g == null || g == "") continue;
        results = results ?? [];
        results.push(g);
    }
    return results;
};

String.prototype.matchAllRE2JS = function (o: RE2JS) {
    const self = this.toString();
    const matcher = o.matcher(self);

    function* iterator (): IterableIterator<RegExpMatchAll> {
        while (matcher.find()) {
            const match: RegExpMatchAll = [] as unknown as RegExpMatchAll;
            for (let i = 0; i <= matcher.groupCount(); i++) {
                match.push(matcher.group(i));
            }
            match.index = matcher.groups[0];
            match.input = self;

            if (matcher.namedGroups && Object.keys(matcher.namedGroups).length > 0) {
                const groups = Object.create(null);
                for (const [name, value] of Object.entries(matcher.namedGroups as Record<string, number>)) {
                    groups[name] = matcher.group(value);
                }
                match.groups = groups;
            } else {
                match.groups = undefined;
            }

            yield match;
        }
    }

    return iterator();
};
