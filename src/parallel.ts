import chalk from "chalk-template";
import assert, {AssertionError} from "node:assert";
import deepExtend from "deep-extend";
import {Need} from "./job.js";

type MatrixSelector = NonNullable<Need["parallel"]>["matrix"];
type MatrixVariables = {[key: string]: string};

export function isPlainParallel (jobData: any) {
    return Number.isInteger(jobData.parallel);
}

// Expand a parallel.matrix-shaped selector into concrete {key: value} bindings.
// Mirrors GitLab's expansion: scalars are wrapped to single-element arrays, and
// arrays produce a cartesian product across keys within an entry.
export function expandMatrixSelector (matrix: MatrixSelector): MatrixVariables[] {
    const expanded: MatrixVariables[] = [];
    for (const entry of matrix) {
        let inner: MatrixVariables[] = [{}];
        for (const [key, raw] of Object.entries(entry)) {
            const values = Array.isArray(raw) ? raw : [raw];
            const next: MatrixVariables[] = [];
            for (const clone of inner) {
                for (const v of values) {
                    next.push({...clone, [key]: String(v)});
                }
            }
            inner = next;
        }
        expanded.push(...inner);
    }
    return expanded;
}

// Returns true if `producerVars` matches at least one expanded selector entry.
// Match semantics: every key in the selector entry must equal the producer's value;
// the producer may have extra keys not mentioned in the selector.
export function matrixSelectorMatches (producerVars: MatrixVariables | null, matrix: MatrixSelector): boolean {
    if (!producerVars) return false;
    return expandMatrixSelector(matrix).some(sel =>
        Object.entries(sel).every(([k, v]) => String(producerVars[k]) === String(v)),
    );
}

// Find the consumer's `need` (if any) that this `producer` job satisfies.
// Used by both the executor (waitFor) and the artifacts producer pipeline so
// the two paths apply the same matching rules.
export function findMatchingNeed (consumerNeeds: ReadonlyArray<Need> | null, producerName: string, producerBaseName: string): Need | undefined {
    return consumerNeeds?.find(n => n.job === producerName || n.job === producerBaseName);
}

// `$[[ matrix.IDENTIFIER ]]` — see https://docs.gitlab.com/ci/yaml/matrix_expressions/.
// Identifier charset matches upstream gitlab-org/gitlab's MatrixInterpolator regex
// `[a-zA-Z0-9_-]+` (letters, digits, underscore, hyphen).
const MATRIX_EXPR_RE = /\$\[\[\s*matrix\.([a-zA-Z0-9_-]+)\s*\]\]/g;
const MATRIX_EXPR_TEST_RE = /\$\[\[\s*matrix\./;

function valueContainsMatrixExpr (v: unknown): boolean {
    if (Array.isArray(v)) return v.some(valueContainsMatrixExpr);
    if (typeof v !== "string") return false;
    return MATRIX_EXPR_TEST_RE.test(v);
}

// Detect whether any need's parallel.matrix selector contains a `$[[ matrix.X ]]` expression.
// Used to surface a clear error if a non-parallel-matrix consumer references such expressions.
export function needsContainMatrixExpressions (needs: Need[]): boolean {
    return needs.some(n =>
        n.parallel?.matrix?.some(entry => Object.values(entry).some(valueContainsMatrixExpr)) ?? false,
    );
}

function substituteMatrixExpr (value: unknown, consumerVars: MatrixVariables, jobName: string): unknown {
    if (Array.isArray(value)) return value.map(v => substituteMatrixExpr(v, consumerVars, jobName));
    if (typeof value !== "string") return value;
    return value.replace(MATRIX_EXPR_RE, (_, key) => {
        if (!(key in consumerVars)) {
            // Wording mirrors upstream gitlab-org/gitlab's MatrixInterpolator error
            // ("'X' does not exist in matrix configuration") so log greps line up.
            throw new AssertionError({message: chalk`{blueBright ${jobName}}: '{yellow ${key}}' does not exist in matrix configuration`});
        }
        return consumerVars[key];
    });
}

// Substitute `$[[ matrix.X ]]` references inside each need's parallel.matrix
// selector, using the consumer permutation's own matrix bindings. Returns a
// shallow-cloned needs array (only entries with parallel.matrix are rebuilt);
// non-substituted fields on each need are shared with the input by reference.
export function resolveNeedsMatrixExpressions (needs: Need[], consumerVars: MatrixVariables, jobName: string): Need[] {
    return needs.map(n => {
        if (!n?.parallel?.matrix) return n;
        return {
            ...n,
            parallel: {
                ...n.parallel,
                matrix: n.parallel.matrix.map(entry =>
                    Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, substituteMatrixExpr(v, consumerVars, jobName)])),
                ) as MatrixSelector,
            },
        };
    });
}

export function matrixVariablesList (jobData: any, jobName: string): {[key: string]: string}[] | null[] {
    if (isPlainParallel(jobData)) {
        return new Array(jobData.parallel).fill(null);
    }
    if (jobData?.parallel?.matrix == null) {
        return [null];
    }
    assert(Array.isArray(jobData.parallel.matrix), `${jobName} parallel.matrix is not an array`);

    const matrixVariables: {[key: string]: string}[] = [];

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
