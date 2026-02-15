import schema from "./schema.json";

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
