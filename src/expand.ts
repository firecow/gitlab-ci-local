import assert from "node:assert";

type ExpandWith = {
    unescape: string;
    variable: (name: string) => string;
};

export function expandTextWith (text: any, expandWith: ExpandWith) {
    if (typeof text !== "string") {
        return text;
    }

    return text.replaceAll(
        /(\$\$)|\$\{([a-zA-Z_]\w*)}|\$([a-zA-Z_]\w*)/g, // https://regexr.com/7s4ka
        (_match, escape, var1, var2) => {
            if (escape !== undefined) {
                return expandWith.unescape;
            }
            const name = var1 || var2;
            assert(name, "unexpected unset capture group");
            return `${expandWith.variable(name)}`;
        },
    );
}

export function expandText (text: any, envs: {[key: string]: string}) {
    return expandTextWith(text, {
        unescape: "$",
        variable: (name) => envs[name] ?? "",
    });
}

export function expandVariables (variables: {[key: string]: string}) {
    const _variables = {...variables}; // copy by value to prevent mutating the original input
    let expandedAnyVariables, i = 0;
    do {
        assert(i < 100, "Recursive variable expansion reached 100 iterations");
        expandedAnyVariables = false;
        for (const [k, v] of Object.entries(_variables)) {
            const envsWithoutSelf = {..._variables};
            delete envsWithoutSelf[k];
            // If the $$'s are converted to single $'s now, then the next
            // iteration, they might be interpreted as _variables, even
            // though they were *explicitly* escaped. To work around this,
            // leave the '$$'s as the same value, then only unescape them at
            // the very end.
            _variables[k] = expandTextWith(v, {
                unescape: "$$",
                variable: (name) => envsWithoutSelf[name] ?? "",
            });
            expandedAnyVariables ||= _variables[k] !== v;
        }
        i++;
    } while (expandedAnyVariables);

    return _variables;
}
