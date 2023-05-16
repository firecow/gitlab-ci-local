import assert from "assert";
import deepExtend from "deep-extend";

export function matrixVariablesList (jobData: any, jobName: string) {
    const matrixVariables: {[key: string]: string}[] = [];

    if (jobData?.parallel?.matrix == null) {
        if (Number.isInteger(jobData?.parallel)) {
            for (let i = 0; i < jobData.parallel; i++) {
                matrixVariables.push({});
            }
            return matrixVariables;
        }
        return null;
    }
    assert(Array.isArray(jobData.parallel.matrix), `${jobName} parallel.matrix is not an array or integer`);

    // Expand string value to array of values
    for (const m of jobData.parallel.matrix) {
        for (const [key, value] of Object.entries(m)) {
            m[key] = Array.isArray(value) ? value : [value];
        }
    }

    // Generate variables in while loop by expanding the matrix
    const deep = deepExtend({}, jobData);
    for (const m of deep.parallel.matrix) {
        let i = 0;

        let inner = [];
        while (Object.keys(m).length > 0 && i < 100) {
            const keys = Object.keys(m);
            const key = keys[0];
            const values = m[key];
            delete m[key];

            const innerClone = inner.length > 0 ? [...inner] : [{}];
            inner = [];

            for (const clone of innerClone) {
                for (const v of values) {
                    const matrixVariable: {[key: string]: string} = {...clone};
                    matrixVariable[key] = v;
                    inner.push(matrixVariable);
                }
            }
            i++;
        }
        matrixVariables.push(...inner);
    }

    return matrixVariables;
}
