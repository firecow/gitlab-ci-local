import schema from "./schema.json";

// Remove patterns that are too strict for gitlab-ci-local usage
// @ts-expect-error ts-expect-error
delete schema.definitions.include_item.oneOf[0].pattern; // include shorthand rejects glob wildcards
// @ts-expect-error ts-expect-error
delete schema.definitions.cache_item.properties.key.oneOf[0].pattern; // cache key rejects paths with /

// @ts-expect-error ts-expect-error
schema.definitions.job_template.properties.gclInjectSSHAgent = {
    "type": "boolean",
};
// @ts-expect-error ts-expect-error
schema.definitions.job_template.properties.gclInteractive = {
    "type": "boolean",
};
// @ts-expect-error ts-expect-error
schema.definitions.job_template.properties.gclArtifactsToSource = {
    "type": "boolean",
};
// @ts-expect-error ts-expect-error
schema.definitions.job_template.properties.gclDescription = {
    "type": "string",
};

export default schema;
