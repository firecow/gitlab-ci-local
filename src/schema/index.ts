const schema: any = JSON.parse("./schema.json");
schema.definitions.job_template.properties.gclInjectSSHAgent = {
    "type": "boolean",
};
schema.definitions.job_template.properties.gclInteractive = {
    "type": "boolean",
};
schema.definitions.job_template.properties.gclArtifactsToSource = {
    "type": "boolean",
};

schema.definitions.job_template.properties.gclDescription = {
    "type": "string",
};

export default schema;
